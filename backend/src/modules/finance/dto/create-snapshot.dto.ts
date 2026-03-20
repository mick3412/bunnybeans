import { IsString, IsIn } from 'class-validator';

export class CreateSnapshotDto {
  @IsString()
  asOfDate!: string;

  @IsString()
  @IsIn(['daily', 'monthly'])
  type!: 'daily' | 'monthly';
}
