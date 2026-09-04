import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderPriority, OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { InsufficientStockError } from '../inventory/errors';
import { RealtimeGateway, RealtimeEvent } from '../realtime/realtime.gateway';
import { buildPaginationMeta, PaginatedResult } from '../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderPriorityDto } from './dto/update-order-priority.dto';
import {
  TRACKING_DESCRIPTIONS,
  assertRoleCanTransition,
  assertValidTransition,
} from './order-status.util';
import { generateOrderNumber, generateTrackingCode } from './generate-code.util';

const ORDER_INCLUDE = {
  items: { include: { product: true } },
  carrier: true,
  assignedOperator: { select: { id: true, name: true, email: true } },
  trackingEvents: { orderBy: { createdAt: 'asc' as const } },
  shipment: true,
  pickingWave: { select: { id: true, code: true, status: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async findAll(query: OrderQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.priority && { priority: query.priority }),
      ...(query.carrierId && { carrierId: query.carrierId }),
      ...(query.assignedOperatorId && { assignedOperatorId: query.assignedOperatorId }),
      ...((query.dateFrom || query.dateTo) && {
        createdAt: {
          ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
          ...(query.dateTo && { lte: new Date(query.dateTo) }),
        },
      }),
      ...(query.search && {
        OR: [
          { number: { contains: query.search, mode: 'insensitive' } },
          { customerName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          carrier: true,
          assignedOperator: { select: { id: true, name: true } },
          items: { select: { id: true, quantity: true } },
        },
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortDir ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(dto: CreateOrderDto, actor: AuthenticatedUser) {
    if (dto.carrierId) {
      const carrier = await this.prisma.carrier.findUnique({ where: { id: dto.carrierId } });
      if (!carrier) throw new BadRequestException('Carrier not found');
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products in the order do not exist');
    }

    const totalValue = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          number: generateOrderNumber(),
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          deliveryAddress: dto.deliveryAddress,
          carrierId: dto.carrierId,
          priority: dto.priority ?? 'NORMAL',
          totalValue,
          estimatedDeliveryAt: dto.estimatedDeliveryAt ? new Date(dto.estimatedDeliveryAt) : null,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      await tx.trackingEvent.create({
        data: {
          orderId: created.id,
          status: OrderStatus.RECEIVED,
          description: TRACKING_DESCRIPTIONS.RECEIVED,
        },
      });

      await this.audit.log(
        {
          userId: actor.id,
          action: 'ORDER_CREATED',
          entityType: 'Order',
          entityId: created.id,
          newValue: { number: created.number, totalValue, items: dto.items },
        },
        tx,
      );

      return created;
    });

    this.realtime.emit(RealtimeEvent.ORDER_CREATED, {
      id: order.id,
      number: order.number,
      status: order.status,
    });

    // Reservation is a separate, independently-failing step: the order
    // always gets created, but stock may not be available yet.
    await this.tryReserve(
      order.id,
      dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      actor,
    );

    return this.findOne(order.id);
  }

  /** Retries reservation for an order still stuck at RECEIVED (e.g. after restock). */
  async retryReservation(id: string, actor: AuthenticatedUser) {
    const order = await this.findOne(id);
    if (order.status !== OrderStatus.RECEIVED) {
      throw new BadRequestException(
        'Only orders still awaiting reservation (RECEIVED) can be retried',
      );
    }
    await this.tryReserve(
      id,
      order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      actor,
    );
    return this.findOne(id);
  }

  private async tryReserve(
    orderId: string,
    items: { productId: string; quantity: number }[],
    actor: AuthenticatedUser,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.inventory.applyReservation(tx, items, orderId);
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.RESERVED } });
        await tx.trackingEvent.create({
          data: {
            orderId,
            status: OrderStatus.RESERVED,
            description: TRACKING_DESCRIPTIONS.RESERVED,
          },
        });
        await this.audit.log(
          {
            userId: actor.id,
            action: 'ORDER_STATUS_CHANGED',
            entityType: 'Order',
            entityId: orderId,
            previousValue: { status: OrderStatus.RECEIVED },
            newValue: { status: OrderStatus.RESERVED },
          },
          tx,
        );
      });
      this.realtime.emit(RealtimeEvent.ORDER_STATUS_CHANGED, {
        orderId,
        from: OrderStatus.RECEIVED,
        to: OrderStatus.RESERVED,
      });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        const alert = await this.prisma.alert.create({
          data: {
            type: 'RESERVATION_FAILURE',
            severity: 'CRITICAL',
            message: `Falha ao reservar estoque para o pedido: ${err.message}`,
            entityType: 'Order',
            entityId: orderId,
          },
        });
        this.realtime.emit(RealtimeEvent.ALERT_CREATED, alert);
        return;
      }
      throw err;
    }
  }

  async updatePriority(id: string, dto: UpdateOrderPriorityDto, actor: AuthenticatedUser) {
    const before = await this.findOne(id);
    const order = await this.prisma.order.update({
      where: { id },
      data: { priority: dto.priority },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'ORDER_PRIORITY_CHANGED',
      entityType: 'Order',
      entityId: id,
      previousValue: { priority: before.priority },
      newValue: { priority: order.priority },
    });

    this.realtime.emit(RealtimeEvent.ORDER_UPDATED, { orderId: id, priority: order.priority });
    return this.findOne(id);
  }

  async bulkUpdatePriority(orderIds: string[], priority: OrderPriority, actor: AuthenticatedUser) {
    await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { priority },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'ORDER_PRIORITY_BULK_CHANGED',
      entityType: 'Order',
      entityId: orderIds.join(','),
      newValue: { orderIds, priority },
    });
    this.realtime.emit(RealtimeEvent.ORDER_UPDATED, { orderIds, priority });
    return { updated: orderIds.length };
  }

  async assignOperator(id: string, operatorId: string, actor: AuthenticatedUser) {
    const operator = await this.prisma.user.findUnique({ where: { id: operatorId } });
    if (!operator || !operator.active)
      throw new BadRequestException('Operator not found or inactive');

    const before = await this.findOne(id);
    await this.prisma.order.update({ where: { id }, data: { assignedOperatorId: operatorId } });

    await this.audit.log({
      userId: actor.id,
      action: 'ORDER_OPERATOR_ASSIGNED',
      entityType: 'Order',
      entityId: id,
      previousValue: { assignedOperatorId: before.assignedOperatorId },
      newValue: { assignedOperatorId: operatorId },
    });

    this.realtime.emit(RealtimeEvent.ORDER_UPDATED, {
      orderId: id,
      assignedOperatorId: operatorId,
    });
    return this.findOne(id);
  }

  async assignCarrier(id: string, carrierId: string, actor: AuthenticatedUser) {
    const carrier = await this.prisma.carrier.findUnique({ where: { id: carrierId } });
    if (!carrier) throw new BadRequestException('Carrier not found');

    const before = await this.findOne(id);
    await this.prisma.order.update({ where: { id }, data: { carrierId } });

    await this.audit.log({
      userId: actor.id,
      action: 'ORDER_CARRIER_ASSIGNED',
      entityType: 'Order',
      entityId: id,
      previousValue: { carrierId: before.carrierId },
      newValue: { carrierId },
    });

    this.realtime.emit(RealtimeEvent.ORDER_UPDATED, { orderId: id, carrierId });
    return this.findOne(id);
  }

  async updateStatus(id: string, to: OrderStatus, actor: AuthenticatedUser) {
    const order = await this.findOne(id);

    assertValidTransition(order.status, to);
    assertRoleCanTransition(to, actor.role);

    if (actor.role === Role.OPERATOR && order.assignedOperatorId !== actor.id) {
      throw new ForbiddenException('This order is not assigned to you');
    }

    if (to === OrderStatus.SHIPPED && !order.carrierId) {
      throw new BadRequestException('Assign a carrier before shipping this order');
    }

    await this.prisma.$transaction(async (tx) => {
      if (to === OrderStatus.CANCELLED) {
        await this.inventory.releaseReservationsForOrder(tx, id);
      }

      await tx.order.update({
        where: { id },
        data: {
          status: to,
          ...(to === OrderStatus.DELIVERED && { deliveredAt: new Date() }),
        },
      });

      await tx.trackingEvent.create({
        data: { orderId: id, status: to, description: TRACKING_DESCRIPTIONS[to] },
      });

      if (to === OrderStatus.SHIPPED) {
        await tx.shipment.create({
          data: {
            orderId: id,
            carrierId: order.carrierId as string,
            trackingCode: generateTrackingCode(),
            estimatedDeliveryAt: order.estimatedDeliveryAt,
          },
        });
      }

      if (to === OrderStatus.DELIVERED) {
        await tx.shipment.update({ where: { orderId: id }, data: { deliveredAt: new Date() } });
      }

      await this.audit.log(
        {
          userId: actor.id,
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'Order',
          entityId: id,
          previousValue: { status: order.status },
          newValue: { status: to },
        },
        tx,
      );
    });

    this.realtime.emit(RealtimeEvent.ORDER_STATUS_CHANGED, { orderId: id, from: order.status, to });
    return this.findOne(id);
  }
}
