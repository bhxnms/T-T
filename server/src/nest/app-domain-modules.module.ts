import { AccommodationsModule } from './accommodations/accommodations.module';
import { ActivitiesModule } from './activities/activities.module';
import { AddonsModule } from './addons/addons.module';
import { AdminModule } from './admin/admin.module';
import { AirportsModule } from './airports/airports.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { AtlasModule } from './atlas/atlas.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { BookingImportModule } from './booking-import/booking-import.module';
import { BudgetModule } from './budget/budget.module';
import { CategoriesModule } from './categories/categories.module';
import { CollabModule } from './collab/collab.module';
import { CollectionsModule } from './collections/collections.module';
import { ConfigModule } from './config/config.module';
import { DayNotesModule } from './day-notes/day-notes.module';
import { DaysModule } from './days/days.module';
import { FeedsModule } from './feeds/feeds.module';
import { FilesModule } from './files/files.module';
import { GeoModule } from './geo/geo.module';
import { HelpModule } from './help/help.module';
import { AirtrailModule } from './integrations/airtrail.module';
import { JourneyModule } from './journey/journey.module';
import { LlmParseModule } from './llm-parse/llm-parse.module';
import { ManagedExtModule } from './managed/managed-ext.module';
import { MapsModule } from './maps/maps.module';
import { MemoriesModule } from './memories/memories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OauthModule } from './oauth/oauth.module';
import { OidcModule } from './oidc/oidc.module';
import { PackingModule } from './packing/packing.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PhotosModule } from './photos/photos.module';
import { PlaceEnrichmentModule } from './place-enrichment/place-enrichment.module';
import { PlacesModule } from './places/places.module';
import { PluginsModule } from './plugins/plugins.module';
import { PublicApiModule } from './public-api/public-api.module';
import { ReservationImportModule } from './reservation-import/reservation-import.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SettingsModule } from './settings/settings.module';
import { ShareModule } from './share/share.module';
import { StorageModule } from './storage/storage.module';
import { SystemNoticesModule } from './system-notices/system-notices.module';
import { TagsModule } from './tags/tags.module';
import { TodoModule } from './todo/todo.module';
import { TransitModule } from './transit/transit.module';
import { TripInviteModule } from './trip-invite/trip-invite.module';
import { TripsModule } from './trips/trips.module';
import { TunnelModule } from './tunnel/tunnel.module';
import { VacayModule } from './vacay/vacay.module';
import { WeatherModule } from './weather/weather.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    WeatherModule,
    PublicApiModule,
    HelpModule,
    AirportsModule,
    ConfigModule,
    SystemNoticesModule,
    GeoModule,
    MapsModule,
    PlaceEnrichmentModule,
    CategoriesModule,
    TagsModule,
    NotificationsModule,
    AtlasModule,
    VacayModule,
    PackingModule,
    TodoModule,
    BudgetModule,
    ReservationsModule,
    DaysModule,
    DayNotesModule,
    AccommodationsModule,
    AssignmentsModule,
    PlacesModule,
    TripsModule,
    CollabModule,
    FilesModule,
    PhotosModule,
    MemoriesModule,
    AirtrailModule,
    JourneyModule,
    CollectionsModule,
    ShareModule,
    TripInviteModule,
    TransitModule,
    FeedsModule,
    SettingsModule,
    StorageModule,
    BackupModule,
    AuthModule,
    OidcModule,
    OauthModule,
    AdminModule,
    AddonsModule,
    AuditModule,
    PermissionsModule,
    PluginsModule,
    BookingImportModule,
    ReservationImportModule,
    LlmParseModule,
    ActivitiesModule,
    ManagedExtModule,
    TunnelModule,
  ],
})
export class AppDomainModules {}
