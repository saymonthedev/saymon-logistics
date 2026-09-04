import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationMeta, PaginatedResult } from '../common/dto/pagination-query.dto';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('audit-logs')
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query() query: AuditLogQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.userId && { userId: query.userId }),
      ...(query.action && { action: { contains: query.action, mode: 'insensitive' as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, pageSize, total) };
  }
}
