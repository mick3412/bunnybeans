import { IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseOrderLinePatchDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1)
  qtyOrdered!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class PatchPurchaseOrderDto {
  @IsOptional()
  @IsString()
  expectedDate?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLinePatchDto)
  lines?: PurchaseOrderLinePatchDto[];
}
