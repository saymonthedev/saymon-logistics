import { IsString } from 'class-validator';

export class AssignOperatorDto {
  @IsString()
  operatorId: string;
}

export class AssignCarrierDto {
  @IsString()
  carrierId: string;
}
