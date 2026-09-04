import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { CreateCarrierDto } from './dto/create-carrier.dto';

@Injectable()
export class CarriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const carriers = await this.prisma.carrier.findMany({ orderBy: { name: 'asc' } });
    const withPerformance = await Promise.all(
      carriers.map(async (carrier) => ({
        ...carrier,
        performance: await this.computePerformance(carrier.id),
      })),
    );
    return withPerformance.sort((a, b) => b.performance.successRate - a.performance.successRate);
  }

  async findOne(id: string) {
    const carrier = await this.prisma.carrier.findUnique({ where: { id } });
    if (!carrier) throw new NotFoundException('Carrier not found');
    return carrier;
  }

  async create(dto: CreateCarrierDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.carrier.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('A carrier with this name already exists');

    const carrier = await this.prisma.carrier.create({ data: { name: dto.name } });
    await this.audit.log({
      userId: actor.id,
      action: 'CARRIER_CREATED',
      entityType: 'Carrier',
      entityId: carrier.id,
      newValue: carrier,
    });
    return carrier;
  }

  async getPerformance(id: string) {
    const carrier = await this.findOne(id);
    return { carrier, ...(await this.computePerformance(id)) };
  }

  private async computePerformance(carrierId: string) {
    const shipments = await this.prisma.shipment.findMany({ where: { carrierId } });
    const totalShipped = shipments.length;
    const delivered = shipments.filter((s) => s.deliveredAt !== null);
    const now = new Date();

    const delayedDelivered = delivered.filter(
      (s) => s.estimatedDeliveryAt && s.deliveredAt && s.deliveredAt > s.estimatedDeliveryAt,
    );
    const delayedInTransit = shipments.filter(
      (s) => !s.deliveredAt && s.estimatedDeliveryAt && s.estimatedDeliveryAt < now,
    );
    const delayedCount = delayedDelivered.length + delayedInTransit.length;

    const avgDeliveryMs =
      delivered.length > 0
        ? delivered.reduce(
            (sum, s) => sum + (s.deliveredAt!.getTime() - s.shippedAt.getTime()),
            0,
          ) / delivered.length
        : null;

    return {
      totalShipped,
      delivered: delivered.length,
      delayed: delayedCount,
      avgDeliveryHours:
        avgDeliveryMs !== null ? Number((avgDeliveryMs / 3_600_000).toFixed(1)) : null,
      successRate:
        totalShipped > 0 ? Number(((delivered.length / totalShipped) * 100).toFixed(1)) : 0,
      delayRate: totalShipped > 0 ? Number(((delayedCount / totalShipped) * 100).toFixed(1)) : 0,
    };
  }
}
