import { IsString, IsOptional } from 'class-validator';

export class ClosePeriodDto {
  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  closedBy?: string;
}
