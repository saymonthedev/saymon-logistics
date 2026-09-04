import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertSeverity, AlertStatus, AlertType, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway, RealtimeEvent } from '../realtime/realtime.gateway';
import { buildPaginationMeta, PaginatedResult } from '../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { AlertQueryDto } from './dto/alert-query.dto';

const STUCK_ORDER_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12h without a status change
const CARRIER_DELAY_MIN_SAMPLE = 5;
const CARRIER_DELAY_RATE_THRESHOLD = 30; // percent

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.RESERVED,
  OrderStatus.PICKING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
];

/**
 * Detects operational problems on a schedule instead of relying on someone
 * to notice a spreadsheet — this is the automation the challenge is really
 * asking for. Every rule is idempotent: it only opens a new Alert when no
 * OPEN one already exists for the same (type, entity), so a job running
 * every minute doesn't flood the alert center with duplicates.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async findAll(query: AlertQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AlertWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      ...(query.severity && { severity: query.severity }),
    };

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        include: { resolvedBy: { select: { id: true, name: true } } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.alert.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async resolve(id: string, actor: AuthenticatedUser) {
    const alert = await this.prisma.alert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.status === AlertStatus.RESOLVED) {
      throw new BadRequestException('Alert already resolved');
    }

    const resolved = await this.prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.RESOLVED, resolvedById: actor.id, resolvedAt: new Date() },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'ALERT_RESOLVED',
      entityType: 'Alert',
      entityId: id,
      previousValue: { status: alert.status },
      newValue: { status: resolved.status },
    });

    this.realtime.emit(RealtimeEvent.ALERT_RESOLVED, { id, type: alert.type });
    return resolved;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async detectOperationalIssues(): Promise<void> {
    await Promise.all([
      this.detectLowStock(),
      this.detectDelayedOrders(),
      this.detectStuckOrders(),
      this.detectCarrierDelays(),
    ]);
  }

  private async detectLowStock(): Promise<void> {
    const products = await this.prisma.product.findMany({ include: { inventory: true } });
    for (const product of products) {
      const available = product.inventory?.available ?? 0;
      if (available > product.minStock) continue;

      await this.raiseIfAbsent({
        type: AlertType.LOW_STOCK,
        severity: available === 0 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        message: `Estoque crítico para ${product.sku}: restam ${available} unidade(s) (mínimo ${product.minStock})`,
        entityType: 'Product',
        entityId: product.id,
      });
    }
  }

  private async detectDelayedOrders(): Promise<void> {
    const now = new Date();
    const delayed = await this.prisma.order.findMany({
      where: {
        status: { in: ACTIVE_ORDER_STATUSES },
        estimatedDeliveryAt: { lt: now },
      },
    });
    for (const order of delayed) {
      await this.raiseIfAbsent({
        type: AlertType.DELAYED_ORDER,
        severity: AlertSeverity.WARNING,
        message: `Pedido ${order.number} passou do prazo estimado de entrega`,
        entityType: 'Order',
        entityId: order.id,
      });
    }
  }

  private async detectStuckOrders(): Promise<void> {
    const threshold = new Date(Date.now() - STUCK_ORDER_THRESHOLD_MS);
    const stuck = await this.prisma.order.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES }, updatedAt: { lt: threshold } },
    });
    for (const order of stuck) {
      await this.raiseIfAbsent({
        type: AlertType.STUCK_ORDER,
        severity: AlertSeverity.WARNING,
        message: `Pedido ${order.number} está parado em ${order.status} há mais de 12h`,
        entityType: 'Order',
        entityId: order.id,
      });
    }
  }

  private async detectCarrierDelays(): Promise<void> {
    const carriers = await this.prisma.carrier.findMany({ include: { shipments: true } });
    const now = new Date();

    for (const carrier of carriers) {
      const total = carrier.shipments.length;
      if (total < CARRIER_DELAY_MIN_SAMPLE) continue;

      const delayed = carrier.shipments.filter((s) => {
        if (s.deliveredAt && s.estimatedDeliveryAt) return s.deliveredAt > s.estimatedDeliveryAt;
        if (!s.deliveredAt && s.estimatedDeliveryAt) return s.estimatedDeliveryAt < now;
        return false;
      }).length;

      const delayRate = (delayed / total) * 100;
      if (delayRate <= CARRIER_DELAY_RATE_THRESHOLD) continue;

      await this.raiseIfAbsent({
        type: AlertType.CARRIER_DELAY,
        severity: AlertSeverity.WARNING,
        message: `Transportadora ${carrier.name} com ${delayRate.toFixed(0)}% de atraso (${delayed}/${total} envios)`,
        entityType: 'Carrier',
        entityId: carrier.id,
      });
    }
  }

  private async raiseIfAbsent(input: {
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    entityType: string;
    entityId: string;
  }): Promise<void> {
    const existing = await this.prisma.alert.findFirst({
      where: {
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        status: AlertStatus.OPEN,
      },
    });
    if (existing) return;

    const alert = await this.prisma.alert.create({ data: input });
    this.realtime.emit(RealtimeEvent.ALERT_CREATED, alert);
  }
}
