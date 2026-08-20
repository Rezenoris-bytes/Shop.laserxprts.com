import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnquiriesController } from './enquiries.controller';
import { EnquiriesRepository } from './enquiries.repository';
import { EnquiriesService } from './enquiries.service';

@Module({
  imports: [AuthModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService, EnquiriesRepository],
  exports: [EnquiriesService, EnquiriesRepository],
})
export class SalesModule {}
