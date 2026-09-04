import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PickingService } from './picking.service';
import { PickingTaskQueryDto } from './dto/picking-task-query.dto';
import { AssignPickingTaskDto } from './dto/assign-picking-task.dto';

@Controller('picking-tasks')
export class PickingTasksController {
  constructor(private readonly pickingService: PickingService) {}

  @Get()
  findAll(@Query() query: PickingTaskQueryDto) {
    return this.pickingService.findAllTasks(query);
  }

  @Patch(':id/assign')
  @Roles(Role.SUPERVISOR, Role.ADMIN)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignPickingTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pickingService.assignTask(id, dto.operatorId, actor);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.pickingService.completeTask(id, actor);
  }
}
