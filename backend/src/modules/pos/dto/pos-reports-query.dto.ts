import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

const PRESETS = ['today', 'last7d', 'last30d', 'currentMonth', 'last60d', 'lastHalfYear'] as const;
const GROUP_BY = ['day', 'week', 'month', 'hour'] as const;
const SORT_BY = ['quantity', 'revenue'] as const;

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
