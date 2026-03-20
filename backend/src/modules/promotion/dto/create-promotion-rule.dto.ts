import { IsBoolean, IsOptional, IsString, IsArray, IsNumber, Min, Max, IsNotEmpty } from 'class-validator';

export class CreatePromotionRuleDto {
  @IsNotEmpty({ message: 'merchantId is required' })
  @IsString()
  merchantId!: string;

  @IsNotEmpty({ message: 'name is required' })
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  draft?: boolean;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  exclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  firstPurchaseOnly?: boolean;

  @IsOptional()
  @IsArray()
  memberLevels?: string[];

  @IsOptional()
  @IsArray()
  conditions?: unknown[];

  @IsOptional()
  @IsArray()
  actions?: unknown[];
}
