import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import type { ActivityWithDetails, Day } from '../../types';
import Button from '../shared/Button';
import DraggableActivityList from './DraggableActivityList';
import { getIconProps } from './iconConfig';

interface ActivitiesPanelProps {
  tripId: number;
  selectedDayId: number | null;
  days: Day[];
  onSelectDay: (dayId: number | null) => void;
}

export default function ActivitiesPanel({ tripId, selectedDayId, days, onSelectDay }: ActivitiesPanelProps) {
  const { activities, isLoadingActivities, loadActivitiesForTrip, loadActivitiesForDay } = useTripStore();
  const [localLoading, setLocalLoading] = useState(false);

  // Load activities when component mounts or trip changes
  useEffect(() => {
    const loadData = async () => {
      setLocalLoading(true);
      try {
        if (selectedDayId) {
          await loadActivitiesForDay(selectedDayId);
        } else {
          await loadActivitiesForTrip(tripId);
        }
      } catch (error) {
        console.error('Failed to load activities:', error);
      } finally {
        setLocalLoading(false);
      }
    };

    loadData();
  }, [tripId, selectedDayId]);

  // Group activities by day
  const activitiesByDay = activities.reduce(
    (acc, activity) => {
      const dayId = activity.day_id;
      if (!acc[dayId]) {
        acc[dayId] = [];
      }
      acc[dayId].push(activity);
      return acc;
    },
    {} as Record<number, ActivityWithDetails[]>
  );

  // Sort activities within each day by order_index
  Object.keys(activitiesByDay).forEach((dayId) => {
    activitiesByDay[Number(dayId)].sort((a, b) => a.order_index - b.order_index);
  });

  const loading = isLoadingActivities || localLoading;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">加载活动中...</div>
      </div>
    );
  }

  // If a specific day is selected, show only that day
  if (selectedDayId) {
    const dayActivities = activitiesByDay[selectedDayId] || [];
    const selectedDay = days.find((d) => d.id === selectedDayId);

    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {selectedDay?.title || `第 ${days.findIndex((d) => d.id === selectedDayId) + 1} 天`}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{dayActivities.length} 个活动</p>
            </div>
            <Button
              variant="primary"
              size="md"
              className="px-4 py-2.5 text-sm"
              onClick={() => {
                // TODO: Open add activity modal
                console.log('Add activity to day', selectedDayId);
              }}
            >
              <Plus size={16} />
              添加活动
            </Button>
          </div>
        </div>

        {/* Activities List with drag and drop */}
        <div className="flex-1 overflow-y-auto p-4">
          <DraggableActivityList dayId={selectedDayId} activities={dayActivities} />
        </div>
      </div>
    );
  }

  // Show all days with their activities
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900">所有活动</h3>
        <p className="mt-1 text-sm text-gray-500">
          {activities.length} 个活动，分布在 {Object.keys(activitiesByDay).length} 天
        </p>
      </div>

      {/* Days List */}
      <div className="flex-1 overflow-y-auto">
        {days.map((day, index) => {
          const dayActivities = activitiesByDay[day.id] || [];

          return (
            <div key={day.id} className="border-b border-gray-100">
              {/* Day Header */}
              <div
                className="cursor-pointer bg-gray-50 p-4 transition-colors hover:bg-gray-100"
                onClick={() => onSelectDay(day.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{day.title || `第 ${index + 1} 天`}</h4>
                    <p className="mt-1 text-xs text-gray-500">{dayActivities.length} 个活动</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg p-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Open add activity modal for this day
                      console.log('Add activity to day', day.id);
                    }}
                  >
                    <Plus {...getIconProps('action')} style={{ color: 'var(--color-gray-500)' }} />
                  </Button>
                </div>
              </div>

              {/* Day Activities (preview) */}
              {dayActivities.length > 0 && (
                <div className="p-4">
                  <DraggableActivityList dayId={day.id} activities={dayActivities.slice(0, 3)} />
                  {dayActivities.length > 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full justify-center py-2 text-sm"
                      style={{ color: 'var(--color-primary)' }}
                      onClick={() => onSelectDay(day.id)}
                    >
                      查看全部 {dayActivities.length} 个活动
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {days.length === 0 && <div className="py-12 text-center text-gray-500">还没有创建任何天数</div>}
      </div>
    </div>
  );
}
