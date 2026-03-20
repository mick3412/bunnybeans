import { IsString, IsArray, ArrayMinSize } from 'class-validator';

export class MergeCustomersDto {
  @IsString()
  primaryId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  mergeIds!: string[];
}
