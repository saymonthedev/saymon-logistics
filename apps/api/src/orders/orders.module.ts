import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [InventoryModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
