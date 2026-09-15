import { AppConfigModule } from '../app-config/app-config.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminDefaultUserSettingsController, SettingsController } from './settings.controller';
import { SettingsMcp } from './settings.mcp';
import { SettingsService } from './settings.service';
import { Module } from '@nestjs/common';

/** Exports SettingsService for in-container consumers (admin, share, llm-parse). */
@Module({
  // AuthModule for the admin gate on the defaults routes, and for the
  // AuthService that SettingsMcp's demo gate injects.
  imports: [AppConfigModule, AuthModule, AuditModule],
  controllers: [SettingsController, AdminDefaultUserSettingsController],
  providers: [SettingsService, SettingsMcp],
  exports: [SettingsService],
})
export class SettingsModule {}
