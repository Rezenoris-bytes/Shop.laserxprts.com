import { Global, Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

/**
 * Global because nearly every module needs to record actions, and threading
 * an import through each one adds noise without adding safety.
 */
@Global()
@Module({
  providers: [AuditRepository, AuditService],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
