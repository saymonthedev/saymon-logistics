import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class CreatePickingWaveDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds: string[];
}
