import { AppConfigModule } from '../app-config/app-config.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ActivitiesController } from './activities.controller';
import { ActivityService } from './activities.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [DatabaseModule, PermissionsModule, AppConfigModule],
  controllers: [ActivitiesController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivitiesModule {}
