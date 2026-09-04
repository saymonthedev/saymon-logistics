import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OrderPriority } from '@prisma/client';

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  customerName: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsString()
  @MinLength(5)
  deliveryAddress: string;

  @IsOptional()
  @IsString()
  carrierId?: string;

  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority = OrderPriority.NORMAL;

  @IsOptional()
  @IsDateString()
  estimatedDeliveryAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
