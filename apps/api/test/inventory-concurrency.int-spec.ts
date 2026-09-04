import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { RealtimeGateway } from '../src/realtime/realtime.gateway';
import { InventoryService } from '../src/inventory/inventory.service';
import { InsufficientStockError } from '../src/inventory/errors';

/**
 * Exercises real Postgres row locking — the guarantee a mocked Prisma client
 * can't prove. Requires DATABASE_URL to point at a running Postgres (see
 * jest.integration.config.js / docker-compose.yml).
 */
describe('Inventory reservation under real concurrency', () => {
  const prisma = new PrismaClient() as unknown as PrismaService;
  const audit = new AuditService(prisma);
  const silentGateway = { emit: () => undefined } as unknown as RealtimeGateway;
  const inventory = new InventoryService(prisma, audit, silentGateway);

  let productId: string;
  let createdOrderIds: string[];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    createdOrderIds = [];
    const product = await prisma.product.create({
      data: {
        sku: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: 'Integration test product',
        minStock: 0,
        inventory: { create: { available: 10, reserved: 0 } },
      },
    });
    productId = product.id;
  });

  // Deletes in FK-safe order: reservations reference orders, orders and
  // inventory reference the product.
  afterEach(async () => {
    await prisma.inventoryReservation.deleteMany({ where: { productId } });
    await prisma.orderItem.deleteMany({ where: { productId } });
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  });

  async function makeOrder(): Promise<string> {
    const order = await prisma.order.create({
      data: {
        number: `PED-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        customerName: 'Integration Test Customer',
        deliveryAddress: 'N/A',
        totalValue: 0,
      },
    });
    createdOrderIds.push(order.id);
    return order.id;
  }

  it('reserves stock immediately when there is enough available', async () => {
    const orderId = await makeOrder();

    await prisma.$transaction((tx) =>
      inventory.applyReservation(tx, [{ productId, quantity: 6 }], orderId),
    );

    const row = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(row.available).toBe(4);
    expect(row.reserved).toBe(6);
  });

  it('rejects a reservation that exceeds available stock, leaving stock untouched', async () => {
    const orderId = await makeOrder();

    await expect(
      prisma.$transaction((tx) =>
        inventory.applyReservation(tx, [{ productId, quantity: 11 }], orderId),
      ),
    ).rejects.toThrow(InsufficientStockError);

    const row = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(row.available).toBe(10);
    expect(row.reserved).toBe(0);
  });

  it('serializes two simultaneous reservations for the same SKU so stock never goes negative', async () => {
    // 10 available; two operators each try to reserve 7 at the same instant (14 total demanded).
    // Row-level locking must serialize them: exactly one succeeds, the other is rejected
    // for insufficient stock — it must never see "7 available" from a stale read.
    const [orderA, orderB] = await Promise.all([makeOrder(), makeOrder()]);

    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        inventory.applyReservation(tx, [{ productId, quantity: 7 }], orderA),
      ),
      prisma.$transaction((tx) =>
        inventory.applyReservation(tx, [{ productId, quantity: 7 }], orderB),
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    const row = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(row.available).toBe(3); // 10 - 7, never negative
    expect(row.reserved).toBe(7);
  });

  it('serializes many concurrent reservations for the same SKU without ever overselling', async () => {
    // 10 available; ten operators each grab 2 at once (20 total demanded) — only 5 can win.
    const orderIds = await Promise.all(Array.from({ length: 10 }, () => makeOrder()));

    const results = await Promise.allSettled(
      orderIds.map((orderId) =>
        prisma.$transaction((tx) =>
          inventory.applyReservation(tx, [{ productId, quantity: 2 }], orderId),
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBe(5);

    const row = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(row.available).toBe(0);
    expect(row.reserved).toBe(10);
    expect(row.available).toBeGreaterThanOrEqual(0);
  });

  it('the database itself rejects a write that would drive available stock negative (CHECK constraint)', async () => {
    await expect(
      prisma.$executeRaw`UPDATE "Inventory" SET available = -1 WHERE "productId" = ${productId}`,
    ).rejects.toThrow();

    const row = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(row.available).toBe(10);
  });
});
