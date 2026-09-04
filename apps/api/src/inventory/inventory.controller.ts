import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get(':sku')
  findOne(@Param('sku') sku: string) {
    return this.inventoryService.findBySku(sku);
  }

  @Post()
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventoryService.createProduct(dto, actor);
  }

  @Patch(':sku')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  update(
    @Param('sku') sku: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.inventoryService.updateProduct(sku, dto, actor);
  }

  @Patch(':sku/adjust')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  adjust(
    @Param('sku') sku: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.inventoryService.adjustStock(sku, dto.delta, dto.reason, actor);
  }

  @Post(':sku/reserve')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  reserve(
    @Param('sku') sku: string,
    @Body() dto: ReserveInventoryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.inventoryService.reserve(sku, dto.quantity, dto.orderId, actor);
  }
}
