import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseOrderLineDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1)
  qtyOrdered!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  merchantId!: string;

  @IsString()
  supplierId!: string;

  @IsString()
  warehouseId!: string;

  @IsString()
  orderNumber!: string;

  @IsOptional()
  @IsString()
  expectedDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}
