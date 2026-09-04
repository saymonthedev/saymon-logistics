import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PickingTaskStatus, PickingWaveStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { RealtimeGateway, RealtimeEvent } from '../realtime/realtime.gateway';
import { buildPaginationMeta, PaginatedResult } from '../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { TRACKING_DESCRIPTIONS, assertValidTransition } from '../orders/order-status.util';
import { CreatePickingWaveDto } from './dto/create-picking-wave.dto';
import { PickingWaveQueryDto } from './dto/picking-wave-query.dto';
import { PickingTaskQueryDto } from './dto/picking-task-query.dto';
import { generateWaveCode } from './generate-wave-code.util';

const WAVE_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  orders: { select: { id: true, number: true, customerName: true, status: true, priority: true } },
  tasks: {
    include: {
      product: { select: { id: true, sku: true, name: true, location: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.PickingWaveInclude;

@Injectable()
export class PickingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async findAllWaves(query: PickingWaveQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PickingWaveWhereInput = {
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.pickingWave.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { orders: true, tasks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pickingWave.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async findWave(id: string) {
    const wave = await this.prisma.pickingWave.findUnique({ where: { id }, include: WAVE_INCLUDE });
    if (!wave) throw new NotFoundException('Picking wave not found');
    return wave;
  }

  /**
   * Groups the line items of every selected order by product, so instead of
   * picking order-by-order an operator works one SKU at a time across the
   * whole wave (Product A -> 42 units, ...) — the actual point of batching.
   */
  async createWave(dto: CreatePickingWaveDto, actor: AuthenticatedUser) {
    const orderIds = [...new Set(dto.orderIds)];

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { items: true },
    });
    if (orders.length !== orderIds.length) {
      throw new BadRequestException('One or more orders do not exist');
    }
    const notReady = orders.filter((o) => o.status !== OrderStatus.RESERVED);
    if (notReady.length > 0) {
      throw new BadRequestException(
        `Orders must be RESERVED (stock already set aside) to enter a picking wave: ${notReady
          .map((o) => o.number)
          .join(', ')}`,
      );
    }
    const alreadyWaved = orders.filter((o) => o.pickingWaveId !== null);
    if (alreadyWaved.length > 0) {
      throw new BadRequestException(
        `Orders already belong to a wave: ${alreadyWaved.map((o) => o.number).join(', ')}`,
      );
    }

    const aggregated = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        aggregated.set(item.productId, (aggregated.get(item.productId) ?? 0) + item.quantity);
      }
    }

    const wave = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pickingWave.create({
        data: {
          code: generateWaveCode(),
          createdById: actor.id,
          orders: { connect: orderIds.map((id) => ({ id })) },
          tasks: {
            create: [...aggregated.entries()].map(([productId, quantity]) => ({
              productId,
              quantity,
            })),
          },
        },
      });

      for (const order of orders) {
        assertValidTransition(order.status, OrderStatus.PICKING);
        await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PICKING } });
        await tx.trackingEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.PICKING,
            description: TRACKING_DESCRIPTIONS.PICKING,
          },
        });
      }

      await this.audit.log(
        {
          userId: actor.id,
          action: 'PICKING_WAVE_CREATED',
          entityType: 'PickingWave',
          entityId: created.id,
          newValue: { code: created.code, orderIds, skus: aggregated.size },
        },
        tx,
      );

      return created;
    });

    this.realtime.emit(RealtimeEvent.WAVE_CREATED, {
      id: wave.id,
      code: wave.code,
      orders: orderIds.length,
      skus: aggregated.size,
    });

    return this.findWave(wave.id);
  }

  async findAllTasks(query: PickingTaskQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.PickingTaskWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.waveId && { waveId: query.waveId }),
      ...(query.assignedToId && { assignedToId: query.assignedToId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.pickingTask.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true, location: true } },
          assignedTo: { select: { id: true, name: true } },
          wave: { select: { id: true, code: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pickingTask.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async assignTask(taskId: string, operatorId: string, actor: AuthenticatedUser) {
    const task = await this.getTaskOrThrow(taskId);
    if (task.status === PickingTaskStatus.COMPLETED) {
      throw new BadRequestException('Task already completed');
    }

    const operator = await this.prisma.user.findUnique({ where: { id: operatorId } });
    if (!operator || !operator.active)
      throw new BadRequestException('Operator not found or inactive');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.pickingTask.update({
        where: { id: taskId },
        data: { assignedToId: operatorId, status: PickingTaskStatus.IN_PROGRESS },
      });
      await this.ensureWaveInProgress(tx, task.waveId);
      return result;
    });

    await this.audit.log({
      userId: actor.id,
      action: 'PICKING_TASK_ASSIGNED',
      entityType: 'PickingTask',
      entityId: taskId,
      previousValue: { assignedToId: task.assignedToId },
      newValue: { assignedToId: operatorId },
    });

    this.realtime.emit(RealtimeEvent.TASK_UPDATED, {
      taskId,
      waveId: task.waveId,
      assignedToId: operatorId,
    });
    return updated;
  }

  /**
   * Marks one product's picking work for the wave as done. Consumes exactly
   * the ledgered reservation quantity (via InventoryService), never the
   * task's nominal quantity, so Inventory.reserved can't drift from the
   * InventoryReservation ledger even if the two ever disagree.
   */
  async completeTask(taskId: string, actor: AuthenticatedUser) {
    const task = await this.getTaskOrThrow(taskId);
    if (task.status === PickingTaskStatus.COMPLETED) {
      throw new BadRequestException('Task already completed');
    }
    if (task.assignedToId && task.assignedToId !== actor.id && actor.role === Role.OPERATOR) {
      throw new ForbiddenException('This task is assigned to a different operator');
    }

    const waveCompleted = await this.prisma.$transaction(async (tx) => {
      await this.ensureWaveInProgress(tx, task.waveId);
      const consumed = await this.inventory.consumeForPickingTask(tx, task.waveId, task.productId);

      await tx.pickingTask.update({
        where: { id: taskId },
        data: {
          status: PickingTaskStatus.COMPLETED,
          completedAt: new Date(),
          assignedToId: task.assignedToId ?? actor.id,
        },
      });

      await this.audit.log(
        {
          userId: actor.id,
          action: 'PICKING_TASK_COMPLETED',
          entityType: 'PickingTask',
          entityId: taskId,
          previousValue: { status: task.status },
          newValue: { status: PickingTaskStatus.COMPLETED, consumedUnits: consumed },
        },
        tx,
      );

      const remaining = await tx.pickingTask.count({
        where: { waveId: task.waveId, status: { not: PickingTaskStatus.COMPLETED } },
      });
      if (remaining === 0) {
        await tx.pickingWave.update({
          where: { id: task.waveId },
          data: { status: PickingWaveStatus.COMPLETED, completedAt: new Date() },
        });
        return true;
      }
      return false;
    });

    this.realtime.emit(RealtimeEvent.TASK_UPDATED, {
      taskId,
      waveId: task.waveId,
      status: PickingTaskStatus.COMPLETED,
    });
    if (waveCompleted) {
      this.realtime.emit(RealtimeEvent.WAVE_UPDATED, {
        id: task.waveId,
        status: PickingWaveStatus.COMPLETED,
      });
    }

    return this.getTaskOrThrow(taskId);
  }

  private async ensureWaveInProgress(tx: Prisma.TransactionClient, waveId: string): Promise<void> {
    const wave = await tx.pickingWave.findUnique({ where: { id: waveId } });
    if (wave?.status === PickingWaveStatus.OPEN) {
      await tx.pickingWave.update({
        where: { id: waveId },
        data: { status: PickingWaveStatus.IN_PROGRESS },
      });
    }
  }

  private async getTaskOrThrow(id: string) {
    const task = await this.prisma.pickingTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Picking task not found');
    return task;
  }
}
