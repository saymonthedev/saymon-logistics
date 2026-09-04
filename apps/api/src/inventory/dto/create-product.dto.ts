import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  sku: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialAvailable?: number = 0;
}
