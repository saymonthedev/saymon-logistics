import { IsInt, IsOptional, IsString, NotEquals } from 'class-validator';

export class AdjustStockDto {
  /** Positive to receive stock, negative to write off/correct. Cannot be zero. */
  @IsInt()
  @NotEquals(0)
  delta: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
