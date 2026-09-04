import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { AlertsService } from './alerts.service';
import { AlertQueryDto } from './dto/alert-query.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(@Query() query: AlertQueryDto) {
    return this.alertsService.findAll(query);
  }

  @Patch(':id/resolve')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  resolve(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.alertsService.resolve(id, actor);
  }
}
