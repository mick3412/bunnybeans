import { IsArray, ValidateNested, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ReceivingNoteLinePatchDto {
  @IsString()
  lineId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  receivedQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  qualifiedQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  returnedQty?: number;

  @IsOptional()
  @IsString()
  returnReason?: string;

  @IsOptional()
  @IsString()
  batchCode?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  productionDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  shelfLifeMonths?: number | null;

  @IsOptional()
  @IsString()
  weightUnit?: string | null;
}

export class PatchReceivingNoteLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivingNoteLinePatchDto)
  lines!: ReceivingNoteLinePatchDto[];
}
