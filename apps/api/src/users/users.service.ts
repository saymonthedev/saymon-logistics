import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildPaginationMeta, PaginatedResult } from '../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: UserQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: query.role }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortDir ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role },
      select: SAFE_SELECT,
    });

    await this.audit.log({
      userId: actor.id,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      newValue: user,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const before = await this.findOne(id);

    const data: Prisma.UserUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.active !== undefined && { active: dto.active }),
      ...(dto.password !== undefined && { passwordHash: await bcrypt.hash(dto.password, 10) }),
    };

    const user = await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });

    await this.audit.log({
      userId: actor.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      previousValue: before,
      newValue: user,
    });

    return user;
  }
}
