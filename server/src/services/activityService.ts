import type Database from 'better-sqlite3';

export interface Activity {
  id: number;
  day_id: number;
  trip_id: number;
  place_id: number | null;
  reservation_id: number | null;
  order_index: number;
  start_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityWithDetails extends Activity {
  // Place details (if place_id is set)
  place_name?: string;
  place_lat?: number;
  place_lng?: number;
  place_address?: string;
  place_category_id?: number | null;
  place_image_url?: string | null;

  // Reservation details (if reservation_id is set)
  reservation_name?: string;
  reservation_type?: string;
  reservation_status?: string;
  reservation_confirmation_number?: string | null;
}

export interface CreateActivityInput {
  day_id: number;
  trip_id: number;
  place_id?: number;
  reservation_id?: number;
  order_index?: number;
  start_time?: string;
  duration_minutes?: number;
  notes?: string;
}

export interface UpdateActivityInput {
  order_index?: number;
  start_time?: string;
  duration_minutes?: number;
  notes?: string;
}

export function createActivityService(db: Database.Database) {
  /**
   * Get all activities for a specific day, with place/reservation details
   */
  function getActivitiesForDay(dayId: number): ActivityWithDetails[] {
    const sql = `
      SELECT
        a.*,
        p.name as place_name,
        p.lat as place_lat,
        p.lng as place_lng,
        p.address as place_address,
        p.category_id as place_category_id,
        p.image_url as place_image_url,
        r.name as reservation_name,
        r.type as reservation_type,
        r.status as reservation_status,
        r.confirmation_number as reservation_confirmation_number
      FROM activities a
      LEFT JOIN places p ON a.place_id = p.id
      LEFT JOIN reservations r ON a.reservation_id = r.id
      WHERE a.day_id = ?
      ORDER BY a.order_index ASC, a.created_at ASC
    `;

    return db.prepare(sql).all(dayId) as ActivityWithDetails[];
  }

  /**
   * Get all activities for a specific trip
   */
  function getActivitiesForTrip(tripId: number): ActivityWithDetails[] {
    const sql = `
      SELECT
        a.*,
        p.name as place_name,
        p.lat as place_lat,
        p.lng as place_lng,
        p.address as place_address,
        p.category_id as place_category_id,
        p.image_url as place_image_url,
        r.name as reservation_name,
        r.type as reservation_type,
        r.status as reservation_status,
        r.confirmation_number as reservation_confirmation_number
      FROM activities a
      LEFT JOIN places p ON a.place_id = p.id
      LEFT JOIN reservations r ON a.reservation_id = r.id
      WHERE a.trip_id = ?
      ORDER BY a.day_id ASC, a.order_index ASC, a.created_at ASC
    `;

    return db.prepare(sql).all(tripId) as ActivityWithDetails[];
  }

  /**
   * Create a new activity
   */
  function createActivity(input: CreateActivityInput): Activity {
    // Validate: exactly one of place_id or reservation_id must be set
    if ((input.place_id && input.reservation_id) || (!input.place_id && !input.reservation_id)) {
      throw new Error('Exactly one of place_id or reservation_id must be provided');
    }

    // If order_index not provided, append to end
    let orderIndex = input.order_index;
    if (orderIndex === undefined) {
      const maxOrder = db.prepare(
        'SELECT MAX(order_index) as max_order FROM activities WHERE day_id = ?'
      ).get(input.day_id) as { max_order: number | null };
      orderIndex = (maxOrder.max_order ?? -1) + 1;
    }

    const sql = `
      INSERT INTO activities (
        day_id, trip_id, place_id, reservation_id,
        order_index, start_time, duration_minutes, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = db.prepare(sql).run(
      input.day_id,
      input.trip_id,
      input.place_id ?? null,
      input.reservation_id ?? null,
      orderIndex,
      input.start_time ?? null,
      input.duration_minutes ?? null,
      input.notes ?? null
    );

    return getActivityById(result.lastInsertRowid as number)!;
  }

  /**
   * Update an activity
   */
  function updateActivity(id: number, input: UpdateActivityInput): Activity {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.order_index !== undefined) {
      updates.push('order_index = ?');
      values.push(input.order_index);
    }
    if (input.start_time !== undefined) {
      updates.push('start_time = ?');
      values.push(input.start_time);
    }
    if (input.duration_minutes !== undefined) {
      updates.push('duration_minutes = ?');
      values.push(input.duration_minutes);
    }
    if (input.notes !== undefined) {
      updates.push('notes = ?');
      values.push(input.notes);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE activities SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    return getActivityById(id)!;
  }

  /**
   * Delete an activity
   */
  function deleteActivity(id: number): void {
    db.prepare('DELETE FROM activities WHERE id = ?').run(id);
  }

  /**
   * Get a single activity by ID
   */
  function getActivityById(id: number): Activity | null {
    const sql = 'SELECT * FROM activities WHERE id = ?';
    return (db.prepare(sql).get(id) as Activity) ?? null;
  }

  /**
   * Reorder activities within a day
   * Takes an array of activity IDs in the desired order
   */
  function reorderActivities(dayId: number, activityIds: number[]): void {
    const stmt = db.prepare('UPDATE activities SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND day_id = ?');

    db.transaction(() => {
      activityIds.forEach((activityId, index) => {
        stmt.run(index, activityId, dayId);
      });
    })();
  }

  /**
   * Move an activity to a different day
   */
  function moveActivityToDay(activityId: number, newDayId: number, newOrderIndex?: number): Activity {
    const activity = getActivityById(activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    // If no order index provided, append to end of new day
    let orderIndex = newOrderIndex;
    if (orderIndex === undefined) {
      const maxOrder = db.prepare(
        'SELECT MAX(order_index) as max_order FROM activities WHERE day_id = ?'
      ).get(newDayId) as { max_order: number | null };
      orderIndex = (maxOrder.max_order ?? -1) + 1;
    }

    db.prepare(
      'UPDATE activities SET day_id = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newDayId, orderIndex, activityId);

    return getActivityById(activityId)!;
  }

  /**
   * Get activities for a specific place (across all days)
   */
  function getActivitiesForPlace(placeId: number): Activity[] {
    return db.prepare(
      'SELECT * FROM activities WHERE place_id = ? ORDER BY day_id ASC, order_index ASC'
    ).all(placeId) as Activity[];
  }

  /**
   * Get activities for a specific reservation (across all days)
   */
  function getActivitiesForReservation(reservationId: number): Activity[] {
    return db.prepare(
      'SELECT * FROM activities WHERE reservation_id = ? ORDER BY day_id ASC, order_index ASC'
    ).all(reservationId) as Activity[];
  }

  return {
    getActivitiesForDay,
    getActivitiesForTrip,
    createActivity,
    updateActivity,
    deleteActivity,
    getActivityById,
    reorderActivities,
    moveActivityToDay,
    getActivitiesForPlace,
    getActivitiesForReservation,
  };
}

export type ActivityService = ReturnType<typeof createActivityService>;
