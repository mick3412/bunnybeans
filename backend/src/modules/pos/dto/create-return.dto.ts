import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReturnType as PrismaReturnType,
  ReturnReason,
  ItemCondition,
  RefundMethod,
} from '@prisma/client';

export class ReturnItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @IsEnum(ItemCondition)
  condition!: ItemCondition;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ExchangeItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class ExchangePaymentDto {
  @IsString()
  @IsNotEmpty()
  method!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class PreviewReturnDto {
  @IsEnum(PrismaReturnType)
  type!: PrismaReturnType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @IsEnum(RefundMethod)
  refundMethod!: RefundMethod;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangeItemDto)
  exchangeItems?: ExchangeItemDto[];
}

export class ExecuteReturnDto extends PreviewReturnDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangePaymentDto)
  exchangePayments?: ExchangePaymentDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
