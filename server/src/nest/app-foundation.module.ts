import { AppConfigModule } from './app-config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { McpTransportModule } from './mcp-transport/mcp-transport.module';
import { PlatformModule } from './platform/platform.module';
import { RealtimeGatewayModule } from './realtime/realtime-gateway.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RealtimeModule,
    RealtimeGatewayModule,
    SchedulingModule,
    HealthModule,
    PlatformModule,
    McpTransportModule,
  ],
})
export class AppFoundationModule {}
