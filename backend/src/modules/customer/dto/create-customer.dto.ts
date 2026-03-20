import { IsString, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  merchantId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  memberLevel?: string | null;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  memberCode?: string | null;
}
