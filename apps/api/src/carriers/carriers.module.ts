import { Module } from '@nestjs/common';
import { CarriersService } from './carriers.service';
import { CarriersController } from './carriers.controller';

@Module({
  controllers: [CarriersController],
  providers: [CarriersService],
  exports: [CarriersService],
})
export class CarriersModule {}
