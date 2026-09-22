import { AuditModule } from '../audit/audit.module';
import { TunnelController } from './tunnel.controller';
import { TunnelService } from './tunnel.service';
import { Module } from '@nestjs/common';

/**
 * Cloudflare Tunnel configuration surface. AuditModule feeds the write audits;
 * DatabaseService comes from the @Global DatabaseModule, so it needs no import
 * here. JwtAuthGuard/AdminGuard carry no constructor dependencies, so the
 * controller instantiates them directly — the same shape StorageModule uses
 * (and for the same reason: importing AuthModule here would close a module
 * cycle).
 */
@Module({
  imports: [AuditModule],
  controllers: [TunnelController],
  providers: [TunnelService],
  exports: [TunnelService],
})
export class TunnelModule {}
