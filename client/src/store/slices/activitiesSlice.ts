import type { StoreApi } from 'zustand';
import { activitiesApi } from '../../api/client';
import type { Activity, ActivityWithDetails } from '../../types';
import type { TripStoreState } from '../tripStore';
type SetState = StoreApi<TripStoreState>['setState'];
type GetState = StoreApi<TripStoreState>['getState'];

export interface ActivitiesSlice {
  activities: ActivityWithDetails[];
  isLoadingActivities: boolean;

  // Actions
  loadActivitiesForTrip: (tripId: number) => Promise<void>;
  loadActivitiesForDay: (dayId: number) => Promise<void>;
  createActivity: (data: {
    day_id: number;
    trip_id: number;
    place_id?: number;
    reservation_id?: number;
    order_index?: number;
    start_time?: string;
    duration_minutes?: number;
    notes?: string;
  }) => Promise<ActivityWithDetails>;
  updateActivity: (
    id: number,
    data: {
      order_index?: number;
      start_time?: string;
      duration_minutes?: number;
      notes?: string;
    }
  ) => Promise<ActivityWithDetails>;
  deleteActivity: (id: number) => Promise<void>;
  reorderActivities: (dayId: number, activityIds: number[]) => Promise<void>;
  moveActivityToDay: (id: number, dayId: number, orderIndex?: number) => Promise<ActivityWithDetails>;

  // Optimistic updates
  optimisticUpdateActivity: (id: number, updates: Partial<Activity>) => void;
  optimisticDeleteActivity: (id: number) => void;
}

export const createActivitiesSlice = (set: SetState, get: GetState): ActivitiesSlice => ({
  activities: [],
  isLoadingActivities: false,

  loadActivitiesForTrip: async (tripId: number) => {
    set({ isLoadingActivities: true });
    try {
      const activities = await activitiesApi.getForTrip(tripId);
      set({ activities, isLoadingActivities: false });
    } catch (error) {
      console.error('Failed to load activities:', error);
      set({ isLoadingActivities: false });
      throw error;
    }
  },

  loadActivitiesForDay: async (dayId: number) => {
    set({ isLoadingActivities: true });
    try {
      const activities = await activitiesApi.getForDay(dayId);
      set({ activities, isLoadingActivities: false });
    } catch (error) {
      console.error('Failed to load activities for day:', error);
      set({ isLoadingActivities: false });
      throw error;
    }
  },

  createActivity: async (data) => {
    try {
      const newActivity = await activitiesApi.create(data);

      // Add to local state
      set((state) => ({
        activities: [...state.activities, newActivity],
      }));

      return newActivity;
    } catch (error) {
      console.error('Failed to create activity:', error);
      throw error;
    }
  },

  updateActivity: async (id, data) => {
    // Optimistic update
    const previousActivities = get().activities;
    const activityIndex = previousActivities.findIndex((a) => a.id === id);

    if (activityIndex !== -1) {
      const updatedActivities = [...previousActivities];
      updatedActivities[activityIndex] = {
        ...updatedActivities[activityIndex],
        ...data,
        updated_at: new Date().toISOString(),
      };
      set({ activities: updatedActivities });
    }

    try {
      const updatedActivity = await activitiesApi.update(id, data);

      // Update with server response
      set((state) => ({
        activities: state.activities.map((a) => (a.id === id ? updatedActivity : a)),
      }));

      return updatedActivity;
    } catch (error) {
      // Rollback on error
      set({ activities: previousActivities });
      console.error('Failed to update activity:', error);
      throw error;
    }
  },

  deleteActivity: async (id) => {
    // Optimistic delete
    const previousActivities = get().activities;
    set((state) => ({
      activities: state.activities.filter((a) => a.id !== id),
    }));

    try {
      await activitiesApi.delete(id);
    } catch (error) {
      // Rollback on error
      set({ activities: previousActivities });
      console.error('Failed to delete activity:', error);
      throw error;
    }
  },

  reorderActivities: async (dayId, activityIds) => {
    // Optimistic reorder
    const previousActivities = get().activities;
    const reorderedActivities = [...previousActivities];

    // Update order_index for activities in this day
    activityIds.forEach((activityId, index) => {
      const activity = reorderedActivities.find((a) => a.id === activityId);
      if (activity) {
        activity.order_index = index;
      }
    });

    set({ activities: reorderedActivities });

    try {
      await activitiesApi.reorder(dayId, activityIds);
    } catch (error) {
      // Rollback on error
      set({ activities: previousActivities });
      console.error('Failed to reorder activities:', error);
      throw error;
    }
  },

  moveActivityToDay: async (id, dayId, orderIndex) => {
    // Optimistic move
    const previousActivities = get().activities;
    const activityIndex = previousActivities.findIndex((a) => a.id === id);

    if (activityIndex !== -1) {
      const updatedActivities = [...previousActivities];
      updatedActivities[activityIndex] = {
        ...updatedActivities[activityIndex],
        day_id: dayId,
        order_index: orderIndex ?? 0,
        updated_at: new Date().toISOString(),
      };
      set({ activities: updatedActivities });
    }

    try {
      const movedActivity = await activitiesApi.move(id, { day_id: dayId, order_index: orderIndex });

      // Update with server response
      set((state) => ({
        activities: state.activities.map((a) => (a.id === id ? movedActivity : a)),
      }));

      return movedActivity;
    } catch (error) {
      // Rollback on error
      set({ activities: previousActivities });
      console.error('Failed to move activity:', error);
      throw error;
    }
  },

  optimisticUpdateActivity: (id, updates) => {
    set((state) => ({
      activities: state.activities.map((a) =>
        a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a
      ),
    }));
  },

  optimisticDeleteActivity: (id) => {
    set((state) => ({
      activities: state.activities.filter((a) => a.id !== id),
    }));
  },
});
