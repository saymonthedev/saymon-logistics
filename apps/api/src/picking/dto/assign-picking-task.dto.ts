import { IsString } from 'class-validator';

export class AssignPickingTaskDto {
  @IsString()
  operatorId: string;
}
