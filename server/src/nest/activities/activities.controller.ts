import type { User } from '../../types';
import { RuntimeEnvService } from '../app-config/runtime-env.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isDemoWriteBlocked, DEMO_WRITE_ERROR } from '../common/demo-write';
import { DatabaseService } from '../database/database.service';
import { RequirePermission, TripAccessGuard } from '../permissions/trip-access.guard';
import { CreateActivityDto, UpdateActivityDto, ReorderActivitiesDto, MoveActivityDto } from './activities.dto';
import { ActivityService } from './activities.service';
import type { CreateActivityInput, UpdateActivityInput } from './activities.service';
import { Body, Controller, Delete, Get, HttpException, Param, Post, Put, UseGuards } from '@nestjs/common';

@Controller('api/activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly env: RuntimeEnvService,
    private readonly activityService: ActivityService,
  ) {}

  private requireTripAccess(tripId: number, user: User): void {
    if (!Number.isInteger(tripId) || !this.databaseService.canAccessTrip(tripId, user.id)) {
      throw new HttpException('Trip not found', 404);
    }
  }

  private activityTripId(activityId: number): number | null {
    const row = this.databaseService.connection
      .prepare('SELECT trip_id FROM activities WHERE id = ?')
      .get(activityId) as { trip_id: number } | undefined;
    return row?.trip_id ?? null;
  }

  /**
   * GET /api/activities/day/:dayId
   * Get all activities for a specific day
   */
  @Get('day/:dayId')
  getActivitiesForDay(@Param('dayId') dayId: string, @CurrentUser() user: User) {
    const db = this.databaseService.connection;

    // Verify day belongs to a trip the user has access to
    const day = db.prepare('SELECT * FROM days WHERE id = ?').get(Number(dayId)) as
      | { id: number; trip_id: number }
      | undefined;
    if (!day) {
      throw new HttpException('Day not found', 404);
    }
    this.requireTripAccess(day.trip_id, user);

    return this.activityService.getActivitiesForDay(Number(dayId));
  }

  /**
   * GET /api/activities/trip/:tripId
   * Get all activities for a specific trip
   */
  @Get('trip/:tripId')
  getActivitiesForTrip(@Param('tripId') tripId: string, @CurrentUser() user: User) {
    const db = this.databaseService.connection;

    this.requireTripAccess(Number(tripId), user);
    return this.activityService.getActivitiesForTrip(Number(tripId));
  }

  /**
   * GET /api/activities/place/:placeId
   * Get all activities for a specific place (across all days)
   */
  @Get('place/:placeId')
  getActivitiesForPlace(@Param('placeId') placeId: string, @CurrentUser() user: User) {
    const db = this.databaseService.connection;

    const place = this.databaseService.connection
      .prepare('SELECT trip_id FROM places WHERE id = ?')
      .get(Number(placeId)) as { trip_id: number } | undefined;
    if (!place) throw new HttpException('Place not found', 404);
    this.requireTripAccess(place.trip_id, user);
    return this.activityService.getActivitiesForPlace(Number(placeId));
  }

  /**
   * POST /api/activities
   * Create a new activity
   */
  @Post()
  @RequirePermission('day_edit')
  createActivity(@Body() dto: CreateActivityDto, @CurrentUser() user: User) {
    if (isDemoWriteBlocked(this.env, user.email)) {
      throw new HttpException(DEMO_WRITE_ERROR, 403);
    }

    const db = this.databaseService.connection;

    this.requireTripAccess(dto.trip_id, user);
    const day = this.databaseService.connection.prepare('SELECT trip_id FROM days WHERE id = ?').get(dto.day_id) as
      | { trip_id: number }
      | undefined;
    if (!day || day.trip_id !== dto.trip_id) throw new HttpException('Day not found', 404);

    const hasPlace = dto.place_id !== undefined && dto.place_id !== null;
    const hasReservation = dto.reservation_id !== undefined && dto.reservation_id !== null;
    if (!hasPlace && !hasReservation) {
      throw new HttpException('Either place_id or reservation_id must be provided', 400);
    }

    if (hasPlace && hasReservation) {
      throw new HttpException('Cannot specify both place_id and reservation_id', 400);
    }

    try {
      const input: CreateActivityInput = {
        day_id: dto.day_id,
        trip_id: dto.trip_id,
        place_id: dto.place_id,
        reservation_id: dto.reservation_id,
        order_index: dto.order_index,
        start_time: dto.start_time,
        duration_minutes: dto.duration_minutes,
        notes: dto.notes,
      };

      return this.activityService.createActivity(input);
    } catch (error) {
      throw new HttpException(error instanceof Error ? error.message : 'Failed to create activity', 400);
    }
  }

  /**
   * PUT /api/activities/:id
   * Update an activity
   */
  @Put(':id')
  @RequirePermission('day_edit')
  updateActivity(@Param('id') id: string, @Body() dto: UpdateActivityDto, @CurrentUser() user: User) {
    if (isDemoWriteBlocked(this.env, user.email)) {
      throw new HttpException(DEMO_WRITE_ERROR, 403);
    }

    const db = this.databaseService.connection;

    // Check activity exists
    const activity = this.activityService.getActivityById(Number(id));
    if (!activity) {
      throw new HttpException('Activity not found', 404);
    }
    this.requireTripAccess(activity.trip_id, user);

    try {
      const input: UpdateActivityInput = {
        order_index: dto.order_index,
        start_time: dto.start_time,
        duration_minutes: dto.duration_minutes,
        notes: dto.notes,
      };

      return this.activityService.updateActivity(Number(id), input);
    } catch (error) {
      throw new HttpException(error instanceof Error ? error.message : 'Failed to update activity', 400);
    }
  }

  /**
   * DELETE /api/activities/:id
   * Delete an activity
   */
  @Delete(':id')
  @RequirePermission('day_edit')
  deleteActivity(@Param('id') id: string, @CurrentUser() user: User) {
    if (isDemoWriteBlocked(this.env, user.email)) {
      throw new HttpException(DEMO_WRITE_ERROR, 403);
    }

    const db = this.databaseService.connection;

    // Check activity exists
    const activity = this.activityService.getActivityById(Number(id));
    if (!activity) {
      throw new HttpException('Activity not found', 404);
    }
    this.requireTripAccess(activity.trip_id, user);

    this.activityService.deleteActivity(Number(id));
    return { success: true };
  }

  /**
   * POST /api/activities/day/:dayId/reorder
   * Reorder activities within a day
   */
  @Post('day/:dayId/reorder')
  @RequirePermission('day_edit')
  reorderActivities(@Param('dayId') dayId: string, @Body() dto: ReorderActivitiesDto, @CurrentUser() user: User) {
    if (isDemoWriteBlocked(this.env, user.email)) {
      throw new HttpException(DEMO_WRITE_ERROR, 403);
    }

    const db = this.databaseService.connection;

    if (!Array.isArray(dto.activity_ids)) {
      throw new HttpException('activity_ids must be an array', 400);
    }

    this.activityService.reorderActivities(Number(dayId), dto.activity_ids);
    return { success: true };
  }

  /**
   * POST /api/activities/:id/move
   * Move an activity to a different day
   */
  @Post(':id/move')
  @RequirePermission('day_edit')
  moveActivity(@Param('id') id: string, @Body() dto: MoveActivityDto, @CurrentUser() user: User) {
    if (isDemoWriteBlocked(this.env, user.email)) {
      throw new HttpException(DEMO_WRITE_ERROR, 403);
    }

    const db = this.databaseService.connection;

    // Check activity exists
    const activity = this.activityService.getActivityById(Number(id));
    if (!activity) {
      throw new HttpException('Activity not found', 404);
    }
    this.requireTripAccess(activity.trip_id, user);

    if (!Number.isInteger(dto.day_id) || dto.day_id <= 0) {
      throw new HttpException('day_id is required', 400);
    }

    return this.activityService.moveActivityToDay(Number(id), dto.day_id, dto.order_index);
  }
}
