import { trekMcpAccessPolicy, trekMcpValidateAccess } from '../mcp/nest-mcp-policy';
import { McpModule } from '../nest-mcp';
import { AppDomainModules } from './app-domain-modules.module';
import { AppFoundationModule } from './app-foundation.module';
import { AuthModule } from './auth/auth.module';
import { GlobalAuthGuard } from './auth/global-auth.guard';
import { MfaPolicyGuard } from './auth/mfa-policy.guard';
import { SessionRenewalInterceptor } from './auth/session-renewal.interceptor';
import { IdempotencyCleanupJob } from './common/idempotency-cleanup.job';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';
import { ManagedGuard } from './common/managed.guard';
import { TrekExceptionFilter } from './common/trek-exception.filter';
import { ZodValidationPipe } from './common/zod-validation.pipe';
import { SpaFallbackFilter } from './platform/spa-fallback.filter';
import { SchedulingModule } from './scheduling/scheduling.module';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

/**
 * Root NestJS module. Composition modules group platform and domain imports;
 * global guards, filters, interceptors, and pipes remain registered here.
 */
@Module({
  imports: [
    AppFoundationModule,
    AppDomainModules,
    AuthModule,
    SchedulingModule,
    McpModule.forRoot({ accessPolicy: trekMcpAccessPolicy, validateAccess: trekMcpValidateAccess }),
  ],
  providers: [
    // Default-deny: a route is authenticated unless it carries @Public() or
    // @OptionalAuth(), or declares its own @UseGuards chain. Protection used to
    // be opt-in, which made a forgotten guard a silent bypass instead of an error.
    { provide: APP_GUARD, useClass: GlobalAuthGuard },
    // Second, and only second: it reads the user the guard above resolved
    // instead of verifying the token a second time, which is what the Express
    // middleware it replaces did on every /api request.
    { provide: APP_GUARD, useClass: MfaPolicyGuard },
    // Third, and only third: a stranger gets the 401 the two above would have
    // given them rather than a 403 that confirms the route exists. Inert unless
    // the instance is centrally administered AND the route carries the marker.
    { provide: APP_GUARD, useClass: ManagedGuard },
    // Global error-envelope normaliser (DI-registered so it also catches
    // framework-level exceptions like the not-found handler).
    { provide: APP_FILTER, useClass: TrekExceptionFilter },
    // SPA fallback: serves index.html for unmatched GETs in production (the Nest
    // equivalent of the legacy Express app.get('*') catch-all). @Catch(NotFoundException)
    // is more specific than TrekExceptionFilter, so Nest routes 404s here.
    { provide: APP_FILTER, useClass: SpaFallbackFilter },
    // Replays the X-Idempotency-Key the client sends on every write, so retried
    // mutations don't double-apply.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    // Sliding session renewal: re-issues the trek_session cookie once a
    // cookie-authenticated token is past half its lifetime (#1927).
    { provide: APP_INTERCEPTOR, useClass: SessionRenewalInterceptor },
    // Its nightly TTL purge — a provider here because common/ has no module.
    IdempotencyCleanupJob,
    // Global Zod validation: any parameter typed with a createZodDto class
    // (the <domain>.dto.ts wrappers over @trek/shared schemas) is validated;
    // everything else passes through untouched. Paired with the boot gate in
    // common/validate-body-contracts.ts so unvalidated mutation bodies refuse
    // to boot instead of shipping silently.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
