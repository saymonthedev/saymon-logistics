import { IsEnum } from 'class-validator';
import { OrderPriority } from '@prisma/client';

export class UpdateOrderPriorityDto {
  @IsEnum(OrderPriority)
  priority: OrderPriority;
}
