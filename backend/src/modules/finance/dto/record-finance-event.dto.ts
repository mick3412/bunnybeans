import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

const FINANCE_EVENT_TYPES = [
  'SALE_RECEIVABLE', 'SALE_PAYMENT', 'SALE_REFUND',
  'PURCHASE_PAYABLE', 'PURCHASE_REBATE', 'PURCHASE_RETURN',
  'ADJUSTMENT',
];

export class RecordFinanceEventDto {
  @IsString()
  @IsIn(FINANCE_EVENT_TYPES)
  type!: string;

  @IsOptional()
  @IsString()
  partyId?: string | null;

  @IsString()
  currency!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
