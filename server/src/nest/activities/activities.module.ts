import { AppConfigModule } from '../app-config/app-config.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ActivitiesController } from './activities.controller';
import { Module } from '@nestjs/common';

@Module({
  imports: [DatabaseModule, PermissionsModule, AppConfigModule],
  controllers: [ActivitiesController],
})
export class ActivitiesModule {}
