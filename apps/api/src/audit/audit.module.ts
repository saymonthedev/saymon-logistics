import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

/**
 * Global: nearly every feature module writes audit entries, and AuditService
 * itself only depends on the (also global) PrismaService — so requiring each
 * consumer to import this module would be pure boilerplate.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
