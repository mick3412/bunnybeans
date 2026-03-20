import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ReturnLineDto {
  @IsString()
  receivingNoteLineId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReturnToSupplierDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];
}
