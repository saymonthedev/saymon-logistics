import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderPriorityDto } from './dto/update-order-priority.dto';
import { BulkUpdatePriorityDto } from './dto/bulk-update-priority.dto';
import { AssignCarrierDto, AssignOperatorDto } from './dto/assign-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll(query);
  }

  // Registered before ':id/*' routes so "bulk" is never captured as an id.
  @Patch('bulk/priority')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  bulkUpdatePriority(@Body() dto: BulkUpdatePriorityDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.ordersService.bulkUpdatePriority(dto.orderIds, dto.priority, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  create(@Body() dto: CreateOrderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.ordersService.create(dto, actor);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ordersService.updateStatus(id, dto.status, actor);
  }

  @Patch(':id/priority')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  updatePriority(
    @Param('id') id: string,
    @Body() dto: UpdateOrderPriorityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ordersService.updatePriority(id, dto, actor);
  }

  @Patch(':id/reserve')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  retryReservation(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.ordersService.retryReservation(id, actor);
  }

  @Patch(':id/assign-operator')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  assignOperator(
    @Param('id') id: string,
    @Body() dto: AssignOperatorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ordersService.assignOperator(id, dto.operatorId, actor);
  }

  @Patch(':id/carrier')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  assignCarrier(
    @Param('id') id: string,
    @Body() dto: AssignCarrierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ordersService.assignCarrier(id, dto.carrierId, actor);
  }
}
