import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { CarriersService } from './carriers.service';
import { CreateCarrierDto } from './dto/create-carrier.dto';

@Controller('carriers')
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  findAll() {
    return this.carriersService.findAll();
  }

  @Get(':id/performance')
  getPerformance(@Param('id') id: string) {
    return this.carriersService.getPerformance(id);
  }

  @Post()
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  create(@Body() dto: CreateCarrierDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.carriersService.create(dto, actor);
  }
}
