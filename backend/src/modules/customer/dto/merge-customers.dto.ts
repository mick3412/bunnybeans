import { IsString, IsArray, ArrayMinSize } from 'class-validator';

export class MergeCustomersDto {
  @IsString()
  merchantId!: string;

  @IsString()
  primaryId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  secondaryIds!: string[];
}
