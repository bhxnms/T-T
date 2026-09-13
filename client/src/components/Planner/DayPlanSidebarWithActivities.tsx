import { Calendar, ListChecks } from 'lucide-react';
import { useState } from 'react';
import ActivitiesPanel from '../Activities/ActivitiesPanel';
import { getIconProps } from '../Activities/iconConfig';
import Button from '../shared/Button';
import DayPlanSidebar, { type DayPlanSidebarProps } from './DayPlanSidebar';

type DayPlanSidebarWithActivitiesProps = DayPlanSidebarProps;

/**
 * Wrapper component that provides a toggle between the classic DayPlanSidebar
 * and the new Activities-based view
 */
export default function DayPlanSidebarWithActivities(props: DayPlanSidebarWithActivitiesProps) {
  const [viewMode, setViewMode] = useState<'classic' | 'activities'>('classic');

  return (
    <div className="flex h-full flex-col">
      {/* View mode toggle */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 p-3">
        <Button
          type="button"
          variant={viewMode === 'classic' ? 'primary' : 'ghost'}
          size="md"
          onClick={() => setViewMode('classic')}
          className="flex-1 px-3 py-2 text-sm"
        >
          <ListChecks {...getIconProps('toggle')} />
          <span className="hidden sm:inline font-medium">传统视图</span>
        </Button>
        <Button
          type="button"
          variant={viewMode === 'activities' ? 'primary' : 'ghost'}
          size="md"
          onClick={() => setViewMode('activities')}
          className="flex-1 px-3 py-2 text-sm"
        >
          <Calendar {...getIconProps('toggle')} />
          <span className="hidden sm:inline font-medium">活动视图</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'classic' ? (
          <DayPlanSidebar {...props} />
        ) : (
          <ActivitiesPanel
            tripId={props.tripId}
            selectedDayId={props.selectedDayId}
            days={props.days}
            onSelectDay={props.onSelectDay}
          />
        )}
      </div>
    </div>
  );
}
