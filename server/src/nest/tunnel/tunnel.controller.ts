import type { User } from '../../types';
import { AuditService } from '../audit/audit.service';
import { getClientIp } from '../audit/client-ip';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagedForbidden } from '../common/managed';
import { CloudflareTunnelConfigDto, CloudflareTunnelTestRequestDto } from './tunnel.dto';
import { TunnelService } from './tunnel.service';
import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';

import type { Request } from 'express';

/**
 * /api/admin/tunnel — Cloudflare Tunnel configuration for operators who cannot
 * set a tunnel up themselves.
 *
 * The app does not run cloudflared. The connector is a separate process (a
 * compose sidecar), because running one inside this container would need a
 * writable rootfs, an executable path, and process supervision the image
 * deliberately does not have: the shipped compose mounts the root filesystem
 * read-only, drops every capability, and marks /tmp noexec. What this surface
 * does instead is hold the credentials, prove they work, and render the config
 * the operator pastes into the sidecar.
 *
 * The whole feature is off until the admin enables it, and a disabled install
 * behaves as if it did not exist — see TunnelService. An operator already
 * running their own tunnel keeps doing exactly that.
 *
 * Hoster-level by nature (one tunnel fronts the whole install), so it is
 * admin-only and withheld on a managed instance, like the storage backends.
 */
@Controller('api/admin/tunnel')
@UseGuards(JwtAuthGuard, AdminGuard)
@ManagedForbidden('a Cloudflare tunnel is hoster-level configuration')
export class TunnelController {
  constructor(
    private readonly service: TunnelService,
    private readonly audit: AuditService,
  ) {}

  /** The stored configuration, with the token masked. Never throws. */
  @Get()
  get() {
    return this.service.state();
  }

  /** Persist a partial update. Answers the fresh state, never an echo of the request. */
  @Put()
  update(@CurrentUser() user: User, @Body() body: CloudflareTunnelConfigDto, @Req() req: Request) {
    const before = this.service.state();
    this.service.update(body);
    const after = this.service.state();

    this.audit.writeAudit({
      userId: user.id,
      action: 'admin.tunnel_update',
      ip: getClientIp(req),
      // Names and the enabled flag only — the token is never in the audit trail.
      details: {
        enabled: after.enabled,
        enabled_changed: before.enabled !== after.enabled,
        configured: after.configured,
        hostname: after.hostname || null,
      },
    });

    return after;
  }

  /**
   * Probe the stored (or just-typed) credentials. Answers 200 with a result
   * object — a rejected token is information, not a transport error, the same
   * contract the notification and storage probes use.
   */
  @Post('test')
  @HttpCode(200)
  async test(@CurrentUser() user: User, @Body() body: CloudflareTunnelTestRequestDto, @Req() req: Request) {
    const result = await this.service.test(body);
    this.audit.writeAudit({
      userId: user.id,
      action: 'admin.tunnel_test',
      ip: getClientIp(req),
      details: { success: result.success, error: result.error ?? null },
    });
    return result;
  }

  /**
   * Create or reconcile the tunnel on Cloudflare's side and hand back the
   * connector token. Answers 200 with a result object, like the probe: a
   * rejected token or a hostname with no zone is information, not a transport
   * error.
   */
  @Post('provision')
  @HttpCode(200)
  async provision(@CurrentUser() user: User, @Req() req: Request) {
    const result = await this.service.provision();
    this.audit.writeAudit({
      userId: user.id,
      action: 'admin.tunnel_provision',
      ip: getClientIp(req),
      // The connector token is deliberately absent from the audit trail.
      details: { success: result.success, error: result.error ?? null, tunnel_id: result.tunnel_id ?? null },
    });
    return result;
  }

  /**
   * What the operator has to run: the sidecar snippet and the two environment
   * variables. Available only after provisioning, because before that the
   * command would reference a tunnel that does not exist yet.
   */
  @Get('connector')
  connector() {
    const config = this.service.connectorConfig();
    if (!config) return { available: false };
    return { available: true, ...config };
  }
}
