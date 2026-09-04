import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PickingTaskStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PickingTaskQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PickingTaskStatus)
  status?: PickingTaskStatus;

  @IsOptional()
  @IsString()
  waveId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
