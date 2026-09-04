import { IsEnum, IsOptional } from 'class-validator';
import { PickingWaveStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PickingWaveQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PickingWaveStatus)
  status?: PickingWaveStatus;
}
