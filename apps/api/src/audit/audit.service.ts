import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

/**
 * Records an immutable trail of every important mutation. Accepts an
 * optional transaction client so a log entry commits atomically with the
 * change it describes (e.g. order status change) instead of as an
 * afterthought that could be silently lost.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, client: PrismaClient | Prisma.TransactionClient = this.prisma) {
    await client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValue: entry.previousValue as Prisma.InputJsonValue,
        newValue: entry.newValue as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }
}
