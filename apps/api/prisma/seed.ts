import { PrismaClient, Role, OrderStatus, OrderPriority } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Fixed dev-only credentials — never used outside local/demo seeding. */
const DEMO_PASSWORD = 'adminroot';

const PRODUCTS = [
  { sku: 'CAM-001', name: 'Camiseta Básica P', location: 'A-01-01', minStock: 20, available: 84 },
  { sku: 'CAM-002', name: 'Camiseta Básica M', location: 'A-01-02', minStock: 20, available: 60 },
  { sku: 'CAM-003', name: 'Camiseta Básica G', location: 'A-01-03', minStock: 20, available: 7 },
  { sku: 'CAL-010', name: 'Calça Jeans 38', location: 'A-02-01', minStock: 15, available: 45 },
  { sku: 'CAL-011', name: 'Calça Jeans 40', location: 'A-02-02', minStock: 15, available: 12 },
  { sku: 'TEN-100', name: 'Tênis Esportivo 40', location: 'B-01-01', minStock: 10, available: 30 },
  { sku: 'TEN-101', name: 'Tênis Esportivo 42', location: 'B-01-02', minStock: 10, available: 3 },
  { sku: 'MOC-200', name: 'Mochila Urbana', location: 'B-02-01', minStock: 5, available: 22 },
  { sku: 'BON-300', name: 'Boné Aba Reta', location: 'C-01-01', minStock: 10, available: 40 },
  { sku: 'MEI-400', name: 'Meia Cano Alto (par)', location: 'C-02-01', minStock: 30, available: 90 },
];

const CARRIERS = ['TransLog Express', 'RapidoVia', 'Correios Comercial'];

function randomOrderNumber(): string {
  return `PED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function randomTrackingCode(): string {
  return `TRK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: { name: 'Administrador', email: 'admin@admin.com', passwordHash, role: Role.ADMIN },
  });

  const carriers = await Promise.all(
    CARRIERS.map((name) => prisma.carrier.upsert({ where: { name }, update: {}, create: { name } })),
  );

  const products = await Promise.all(
    PRODUCTS.map((p) =>
      prisma.product.upsert({
        where: { sku: p.sku },
        update: {},
        create: {
          sku: p.sku,
          name: p.name,
          location: p.location,
          minStock: p.minStock,
          inventory: { create: { available: p.available, reserved: 0 } },
        },
      }),
    ),
  );

  const existingOrders = await prisma.order.count();
  if (existingOrders > 0) {
    console.log(`Skipping demo orders — ${existingOrders} already exist.`);
    console.log('Seed complete.');
    console.log(`Login de demonstração: ${admin.email} / senha "${DEMO_PASSWORD}"`);
    return;
  }

  const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  const customers = [
    { name: 'Loja Vitrine Ltda', email: 'compras@vitrine.com', address: 'Rua das Flores, 123 - São Paulo/SP' },
    { name: 'Comércio Bela Vista', email: 'pedidos@belavista.com', address: 'Av. Brasil, 456 - Curitiba/PR' },
    { name: 'Mercado Central', email: 'contato@mercadocentral.com', address: 'Rua XV de Novembro, 789 - Porto Alegre/RS' },
    { name: 'E-commerce Rápido', email: 'financeiro@ecomrapido.com', address: 'Av. Paulista, 1000 - São Paulo/SP' },
    { name: 'Outlet da Cidade', email: 'compras@outletcidade.com', address: 'Rua do Comércio, 55 - Belo Horizonte/MG' },
  ];

  type SeedOrder = {
    status: OrderStatus;
    createdHoursAgo: number;
    withCarrier: boolean;
    delayed?: boolean;
  };

  const plan: SeedOrder[] = [
    ...Array.from({ length: 6 }, () => ({ status: OrderStatus.RECEIVED, createdHoursAgo: randomInt(0, 8), withCarrier: false })),
    ...Array.from({ length: 8 }, () => ({ status: OrderStatus.RESERVED, createdHoursAgo: randomInt(1, 20), withCarrier: false })),
    ...Array.from({ length: 5 }, () => ({ status: OrderStatus.PICKING, createdHoursAgo: randomInt(2, 24), withCarrier: false })),
    ...Array.from({ length: 4 }, () => ({ status: OrderStatus.PACKED, createdHoursAgo: randomInt(3, 30), withCarrier: true })),
    ...Array.from({ length: 5 }, () => ({ status: OrderStatus.SHIPPED, createdHoursAgo: randomInt(6, 48), withCarrier: true })),
    ...Array.from({ length: 6 }, () => ({ status: OrderStatus.IN_TRANSIT, createdHoursAgo: randomInt(8, 60), withCarrier: true, delayed: true })),
    ...Array.from({ length: 12 }, () => ({ status: OrderStatus.DELIVERED, createdHoursAgo: randomInt(24, 200), withCarrier: true })),
    ...Array.from({ length: 2 }, () => ({ status: OrderStatus.CANCELLED, createdHoursAgo: randomInt(10, 100), withCarrier: false })),
  ];

  const statusOrder: OrderStatus[] = [
    OrderStatus.RECEIVED,
    OrderStatus.RESERVED,
    OrderStatus.PICKING,
    OrderStatus.PACKED,
    OrderStatus.SHIPPED,
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
  ];
  const trackingLabels: Record<OrderStatus, string> = {
    RECEIVED: 'Pedido recebido',
    RESERVED: 'Estoque reservado',
    PICKING: 'Separação iniciada',
    PACKED: 'Pedido embalado',
    SHIPPED: 'Pedido expedido',
    IN_TRANSIT: 'Saiu para entrega',
    DELIVERED: 'Pedido entregue',
    CANCELLED: 'Pedido cancelado',
  };

  for (const seedOrder of plan) {
    const customer = pick(customers);
    const orderProducts = [...products].sort(() => 0.5 - Math.random()).slice(0, randomInt(1, 3));
    const createdAt = hoursAgo(seedOrder.createdHoursAgo);
    const priority = pick([
      OrderPriority.LOW,
      OrderPriority.NORMAL,
      OrderPriority.NORMAL,
      OrderPriority.HIGH,
      OrderPriority.URGENT,
    ]);

    const items = orderProducts.map((p) => ({
      productId: p.id,
      quantity: randomInt(1, 5),
      unitPrice: randomInt(20, 300),
    }));
    const totalValue = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    const estimatedDeliveryAt = seedOrder.delayed
      ? hoursAgo(-randomInt(1, 12)) // in the past relative to "now" -> already overdue
      : new Date(createdAt.getTime() + randomInt(24, 96) * 60 * 60 * 1000);

    const carrier = seedOrder.withCarrier ? pick(carriers) : null;

    const order = await prisma.order.create({
      data: {
        number: randomOrderNumber(),
        customerName: customer.name,
        customerEmail: customer.email,
        deliveryAddress: customer.address,
        status: seedOrder.status,
        priority,
        totalValue,
        carrierId: carrier?.id,
        estimatedDeliveryAt,
        deliveredAt: seedOrder.status === OrderStatus.DELIVERED ? hoursAgo(randomInt(0, 12)) : null,
        createdAt,
        items: { create: items },
      },
    });

    // Tracking timeline up to the order's current status.
    const upTo = statusOrder.indexOf(seedOrder.status);
    const timeline = seedOrder.status === OrderStatus.CANCELLED
      ? [OrderStatus.RECEIVED, OrderStatus.CANCELLED]
      : statusOrder.slice(0, upTo + 1);

    let eventTime = createdAt;
    for (const status of timeline) {
      await prisma.trackingEvent.create({
        data: { orderId: order.id, status, description: trackingLabels[status], createdAt: eventTime },
      });
      eventTime = new Date(eventTime.getTime() + randomInt(15, 90) * 60 * 1000);
    }

    // Reservations for any order that passed through RESERVED.
    if (statusOrder.indexOf(seedOrder.status) >= statusOrder.indexOf(OrderStatus.RESERVED)) {
      const consumed = statusOrder.indexOf(seedOrder.status) >= statusOrder.indexOf(OrderStatus.PICKING);
      for (const item of items) {
        await prisma.inventoryReservation.create({
          data: {
            productId: item.productId,
            orderId: order.id,
            quantity: item.quantity,
            status: consumed ? 'CONSUMED' : 'ACTIVE',
          },
        });
        if (!consumed) {
          await prisma.inventory.update({
            where: { productId: item.productId },
            data: { reserved: { increment: item.quantity } },
          });
        }
      }
    }

    // Shipment record for anything that has left the building.
    if (statusOrder.indexOf(seedOrder.status) >= statusOrder.indexOf(OrderStatus.SHIPPED) && carrier) {
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          carrierId: carrier.id,
          trackingCode: randomTrackingCode(),
          shippedAt: hoursAgo(seedOrder.createdHoursAgo - 4 > 0 ? seedOrder.createdHoursAgo - 4 : 1),
          estimatedDeliveryAt,
          deliveredAt: seedOrder.status === OrderStatus.DELIVERED ? hoursAgo(randomInt(0, 12)) : null,
        },
      });
    }
  }

  // A couple of open alerts so the Alert Center isn't empty on first load.
  const criticalProduct = products.find((p) => p.sku === 'CAM-003');
  if (criticalProduct) {
    await prisma.alert.create({
      data: {
        type: 'LOW_STOCK',
        severity: 'WARNING',
        message: `Estoque crítico para ${criticalProduct.sku}: restam poucas unidades`,
        entityType: 'Product',
        entityId: criticalProduct.id,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`Login de demonstração: ${admin.email} / senha "${DEMO_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
