import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const activityFields = {
  day_id: z.number(),
  trip_id: z.number(),
  place_id: z.number().optional(),
  reservation_id: z.number().optional(),
  order_index: z.number().optional(),
  start_time: z.string().optional(),
  duration_minutes: z.number().optional(),
  notes: z.string().optional(),
};

export class CreateActivityDto extends createZodDto(z.object(activityFields)) {}
export class UpdateActivityDto extends createZodDto(
  z.object({
    order_index: z.number().optional(),
    start_time: z.string().optional(),
    duration_minutes: z.number().optional(),
    notes: z.string().optional(),
  }),
) {}
export class ReorderActivitiesDto extends createZodDto(z.object({ activity_ids: z.array(z.number()) })) {}
export class MoveActivityDto extends createZodDto(
  z.object({ day_id: z.number(), order_index: z.number().optional() }),
) {}
