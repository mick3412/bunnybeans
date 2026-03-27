import { IsOptional, IsString, IsIn, IsInt, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

const PRESETS = ['today', 'last7d', 'last30d', 'currentMonth', 'last60d', 'lastHalfYear'] as const;
const GROUP_BY = ['day', 'week', 'month', 'hour'] as const;
const SORT_BY = ['quantity', 'revenue'] as const;
const PROMO_FILTERS = ['all', 'with_promo', 'without_promo'] as const;

export class PosReportsQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  @IsIn(PRESETS)
  preset?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsIn(SORT_BY)
  sortBy?: 'quantity' | 'revenue';

  @IsOptional()
  @IsString()
  @IsIn(GROUP_BY)
  groupBy?: 'day' | 'week' | 'month' | 'hour';
}

export class MarketBasketQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  @IsIn(PRESETS)
  preset?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  @IsIn(PROMO_FILTERS)
  promoFilter?: 'all' | 'with_promo' | 'without_promo';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSupport?: number;
}
