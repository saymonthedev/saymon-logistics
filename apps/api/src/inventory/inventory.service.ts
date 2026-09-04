import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway, RealtimeEvent } from '../realtime/realtime.gateway';
import { buildPaginationMeta, PaginatedResult } from '../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { InsufficientStockError } from './errors';

interface InventoryRow {
  id: string;
  productId: string;
  available: number;
  reserved: number;
}

/**
 * Owns every read/write to stock counters. All mutations take a row lock
 * (`SELECT ... FOR UPDATE`) inside a transaction before touching `available`
 * / `reserved`, so two operators reserving the same SKU at the same instant
 * are serialized by Postgres rather than racing in application memory. A DB
 * CHECK constraint (see migration `add_inventory_check_constraints`) is the
 * final backstop against a negative balance even if a bug slipped past this
 * layer.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async findAll(query: ProductQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = query.search
      ? {
          OR: [
            { sku: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { inventory: true },
        orderBy: { [query.sortBy ?? 'name']: query.sortDir ?? 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = query.belowMinStock
      ? rows.filter((p) => (p.inventory?.available ?? 0) <= p.minStock)
      : rows;

    return { data, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException(`Product ${sku} not found`);
    return product;
  }

  async createProduct(dto: CreateProductDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new ConflictException(`SKU ${dto.sku} already exists`);

    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        location: dto.location,
        minStock: dto.minStock ?? 0,
        inventory: { create: { available: dto.initialAvailable ?? 0, reserved: 0 } },
      },
      include: { inventory: true },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      newValue: product,
    });

    return product;
  }

  async updateProduct(sku: string, dto: UpdateProductDto, actor: AuthenticatedUser) {
    const before = await this.findBySku(sku);
    const product = await this.prisma.product.update({
      where: { sku },
      data: dto,
      include: { inventory: true },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: product.id,
      previousValue: before,
      newValue: product,
    });

    return product;
  }

  /** Manual stock movement (receiving, cycle-count correction, damage write-off). */
  async adjustStock(
    sku: string,
    delta: number,
    reason: string | undefined,
    actor: AuthenticatedUser,
  ) {
    const product = await this.findBySku(sku);

    const updated = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<InventoryRow[]>(
        Prisma.sql`SELECT * FROM "Inventory" WHERE "productId" = ${product.id} FOR UPDATE`,
      );
      const newAvailable = (row?.available ?? 0) + delta;
      if (newAvailable < 0) {
        throw new ConflictException(
          `Adjustment would make available stock negative (current ${row?.available ?? 0}, delta ${delta})`,
        );
      }
      return tx.inventory.update({
        where: { productId: product.id },
        data: { available: newAvailable },
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: 'STOCK_ADJUSTED',
      entityType: 'Product',
      entityId: product.id,
      previousValue: { available: product.inventory?.available },
      newValue: { available: updated.available, delta, reason },
    });

    this.realtime.emit(RealtimeEvent.INVENTORY_UPDATED, { sku, ...updated });
    await this.checkAndEmitLowStock(product.id, sku, product.minStock, updated.available);

    return { ...product, inventory: updated };
  }

  /**
   * Core reservation primitive. Locks every affected Inventory row (in a
   * deterministic productId order, to prevent two concurrent multi-item
   * reservations from deadlocking each other) and either commits all
   * decrements or throws before touching anything — an order is never
   * partially reserved.
   *
   * Always called inside a transaction owned by the caller (OrdersService
   * for order-level reservation, or `reserve()` below for the standalone
   * per-SKU endpoint) so it can be composed with other writes atomically.
   */
  async applyReservation(
    tx: Prisma.TransactionClient,
    items: { productId: string; quantity: number }[],
    orderId: string,
  ): Promise<void> {
    const aggregated = new Map<string, number>();
    for (const item of items) {
      aggregated.set(item.productId, (aggregated.get(item.productId) ?? 0) + item.quantity);
    }
    const productIds = [...aggregated.keys()].sort();
    if (productIds.length === 0) return;

    const rows = await tx.$queryRaw<InventoryRow[]>(
      Prisma.sql`SELECT * FROM "Inventory" WHERE "productId" IN (${Prisma.join(productIds)}) ORDER BY "productId" ASC FOR UPDATE`,
    );
    const bySku = new Map(rows.map((r) => [r.productId, r]));

    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));

    const shortages = productIds
      .map((productId) => {
        const requested = aggregated.get(productId) as number;
        const available = bySku.get(productId)?.available ?? 0;
        return {
          productId,
          sku: productById.get(productId)?.sku ?? productId,
          requested,
          available,
        };
      })
      .filter((s) => s.available < s.requested);

    if (shortages.length > 0) {
      throw new InsufficientStockError(shortages);
    }

    for (const productId of productIds) {
      const quantity = aggregated.get(productId) as number;
      await tx.inventory.update({
        where: { productId },
        data: { available: { decrement: quantity }, reserved: { increment: quantity } },
      });
      await tx.inventoryReservation.create({
        data: { productId, orderId, quantity, status: 'ACTIVE' },
      });
    }
  }

  /** Standalone reservation endpoint (`POST /inventory/:sku/reserve`) outside the order flow. */
  async reserve(
    sku: string,
    quantity: number,
    orderId: string | undefined,
    actor: AuthenticatedUser,
  ) {
    const product = await this.findBySku(sku);
    if (!orderId) {
      throw new BadRequestException('orderId is required to attribute this reservation');
    }

    try {
      await this.prisma.$transaction((tx) =>
        this.applyReservation(tx, [{ productId: product.id, quantity }], orderId),
      );
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        await this.audit.log({
          userId: actor.id,
          action: 'RESERVATION_FAILED',
          entityType: 'Product',
          entityId: product.id,
          newValue: { sku, quantity, orderId },
        });
        throw new ConflictException(err.message);
      }
      throw err;
    }

    const updated = await this.findBySku(sku);
    this.realtime.emit(RealtimeEvent.INVENTORY_UPDATED, { sku, ...updated.inventory });
    await this.checkAndEmitLowStock(
      product.id,
      sku,
      product.minStock,
      updated.inventory?.available ?? 0,
    );
    return updated;
  }

  /** Returns previously-reserved (never picked) stock to the available pool. Idempotent. */
  async releaseReservationsForOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const active = await tx.inventoryReservation.findMany({ where: { orderId, status: 'ACTIVE' } });
    for (const reservation of active) {
      await tx.inventory.update({
        where: { productId: reservation.productId },
        data: {
          available: { increment: reservation.quantity },
          reserved: { decrement: reservation.quantity },
        },
      });
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: 'RELEASED' },
      });
    }
  }

  /**
   * Called when a picking task finishes: the reserved stock has now
   * physically left the shelf, so it comes out of `reserved` for good
   * (rather than back into `available`). Consumes exactly the ledger total
   * for this wave+product, not the task's nominal quantity, so the
   * Inventory counters can never drift from the reservation ledger.
   */
  async consumeForPickingTask(
    tx: Prisma.TransactionClient,
    waveId: string,
    productId: string,
  ): Promise<number> {
    const reservations = await tx.inventoryReservation.findMany({
      where: { productId, status: 'ACTIVE', order: { pickingWaveId: waveId } },
    });
    const total = reservations.reduce((sum, r) => sum + r.quantity, 0);
    if (reservations.length > 0) {
      await tx.inventoryReservation.updateMany({
        where: { id: { in: reservations.map((r) => r.id) } },
        data: { status: 'CONSUMED' },
      });
    }
    if (total > 0) {
      await tx.inventory.update({ where: { productId }, data: { reserved: { decrement: total } } });
    }
    return total;
  }

  private async checkAndEmitLowStock(
    productId: string,
    sku: string,
    minStock: number,
    available: number,
  ) {
    if (available <= minStock) {
      this.realtime.emit(RealtimeEvent.INVENTORY_UPDATED, {
        sku,
        lowStock: true,
        available,
        minStock,
      });
    }
  }
}
