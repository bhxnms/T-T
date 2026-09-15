import { Calendar, Clock, Home, MapPin } from 'lucide-react';
import type { ActivityWithDetails } from '../../types';
import { getIconProps } from './iconConfig';

interface ActivityCardProps {
  activity: ActivityWithDetails;
  onEdit?: (activity: ActivityWithDetails) => void;
  onDelete?: (id: number) => void;
  isDragging?: boolean;
}

export default function ActivityCard({ activity, onEdit, onDelete, isDragging }: ActivityCardProps) {
  const isPlace = activity.place_id !== null;
  const isReservation = activity.reservation_id !== null;

  // Format time
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    try {
      const time = new Date(`2000-01-01T${timeStr}`);
      return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  return (
    <div
      className={`relative rounded-lg border-[1.5px] bg-white p-3 transition-all ${isDragging ? 'scale-[0.98] opacity-60' : 'hover:shadow-md'}`}
      style={{
        borderColor: isPlace ? 'var(--color-primary-light)' : 'var(--color-secondary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isDragging ? 'none' : 'var(--shadow-sm)',
      }}
    >
      {/* Type indicator */}
      <div className="absolute right-2 top-2">
        {isPlace ? (
          <MapPin {...getIconProps('activity')} style={{ color: 'var(--color-primary)' }} />
        ) : (
          <Home {...getIconProps('activity')} style={{ color: 'var(--color-secondary)' }} />
        )}
      </div>

      {/* Content */}
      <div className="pr-6">
        {/* Title */}
        <h4 className="mb-1 text-sm font-semibold text-gray-900">
          {isPlace ? activity.place_name : activity.reservation_name}
        </h4>

        {/* Address for places */}
        {isPlace && activity.place_address && (
          <p className="mb-2 line-clamp-1 text-xs text-gray-500">{activity.place_address}</p>
        )}

        {/* Reservation type */}
        {isReservation && activity.reservation_type && (
          <p className="mb-2 text-xs capitalize text-gray-500">{activity.reservation_type}</p>
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
              <span className="font-medium">{activity.duration_minutes} min</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {activity.notes && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{activity.notes}</p>}
      </div>

      {/* Image for places */}
      {isPlace && activity.place_image_url && (
        <div className="mt-2 overflow-hidden rounded">
          <img src={activity.place_image_url} alt={activity.place_name} className="h-24 w-full object-cover" />
        </div>
      )}

      {/* Confirmation number for reservations */}
      {isReservation && activity.reservation_confirmation_number && (
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Confirmation:</span> {activity.reservation_confirmation_number}
        </div>
      )}

      {/* Order indicator */}
      <div
        className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {activity.order_index + 1}
      </div>
    </div>
  );
}
