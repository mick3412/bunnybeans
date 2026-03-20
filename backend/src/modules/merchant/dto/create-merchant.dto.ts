import { IsString } from 'class-validator';

export class CreateMerchantDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;
}
