import { Injectable } from '@nestjs/common';
import { OrderStatus, PickingTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.RESERVED,
  OrderStatus.PICKING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.IN_TRANSIT,
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Aggregates everything the operations dashboard needs into one call, so the
 * frontend renders the control-room view with a single request instead of
 * waterfalling a dozen list endpoints.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const todayStart = startOfToday();
    const now = new Date();

    const [
      receivedToday,
      deliveredToday,
      pickingOrders,
      inTransitCount,
      delayedOrders,
      criticalStockProducts,
      deliveredWithEstimate,
      ordersToday,
      statusGroups,
      carriers,
      topPicked,
    ] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.count({ where: { deliveredAt: { gte: todayStart } } }),
      this.prisma.order.findMany({
        where: { status: OrderStatus.PICKING },
        include: { pickingWave: { select: { status: true } } },
      }),
      this.prisma.order.count({
        where: { status: { in: [OrderStatus.SHIPPED, OrderStatus.IN_TRANSIT] } },
      }),
      this.prisma.order.count({
        where: { status: { in: ACTIVE_ORDER_STATUSES }, estimatedDeliveryAt: { lt: now } },
      }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count FROM "Product" p
        JOIN "Inventory" i ON i."productId" = p.id
        WHERE i.available <= p."minStock"
      `,
      this.prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, estimatedDeliveryAt: { not: null } },
        select: { estimatedDeliveryAt: true, deliveredAt: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: todayStart } },
        select: { createdAt: true },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.carrier.findMany({ include: { shipments: true } }),
      this.prisma.pickingTask.groupBy({
        by: ['productId'],
        where: { status: PickingTaskStatus.COMPLETED },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    const picking = pickingOrders.filter((o) => o.pickingWave?.status !== 'COMPLETED').length;
    const awaitingPackaging = pickingOrders.filter(
      (o) => o.pickingWave?.status === 'COMPLETED',
    ).length;

    const onTime = deliveredWithEstimate.filter(
      (o) => o.deliveredAt && o.estimatedDeliveryAt && o.deliveredAt <= o.estimatedDeliveryAt,
    ).length;
    const onTimeDeliveryRate =
      deliveredWithEstimate.length > 0
        ? Number(((onTime / deliveredWithEstimate.length) * 100).toFixed(1))
        : null;

    const ordersByHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: ordersToday.filter((o) => o.createdAt.getHours() === hour).length,
    }));

    const ordersByStatus = statusGroups.map((g) => ({ status: g.status, count: g._count._all }));

    const carriersById = new Map(carriers.map((c) => [c.id, c]));
    const ordersByCarrierRaw = await this.prisma.order.groupBy({
      by: ['carrierId'],
      _count: { _all: true },
    });
    const ordersByCarrier = ordersByCarrierRaw.map((g) => ({
      carrierId: g.carrierId,
      carrierName: g.carrierId
        ? (carriersById.get(g.carrierId)?.name ?? 'Desconhecida')
        : 'Sem transportadora',
      count: g._count._all,
    }));

    const delayRateByCarrier = carriers
      .filter((c) => c.shipments.length > 0)
      .map((c) => {
        const total = c.shipments.length;
        const delayed = c.shipments.filter((s) => {
          if (s.deliveredAt && s.estimatedDeliveryAt) return s.deliveredAt > s.estimatedDeliveryAt;
          if (!s.deliveredAt && s.estimatedDeliveryAt) return s.estimatedDeliveryAt < now;
          return false;
        }).length;
        return {
          carrierId: c.id,
          carrierName: c.name,
          delayRate: Number(((delayed / total) * 100).toFixed(1)),
        };
      });

    const productIds = topPicked.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));
    const topPickedProducts = topPicked.map((p) => ({
      productId: p.productId,
      sku: productsById.get(p.productId)?.sku ?? p.productId,
      name: productsById.get(p.productId)?.name ?? 'Produto removido',
      quantity: p._sum.quantity ?? 0,
    }));

    return {
      summary: {
        receivedToday,
        picking,
        awaitingPackaging,
        inTransit: inTransitCount,
        deliveredToday,
        delayedOrders,
        criticalStock: Number(criticalStockProducts[0]?.count ?? 0),
        onTimeDeliveryRate,
      },
      charts: {
        ordersByHour,
        ordersByStatus,
        ordersByCarrier,
        topPickedProducts,
        delayRateByCarrier,
      },
    };
  }
}
