import { IsString, IsOptional } from 'class-validator';

export class CreateReceivingNoteDto {
  @IsString()
  merchantId!: string;

  @IsString()
  purchaseOrderId!: string;

  @IsOptional()
  @IsString()
  inspectorName?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
