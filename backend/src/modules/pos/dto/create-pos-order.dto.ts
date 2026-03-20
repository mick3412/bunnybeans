import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class PosOrderItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

class PosPaymentDto {
  @IsString()
  method!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreatePosOrderDto {
  @IsString()
  storeId!: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosOrderItemDto)
  items!: PosOrderItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosPaymentDto)
  payments!: PosPaymentDto[];

  @IsOptional()
  @IsString()
  customerId?: string | null;

  @IsOptional()
  @IsString()
  exchangeFromOrderId?: string | null;

  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @IsOptional()
  @IsString()
  customerEmail?: string | null;

  @IsOptional()
  @IsBoolean()
  allowCredit?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsToRedeem?: number;
}
