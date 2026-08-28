import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { EnquiriesController } from './enquiries.controller';
import { EnquiriesRepository } from './enquiries.repository';
import { EnquiriesService } from './enquiries.service';

@Module({
  imports: [AuthModule, FilesModule],
  controllers: [EnquiriesController],
  providers: [EnquiriesService, EnquiriesRepository],
  exports: [EnquiriesService, EnquiriesRepository],
})
export class SalesModule {}
