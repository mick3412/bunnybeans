import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString } from 'class-validator';
import { CreatePromotionRuleDto } from './create-promotion-rule.dto';

export class UpdatePromotionRuleDto extends PartialType(CreatePromotionRuleDto) {
  @IsNotEmpty({ message: 'merchantId is required' })
  @IsString()
  merchantId!: string;
}
