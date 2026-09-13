import { Calendar, Clock, GripVertical, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import type { ActivityWithDetails } from '../../types';
import Button from '../shared/Button';
import { getIconProps } from './iconConfig';

interface DraggableActivityListProps {
  dayId: number;
  activities: ActivityWithDetails[];
  onReorder?: (activityIds: number[]) => void;
}

export default function DraggableActivityList({ dayId, activities, onReorder }: DraggableActivityListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { updateActivity, deleteActivity, reorderActivities } = useTripStore();

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder activities
    const reorderedActivities = [...activities];
    const [removed] = reorderedActivities.splice(draggedIndex, 1);
    reorderedActivities.splice(dropIndex, 0, removed);

    // Update order indices
    const activityIds = reorderedActivities.map((a) => a.id);

    try {
      await reorderActivities(dayId, activityIds);
      onReorder?.(activityIds);
    } catch (error) {
      console.error('Failed to reorder activities:', error);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDelete = async (activityId: number) => {
    if (confirm('确定要删除这个活动吗？')) {
      try {
        await deleteActivity(activityId);
      } catch (error) {
        console.error('Failed to delete activity:', error);
        alert('删除失败，请重试');
      }
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    try {
      const time = new Date(`2000-01-01T${timeStr}`);
      return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        <Calendar {...getIconProps('decorative')} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-medium">这一天还没有活动</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity, index) => {
        const isPlace = activity.place_id !== null;
        const isDragging = draggedIndex === index;
        const isDropTarget = dragOverIndex === index;

        return (
          <div
            key={activity.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative cursor-move rounded-lg border-[1.5px] bg-white p-3 transition-all ${isDragging ? 'scale-[0.98] opacity-60' : 'hover:shadow-md'} ${isDropTarget ? 'border-2' : ''}`}
            style={{
              borderColor: isDropTarget ? 'var(--color-primary)' : isPlace ? 'var(--color-primary-light)' : 'var(--color-secondary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: isDragging ? 'none' : 'var(--shadow-sm)',
            }}
          >
            {/* Drag handle */}
            <div className="absolute left-2 top-3 cursor-grab active:cursor-grabbing" style={{ color: 'var(--color-gray-500)' }}>
              <GripVertical {...getIconProps('action')} />
            </div>

            {/* Content */}
            <div className="pl-6 pr-8">
              {/* Order number */}
              <div
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {index + 1}
              </div>

              {/* Title */}
              <h4 className="mb-1 text-sm font-semibold text-gray-900">
                {isPlace ? activity.place_name : activity.reservation_name}
              </h4>

              {/* Address for places */}
              {isPlace && activity.place_address && (
                <p className="mb-2 line-clamp-1 text-xs text-gray-500">{activity.place_address}</p>
              )}

              {/* Time and duration */}
              <div className="flex items-center gap-3 text-xs text-gray-600">
                {activity.start_time && (
                  <div className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                    <Clock {...getIconProps('inline')} />
                    <span className="font-medium">{formatTime(activity.start_time)}</span>
                  </div>
                )}
                {activity.duration_minutes && (
                  <div className="flex items-center gap-1" style={{ color: 'var(--color-secondary)' }}>
                    <Calendar {...getIconProps('inline')} />
                    <span className="font-medium">{activity.duration_minutes} 分钟</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {activity.notes && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{activity.notes}</p>}
            </div>

            {/* Delete button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(activity.id)}
              className="absolute bottom-2 right-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              style={{ borderRadius: 'var(--radius-sm)' }}
              title="删除活动"
            >
              <Trash2 {...getIconProps('inline')} />
            </Button>

            {/* Image for places */}
            {isPlace && activity.place_image_url && (
              <div className="mt-2 overflow-hidden rounded">
                <img src={activity.place_image_url} alt={activity.place_name} className="h-24 w-full object-cover" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
