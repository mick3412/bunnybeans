import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { CustomerController } from './interface/customer.controller';
import { CustomerService } from './application/customer.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
