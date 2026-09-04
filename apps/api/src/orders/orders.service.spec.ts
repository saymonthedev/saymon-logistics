import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, PrismaClient, Role } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';

describe('OrdersService.updateStatus', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let audit: { log: jest.Mock };
  let inventory: { releaseReservationsForOrder: jest.Mock };
  let realtime: { emit: jest.Mock };
  let service: OrdersService;

  const supervisor: AuthenticatedUser = {
    id: 'sup-1',
    email: 's@saymon.com',
    name: 'Sup',
    role: Role.SUPERVISOR,
  };
  const operator: AuthenticatedUser = {
    id: 'op-1',
    email: 'o@saymon.com',
    name: 'Op',
    role: Role.OPERATOR,
  };

  function baseOrder(
    overrides: Partial<{
      status: OrderStatus;
      assignedOperatorId: string | null;
      carrierId: string | null;
    }> = {},
  ) {
    return {
      id: 'order-1',
      number: 'PED-1',
      status: OrderStatus.RECEIVED,
      assignedOperatorId: null,
      carrierId: null,
      estimatedDeliveryAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    audit = { log: jest.fn() };
    inventory = { releaseReservationsForOrder: jest.fn() };
    realtime = { emit: jest.fn() };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      inventory as unknown as InventoryService,
      realtime as unknown as RealtimeGateway,
    );
    prisma.$transaction.mockImplementation(
      (cb) => (cb as (tx: unknown) => unknown)(prisma) as never,
    );
  });

  it('rejects an invalid transition (RECEIVED -> DELIVERED) before touching the database', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ status: OrderStatus.RECEIVED }) as never);

    await expect(
      service.updateStatus('order-1', OrderStatus.DELIVERED, supervisor),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('applies a valid transition and records a tracking event', async () => {
    prisma.order.findUnique.mockResolvedValue(
      baseOrder({ status: OrderStatus.RESERVED, assignedOperatorId: operator.id }) as never,
    );

    await service.updateStatus('order-1', OrderStatus.PICKING, operator);

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.PICKING },
    });
    expect(prisma.trackingEvent.create).toHaveBeenCalledWith({
      data: { orderId: 'order-1', status: OrderStatus.PICKING, description: expect.any(String) },
    });
  });

  it('releases active reservations when an order is cancelled', async () => {
    prisma.order.findUnique.mockResolvedValue(baseOrder({ status: OrderStatus.RESERVED }) as never);

    await service.updateStatus('order-1', OrderStatus.CANCELLED, supervisor);

    expect(inventory.releaseReservationsForOrder).toHaveBeenCalledWith(prisma, 'order-1');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.CANCELLED },
    });
  });

  it('forbids a role from performing a transition reserved for supervisors (e.g. OPERATOR -> IN_TRANSIT)', async () => {
    prisma.order.findUnique.mockResolvedValue(
      baseOrder({ status: OrderStatus.SHIPPED, assignedOperatorId: operator.id }) as never,
    );

    await expect(service.updateStatus('order-1', OrderStatus.IN_TRANSIT, operator)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('forbids an operator from updating an order that is not assigned to them', async () => {
    prisma.order.findUnique.mockResolvedValue(
      baseOrder({ status: OrderStatus.RESERVED, assignedOperatorId: 'someone-else' }) as never,
    );

    await expect(service.updateStatus('order-1', OrderStatus.PICKING, operator)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('requires a carrier to be assigned before an order can be marked SHIPPED', async () => {
    prisma.order.findUnique.mockResolvedValue(
      baseOrder({
        status: OrderStatus.PACKED,
        assignedOperatorId: operator.id,
        carrierId: null,
      }) as never,
    );

    await expect(service.updateStatus('order-1', OrderStatus.SHIPPED, operator)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
