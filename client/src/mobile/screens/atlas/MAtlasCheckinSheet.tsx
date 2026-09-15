import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAllLandmarks } from '../../../data/chinaProvinces';
import { useTranslation } from '../../../i18n';
import { getCheckedPlaces } from '../../../utils/checkinStorage';
import { getLandmarkColor } from '../../../utils/landmarkIcons';
import { getVisitedLandmarks } from '../../../utils/landmarkStorage';
import MIconBtn from '../../components/MIconBtn';
import MSheet from '../../components/MSheet';

interface MAtlasCheckinSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 打卡点 sheet — the mobile counterpart of the desktop Atlas "Check-ins" tab:
 * one total plus the two source lists (visited China landmarks and trip places
 * checked in from the planner). Both stores are client-side; the lists re-read
 * whenever a check-in toggles ('tt-checkins-changed') or another tab syncs
 * ('storage').
 */
export default function MAtlasCheckinSheet({ open, onClose }: MAtlasCheckinSheetProps) {
  const { t, language } = useTranslation();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener('tt-checkins-changed', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('tt-checkins-changed', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const visitedLandmarks = (() => {
    void version;
    const visited = getVisitedLandmarks();
    return getAllLandmarks().filter((l) => visited.has(`${l.provinceCode}:${l.name}`));
  })();
  const checkedPlaces = (() => {
    void version;
    return getCheckedPlaces();
  })();
  const total = visitedLandmarks.length + checkedPlaces.length;

  return (
    <MSheet open={open} onClose={onClose} variant="bottom" material="glass" ariaLabel={t('atlas.checkinTab')}>
      <div className="flex max-h-[70dvh] min-h-0 flex-col p-4">
        <div className="flex items-center gap-[10px] px-1 pb-3">
          <CheckCircle2 size={17} strokeWidth={2.2} className="flex-none text-m-act" />
          <div className="min-w-0 flex-1 truncate text-[0.9375rem] font-extrabold text-m-ink">
            {t('atlas.checkinTab')}
            <span className="ml-[6px] font-geist text-[0.75rem] font-semibold tabular-nums text-m-faint">{total}</span>
          </div>
          <MIconBtn variant="neutral" size={34} onClick={onClose} ariaLabel={t('common.close')}>
            <X size={16} strokeWidth={2.2} />
          </MIconBtn>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {total === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="text-[0.84375rem] font-semibold text-m-muted">{t('atlas.checkinEmpty')}</div>
            </div>
          )}

          {visitedLandmarks.length > 0 && (
            <>
              <div className="px-1 pt-1 font-geist text-[0.625rem] font-bold uppercase tracking-[.06em] text-m-faint">
                {t('atlas.checkinLandmarks')} · {visitedLandmarks.length}
              </div>
              {visitedLandmarks.map((l) => (
                <div
                  key={`${l.provinceCode}:${l.name}`}
                  className="flex items-center gap-3 rounded-[18px] bg-[color:var(--m-ic)] px-[14px] py-[11px]"
                >
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: getLandmarkColor(l.type) }} />
                  <span className="min-w-0 flex-1 truncate text-[0.84375rem] font-semibold text-m-ink">{l.name}</span>
                  <span className="flex-none font-geist text-[0.65625rem] text-m-faint">{l.provinceName}</span>
                </div>
              ))}
            </>
          )}

          {checkedPlaces.length > 0 && (
            <>
              <div className="px-1 pt-2 font-geist text-[0.625rem] font-bold uppercase tracking-[.06em] text-m-faint">
                {t('atlas.checkinPlaces')} · {checkedPlaces.length}
              </div>
              {checkedPlaces.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-[18px] bg-[color:var(--m-ic)] px-[14px] py-[11px]"
                >
                  <span className="h-2 w-2 flex-none rounded-full bg-[#10b981]" />
                  <span className="min-w-0 flex-1 truncate text-[0.84375rem] font-semibold text-m-ink">{p.name}</span>
                  {p.checkedAt > 0 && (
                    <span className="flex-none font-geist text-[0.65625rem] text-m-faint">
                      {new Date(p.checkedAt).toLocaleDateString(language)}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </MSheet>
  );
}
