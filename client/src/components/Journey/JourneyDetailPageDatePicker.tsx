import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../i18n';
import { localIsoDate } from '../../utils/localDate';

export function DatePicker({
  value,
  onChange,
  tripDates,
}: {
  value: string;
  onChange: (date: string) => void;
  tripDates?: Set<string>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  // Monday-first, matching CustomDateTimePicker / VacayCalendar (getDay() is Sunday=0).
  const firstDow = (new Date(viewMonth.year, viewMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(viewMonth.year, viewMonth.month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () => {
    setViewMonth((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }));
  };
  const nextMonth = () => {
    setViewMonth((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }));
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const formatted = value
    ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-[13px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      >
        {formatted ? (
          <span>{formatted}</span>
        ) : (
          <span>
            <span className="hidden sm:inline">{t('journey.picker.selectDate')}</span>
            <span className="sm:hidden">{t('common.date')}</span>
          </span>
        )}
        <Calendar size={13} className="text-zinc-400" />
      </button>

      {open && (
        <>
          {/* Click-away catcher — no semantics of its own; the trigger button
              above closes the popover again from the keyboard. */}
          <div role="presentation" className="fixed inset-0 z-[10]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-[20] mt-1 w-[280px] rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <ArrowLeft size={14} />
              </button>
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-white">{monthName}</span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="mb-1 grid grid-cols-7">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
                <div key={i} className="py-1 text-center text-[10px] font-medium text-zinc-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const dateStr = `${viewMonth.year}-${pad(viewMonth.month + 1)}-${pad(day)}`;
                const isSelected = dateStr === value;
                const isTrip = tripDates?.has(dateStr);
                const isToday = dateStr === localIsoDate();

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => {
                      onChange(dateStr);
                      setOpen(false);
                    }}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-medium transition-colors ${
                      isSelected
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                        : isToday
                          ? 'font-bold text-zinc-900 dark:text-white'
                          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {day}
                    {isTrip && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
