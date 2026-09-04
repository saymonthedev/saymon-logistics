import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { InventoryService } from './inventory.service';
import { InsufficientStockError } from './errors';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';

describe('InventoryService.applyReservation', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let audit: { log: jest.Mock };
  let realtime: { emit: jest.Mock };
  let service: InventoryService;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    audit = { log: jest.fn() };
    realtime = { emit: jest.fn() };
    service = new InventoryService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      realtime as unknown as RealtimeGateway,
    );
  });

  it('reserves stock when enough is available (decrements available, increments reserved)', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'inv-1', productId: 'prod-1', available: 10, reserved: 0 },
    ]);
    prisma.product.findMany.mockResolvedValueOnce([{ id: 'prod-1', sku: 'SKU-1' } as never]);

    await service.applyReservation(prisma, [{ productId: 'prod-1', quantity: 4 }], 'order-1');

    expect(prisma.inventory.update).toHaveBeenCalledWith({
      where: { productId: 'prod-1' },
      data: { available: { decrement: 4 }, reserved: { increment: 4 } },
    });
    expect(prisma.inventoryReservation.create).toHaveBeenCalledWith({
      data: { productId: 'prod-1', orderId: 'order-1', quantity: 4, status: 'ACTIVE' },
    });
  });

  it('throws InsufficientStockError and leaves stock untouched when demand exceeds availability', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'inv-1', productId: 'prod-1', available: 2, reserved: 0 },
    ]);
    prisma.product.findMany.mockResolvedValueOnce([{ id: 'prod-1', sku: 'SKU-1' } as never]);

    await expect(
      service.applyReservation(prisma, [{ productId: 'prod-1', quantity: 5 }], 'order-1'),
    ).rejects.toThrow(InsufficientStockError);

    expect(prisma.inventory.update).not.toHaveBeenCalled();
    expect(prisma.inventoryReservation.create).not.toHaveBeenCalled();
  });

  it('never lets the reservation proceed when multiple lines for the same SKU exceed stock in aggregate', async () => {
    // 3 + 3 = 6 requested against 5 available: each line looks fine alone, only the sum is unsafe.
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'inv-1', productId: 'prod-1', available: 5, reserved: 0 },
    ]);
    prisma.product.findMany.mockResolvedValueOnce([{ id: 'prod-1', sku: 'SKU-1' } as never]);

    await expect(
      service.applyReservation(
        prisma,
        [
          { productId: 'prod-1', quantity: 3 },
          { productId: 'prod-1', quantity: 3 },
        ],
        'order-1',
      ),
    ).rejects.toThrow(InsufficientStockError);

    expect(prisma.inventory.update).not.toHaveBeenCalled();
  });

  it('locks every affected row with SELECT ... FOR UPDATE before deciding whether stock is sufficient', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'inv-1', productId: 'prod-1', available: 10, reserved: 0 },
    ]);
    prisma.product.findMany.mockResolvedValueOnce([{ id: 'prod-1', sku: 'SKU-1' } as never]);

    await service.applyReservation(prisma, [{ productId: 'prod-1', quantity: 1 }], 'order-1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const [sqlFragment] = prisma.$queryRaw.mock.calls[0] as unknown as [{ strings: string[] }];
    expect(sqlFragment.strings.join('')).toContain('FOR UPDATE');
  });
});
