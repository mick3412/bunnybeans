import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const CONDITION_TYPES = ['SPEND', 'QTY', 'TAG_COMBO'] as const;
const OPS = ['>=', '>', '=', '<=', '<'] as const;
const ACTION_TYPES = [
  'WHOLE_PERCENT',
  'WHOLE_FIXED',
  'LINE_PERCENT',
  'GIFT_OR_UPSELL',
  'POINTS_MULTIPLIER',
] as const;
const SELECTION_RULES = ['LOWEST_PRICE', 'HIGHEST_PRICE', 'ALL'] as const;

export class PromotionConditionDto {
  @IsIn(CONDITION_TYPES)
  type!: (typeof CONDITION_TYPES)[number];

  @IsIn(OPS)
  op!: (typeof OPS)[number];

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class PromotionActionTierDto {
  @IsNumber()
  threshold!: number;

  @IsNumber()
  discountPercent!: number;
}

export class PromotionActionDto {
  @IsIn(ACTION_TYPES)
  type!: (typeof ACTION_TYPES)[number];

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  fixedOff?: number;

  @IsOptional()
  @IsIn(SELECTION_RULES)
  selectionRule?: (typeof SELECTION_RULES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTags?: string[];

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsNumber()
  upsellAmount?: number;

  @IsOptional()
  @IsNumber()
  pointsMultiplier?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionActionTierDto)
  tiers?: PromotionActionTierDto[];
}
