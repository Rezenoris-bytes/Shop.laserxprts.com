import { Global, Module } from '@nestjs/common';
import { DemoModeRepository } from './demo-mode.repository';
import { DemoModeService } from './demo-mode.service';

@Global()
@Module({
  providers: [DemoModeRepository, DemoModeService],
  exports: [DemoModeService],
})
export class DemoModule {}
