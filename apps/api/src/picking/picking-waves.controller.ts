import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PickingService } from './picking.service';
import { CreatePickingWaveDto } from './dto/create-picking-wave.dto';
import { PickingWaveQueryDto } from './dto/picking-wave-query.dto';

@Controller('picking-waves')
export class PickingWavesController {
  constructor(private readonly pickingService: PickingService) {}

  @Get()
  findAll(@Query() query: PickingWaveQueryDto) {
    return this.pickingService.findAllWaves(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pickingService.findWave(id);
  }

  @Post()
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  create(@Body() dto: CreatePickingWaveDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.pickingService.createWave(dto, actor);
  }
}
