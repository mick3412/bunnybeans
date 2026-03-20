import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

class QuickReceiveLineDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

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

export class QuickReceiveDto {
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
  inspectorName?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuickReceiveLineDto)
  lines!: QuickReceiveLineDto[];
}
