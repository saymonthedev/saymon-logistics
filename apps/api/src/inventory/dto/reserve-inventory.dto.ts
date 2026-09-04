import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReserveInventoryDto {
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}
