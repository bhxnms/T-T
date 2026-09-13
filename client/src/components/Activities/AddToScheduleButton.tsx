import { Calendar, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import type { Day, Place } from '../../types';
import Button from '../shared/Button';
import { getIconProps } from './iconConfig';

interface AddToScheduleButtonProps {
  place: Place;
  tripId: number;
  days: Day[];
  currentDayId?: number | null;
  onSuccess?: () => void;
}

/**
 * Button component that allows adding a place to a specific day's schedule
 * Shows a dropdown to select which day to add the place to
 */
export default function AddToScheduleButton({
  place,
  tripId,
  days,
  currentDayId,
  onSuccess,
}: AddToScheduleButtonProps) {
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { createActivity } = useTripStore();

  const handleAddToDay = async (dayId: number) => {
    setIsAdding(true);
    try {
      await createActivity({
        day_id: dayId,
        trip_id: tripId,
        place_id: place.id,
        duration_minutes: place.duration_minutes || 60,
      });

      setShowDayPicker(false);
      onSuccess?.();

      // Show success feedback
      console.log(`Added ${place.name} to day ${dayId}`);
    } catch (error) {
      console.error('Failed to add place to schedule:', error);
      alert('添加失败，请重试');
    } finally {
      setIsAdding(false);
    }
  };

  // Quick add to current day
  const handleQuickAdd = async () => {
    if (currentDayId) {
      await handleAddToDay(currentDayId);
    } else {
      setShowDayPicker(true);
    }
  };

  if (days.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Main button */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleQuickAdd}
          disabled={isAdding}
          className="px-2 py-1 text-xs disabled:opacity-50"
          title={currentDayId ? `添加到第 ${days.findIndex((d) => d.id === currentDayId) + 1} 天` : '选择天数'}
        >
          <Calendar {...getIconProps('inline')} />
          {isAdding ? '添加中...' : currentDayId ? '规划' : '选择天数'}
        </Button>

        {/* Dropdown toggle */}
        {days.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowDayPicker(!showDayPicker);
            }}
            className="p-1"
            style={{ color: 'var(--color-primary)' }}
          >
            <ChevronDown {...getIconProps('inline')} />
          </Button>
        )}
      </div>

      {/* Day picker dropdown */}
      {showDayPicker && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowDayPicker(false)} />

          {/* Dropdown menu */}
          <div className="absolute right-0 top-full z-50 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-2">
              <div className="mb-1 px-2 py-1 text-xs font-medium text-gray-500">添加到哪一天？</div>
              {days.map((day, index) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  key={day.id}
                  onClick={() => handleAddToDay(day.id)}
                  disabled={isAdding}
                  className="w-full justify-start px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50"
                >
                  <div className="font-medium text-gray-900">{day.title || `第 ${index + 1} 天`}</div>
                  {day.date && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {new Date(day.date).toLocaleDateString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
