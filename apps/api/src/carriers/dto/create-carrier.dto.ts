import { IsString, MinLength } from 'class-validator';

export class CreateCarrierDto {
  @IsString()
  @MinLength(2)
  name: string;
}
