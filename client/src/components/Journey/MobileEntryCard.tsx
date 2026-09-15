import {
  Camera,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Frown,
  Laugh,
  MapPin,
  Meh,
  Smile,
  Snowflake,
  Sun,
} from 'lucide-react';
import type { JourneyEntry } from '../../store/journeyStore';
import { formatLocationName } from '../../utils/formatters';

const MOOD_ICONS: Record<string, typeof Smile> = {
  amazing: Laugh,
  good: Smile,
  neutral: Meh,
  rough: Frown,
};

const MOOD_COLORS: Record<string, string> = {
  amazing: 'text-pink-500',
  good: 'text-amber-500',
  neutral: 'text-zinc-400',
  rough: 'text-violet-500',
};

const WEATHER_ICONS: Record<string, typeof Sun> = {
  sunny: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  rainy: CloudRain,
  stormy: CloudLightning,
  cold: Snowflake,
};

// Shared journeys hand us photos that only carry `id`, the journey's own
// photos carry `photo_id` — accept either.
function photoId(p: { photo_id?: number; id?: number }): number | undefined {
  return p.photo_id ?? p.id;
}

function photoUrl(id: number): string {
  return `/api/photos/${id}/thumbnail`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_~`>\[\]()!|-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

interface Props {
  entry:
    | JourneyEntry
    | {
        id: number;
        type: string;
        title?: string | null;
        location_name?: string | null;
        location_lat?: number | null;
        location_lng?: number | null;
        entry_date: string;
        entry_time?: string | null;
        mood?: string | null;
        weather?: string | null;
        photos?: { photo_id: number }[];
        story?: string | null;
      };
  dayLabel: number;
  dayColor: string;
  isActive: boolean;
  onClick: () => void;
  publicPhotoUrl?: (photoId: number) => string;
}

export default function MobileEntryCard({ entry, dayLabel, dayColor, isActive, onClick, publicPhotoUrl }: Props) {
  const hasLocation = !!(entry.location_lat && entry.location_lng);
  const hasPhotos = entry.photos && entry.photos.length > 0;
  const firstPhoto = hasPhotos ? entry.photos![0] : null;
  const MoodIcon = entry.mood ? MOOD_ICONS[entry.mood] : null;
  const moodColor = entry.mood ? MOOD_COLORS[entry.mood] : '';
  const WeatherIcon = entry.weather ? WEATHER_ICONS[entry.weather] : null;

  const firstPhotoId = firstPhoto ? photoId(firstPhoto) : undefined;
  const thumbSrc = firstPhotoId == null ? null : publicPhotoUrl ? publicPhotoUrl(firstPhotoId) : photoUrl(firstPhotoId);

  const date = new Date(entry.entry_date + 'T00:00:00');
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const storyPreview = entry.story ? stripMarkdown(entry.story) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 overflow-hidden rounded-xl text-left transition-all duration-100 ${
        isActive
          ? 'w-[320px] bg-white shadow-lg ring-2 ring-zinc-900/70 dark:bg-zinc-800 dark:ring-white/60 sm:w-[340px]'
          : 'w-[240px] bg-white/90 shadow-md dark:bg-zinc-800/90 sm:w-[260px]'
      } backdrop-blur-lg`}
    >
      <div className={`flex ${isActive ? 'h-[140px]' : 'h-[110px]'} transition-all duration-100`}>
        {/* Photo thumbnail */}
        {thumbSrc ? (
          <div
            className={`${isActive ? 'w-[110px]' : 'w-[90px]'} relative flex-shrink-0 overflow-hidden transition-all duration-100`}
          >
            <img src={thumbSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
            {hasPhotos && entry.photos!.length > 1 && (
              <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium text-white">
                <Camera size={10} />
                {entry.photos!.length}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`${isActive ? 'w-[110px]' : 'w-[90px]'} flex flex-shrink-0 items-center justify-center bg-zinc-100 transition-all duration-100 dark:bg-zinc-700`}
          >
            <MapPin size={20} className="text-zinc-300 dark:text-zinc-500" />
          </div>
        )}

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col p-3">
          {/* Day number + date + mood/weather */}
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ background: dayColor }}
            >
              {dayLabel}
            </span>
            <span className="text-[11px] font-medium text-zinc-400">{dateStr}</span>
            {entry.entry_time && <span className="text-[11px] text-zinc-400">· {entry.entry_time.slice(0, 5)}</span>}
            <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
              {MoodIcon && (
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                    entry.mood === 'amazing'
                      ? 'bg-pink-100 dark:bg-pink-900/30'
                      : entry.mood === 'good'
                        ? 'bg-amber-100 dark:bg-amber-900/30'
                        : entry.mood === 'rough'
                          ? 'bg-violet-100 dark:bg-violet-900/30'
                          : 'bg-zinc-100 dark:bg-zinc-700'
                  }`}
                >
                  <MoodIcon size={11} className={moodColor} />
                </span>
              )}
              {WeatherIcon && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <WeatherIcon size={11} className="text-zinc-500 dark:text-zinc-400" />
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <h4 className="truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-white">
            {entry.title ||
              (entry.type === 'checkin' ? 'Check-in' : entry.type === 'skeleton' ? 'Add your story…' : 'Untitled')}
          </h4>

          {/* Story preview (1-2 lines, only on active card) */}
          {isActive && storyPreview && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
              {storyPreview}
            </p>
          )}

          {/* Location badge */}
          <div className="mt-auto flex items-center gap-1">
            {hasLocation ? (
              <span className="inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                <MapPin size={10} className="flex-shrink-0" />
                <span className="truncate">{formatLocationName(entry.location_name) || 'On the map'}</span>
              </span>
            ) : (
              <span className="text-[10px] italic text-zinc-400">No location</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
