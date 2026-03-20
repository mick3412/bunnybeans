import { IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ReplenishmentSuggestionDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(1)
  suggestedQty!: number;
}

export class CreateFromReplenishmentDto {
  @IsString()
  supplierId!: string;

  @IsString()
  warehouseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplenishmentSuggestionDto)
  suggestions!: ReplenishmentSuggestionDto[];
}
