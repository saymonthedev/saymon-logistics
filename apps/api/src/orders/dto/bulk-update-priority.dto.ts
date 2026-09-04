import { ArrayMinSize, IsArray, IsEnum, IsString } from 'class-validator';
import { OrderPriority } from '@prisma/client';

export class BulkUpdatePriorityDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds: string[];

  @IsEnum(OrderPriority)
  priority: OrderPriority;
}
