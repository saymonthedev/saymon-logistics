import { Module } from '@nestjs/common';
import { PickingService } from './picking.service';
import { PickingWavesController } from './picking-waves.controller';
import { PickingTasksController } from './picking-tasks.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [InventoryModule, RealtimeModule],
  controllers: [PickingWavesController, PickingTasksController],
  providers: [PickingService],
  exports: [PickingService],
})
export class PickingModule {}
