import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Minus,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Unlink,
} from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import PageShell from '../components/Layout/PageShell';
import Modal from '../components/shared/Modal';
import VacayCalendar from '../components/Vacay/VacayCalendar';
import VacayPersons from '../components/Vacay/VacayPersons';
import VacaySettings from '../components/Vacay/VacaySettings';
import VacaySharedCalendars from '../components/Vacay/VacaySharedCalendars';
import VacayStats from '../components/Vacay/VacayStats';
import { useTranslation } from '../i18n';
import { useVacay } from './vacay/useVacay';

export default function VacayPage(): React.ReactElement {
  // ViewportRoute in App.tsx picks the branch now, so the phone screen is a
  // chunk of its own instead of a dead limb in this one.
  return <VacayPageDesktop />;
}

function VacayPageDesktop(): React.ReactElement {
  const { t } = useTranslation();
  // Page = wiring container: vacay store, live sync + UI state live in the hook.
  const {
    years,
    selectedYear,
    setSelectedYear,
    removeYear,
    loading,
    incomingInvites,
    acceptInvite,
    declineInvite,
    plan,
    sharedCalendars,
    showSettings,
    setShowSettings,
    deleteYear,
    setDeleteYear,
    showMobileSidebar,
    setShowMobileSidebar,
    handleAddNextYear,
    handleAddPrevYear,
  } = useVacay();

  const hasVisibleShared = sharedCalendars.some((c) => !c.hidden);

  if (loading) {
    return (
      <PageShell
        background="var(--vg-bg)"
        contentClassName="flex items-center justify-center"
        contentStyle={{ minHeight: 'calc(100vh - var(--nav-h))' }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-content" />
      </PageShell>
    );
  }

  // Sidebar content (shared between desktop sidebar and mobile drawer)
  const sidebarContent = (
    <>
      {/* Year Selector */}
      <div className="vg-card rounded-[22px]" style={{ padding: '14px 18px' }}>
        <div className="mb-3">
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--vg-ink3)',
            }}
          >
            {t('vacay.year')}
          </span>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleAddPrevYear}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--vg-ink3)' }}
              title={t('vacay.addPrevYear')}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                const idx = years.indexOf(selectedYear);
                if (idx > 0) setSelectedYear(years[idx - 1]);
              }}
              disabled={years.indexOf(selectedYear) <= 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-20"
              style={{ color: 'var(--vg-ink3)' }}
            >
              <ChevronLeft size={16} />
            </button>
          </div>
          <span className="tabular-nums" style={{ fontSize: 22, fontWeight: 700, color: 'var(--vg-ink)' }}>
            {selectedYear}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                const idx = years.indexOf(selectedYear);
                if (idx < years.length - 1) setSelectedYear(years[idx + 1]);
              }}
              disabled={years.indexOf(selectedYear) >= years.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-20"
              style={{ color: 'var(--vg-ink3)' }}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleAddNextYear}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--vg-ink3)' }}
              title={t('vacay.addYear')}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {years.map((y) => (
            <div
              key={y}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedYear(y)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedYear(y);
                }
              }}
              className="group relative cursor-pointer rounded-[9px] text-center transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{
                padding: '7px 0',
                fontSize: 12,
                fontWeight: 600,
                background: y === selectedYear ? 'var(--vg-ink)' : 'var(--vg-surf2)',
                color: y === selectedYear ? 'var(--vg-bg)' : 'var(--vg-ink2)',
              }}
            >
              {y}
              {years.length > 1 && (
                <button
                  type="button"
                  aria-label={t('vacay.removeYear')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteYear(y);
                    setShowMobileSidebar(false);
                  }}
                  className="absolute -right-1 -top-1 flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-[7px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Minus size={7} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <VacayPersons />

      <VacaySharedCalendars />

      {/* Legend */}
      {(plan?.holidays_enabled ||
        plan?.school_holidays_enabled ||
        plan?.company_holidays_enabled ||
        plan?.block_weekends ||
        hasVisibleShared) && (
        <div className="vg-card rounded-[22px]" style={{ padding: '14px 18px' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--vg-ink3)',
            }}
          >
            {t('vacay.legend')}
          </span>
          <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-2.5">
            {plan?.holidays_enabled &&
              (plan?.holiday_calendars ?? []).filter((cal) => (cal.type ?? 'public_holiday') === 'public_holiday')
                .length === 0 && <LegendItem color="#fecaca" label={t('vacay.publicHoliday')} />}
            {plan?.holidays_enabled &&
              (plan?.holiday_calendars ?? [])
                .filter((cal) => (cal.type ?? 'public_holiday') === 'public_holiday')
                .map((cal) => <LegendItem key={cal.id} color={cal.color} label={cal.label || cal.region} />)}
            {plan?.school_holidays_enabled &&
              (plan?.holiday_calendars ?? [])
                .filter((cal) => cal.type === 'school_holiday')
                .map((cal) => <LegendItem key={cal.id} color={cal.color} label={cal.label || cal.region} />)}
            {plan?.company_holidays_enabled && <LegendItem color="#fde68a" label={t('vacay.companyHoliday')} />}
            {plan?.block_weekends && <LegendItem color="#e5e7eb" label={t('vacay.weekend')} />}
            {hasVisibleShared && <LegendItem ring label={t('vacay.sharedLegend')} />}
          </div>
        </div>
      )}

      <VacayStats />
    </>
  );

  return (
    <PageShell background="var(--vg-bg)">
      <div className="mx-auto max-w-[1800px] px-3 py-4 sm:px-4 lg:px-8 lg:py-9">
        {/* Mobile + tablet header (filter toggle lives here) */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-secondary">
              <CalendarDays size={18} className="text-content" />
            </div>
            <h1 className="text-lg font-bold text-content">{t('admin.addons.catalog.vacay.name')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMobileSidebar(true)}
              className="flex items-center gap-1.5 rounded-lg bg-surface-secondary px-3 py-1.5 text-sm text-content-muted transition-colors lg:hidden"
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 rounded-lg bg-surface-secondary px-3 py-1.5 text-sm text-content-muted transition-colors"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="flex items-start gap-4 lg:gap-7">
          {/* Desktop Sidebar */}
          <div className="sticky top-[84px] hidden w-[300px] shrink-0 flex-col gap-[12px] lg:flex">
            {sidebarContent}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="vg-card flex items-center justify-center gap-2.5 rounded-[18px] transition-transform hover:-translate-y-px"
              style={{ padding: '13px 16px', fontSize: 14, fontWeight: 600, color: 'var(--vg-ink)', cursor: 'pointer' }}
            >
              <Settings size={16} strokeWidth={2.2} /> {t('vacay.settings')}
            </button>
          </div>

          {/* Calendar */}
          <div className="min-w-0 flex-1">
            <VacayCalendar />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      {showMobileSidebar &&
        createPortal(
          <div className="fixed inset-0 lg:hidden" style={{ zIndex: 99980 }}>
            <div
              className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
              role="presentation"
              onClick={() => setShowMobileSidebar(false)}
            />
            <div
              className="absolute bottom-0 left-0 top-0 flex w-[280px] flex-col gap-3 overflow-y-auto bg-surface p-3"
              style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.15)', animation: 'slideInLeft 0.2s ease-out' }}
            >
              {sidebarContent}
            </div>
          </div>,
          document.body
        )}

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title={t('vacay.settings')} size="3xl">
        <VacaySettings onClose={() => setShowSettings(false)} />
      </Modal>

      {/* Delete Year Modal */}
      <Modal isOpen={deleteYear !== null} onClose={() => setDeleteYear(null)} title={t('vacay.removeYear')} size="sm">
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-[rgba(239,68,68,0.15)] bg-[rgba(239,68,68,0.08)] p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-content">{t('vacay.removeYearConfirm', { year: deleteYear })}</p>
              <p className="mt-1 text-xs text-content-muted">{t('vacay.removeYearHint')}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteYear(null)}
              className="rounded-lg border border-edge px-4 py-2 text-sm text-content-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={async () => {
                await removeYear(deleteYear);
                setDeleteYear(null);
              }}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
            >
              {t('vacay.remove')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Incoming invite — forced fullscreen modal */}
      {incomingInvites.length > 0 &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.7)] px-4"
            style={{ zIndex: 99995, backdropFilter: 'blur(8px)' }}
          >
            {incomingInvites.map((inv) => (
              <div
                key={inv.plan_id}
                className="trek-modal-enter w-full max-w-md overflow-hidden rounded-2xl bg-surface-card shadow-2xl"
              >
                <div className="px-6 pb-4 pt-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-secondary text-lg font-bold text-content">
                    {inv.owner_username?.[0]?.toUpperCase()}
                  </div>
                  <h2 className="mb-1 text-lg font-bold text-content">{t('vacay.inviteTitle')}</h2>
                  <p className="text-sm text-content-muted">
                    <span className="font-semibold text-content">{inv.owner_username}</span>{' '}
                    {t('vacay.inviteWantsToFuse')}
                  </p>
                </div>
                <div className="space-y-2 px-6 pb-4">
                  <InfoItem icon={Eye} text={t('vacay.fuseInfo1')} />
                  <InfoItem icon={Pencil} text={t('vacay.fuseInfo2')} />
                  <InfoItem icon={Trash2} text={t('vacay.fuseInfo3')} />
                  <InfoItem icon={ShieldCheck} text={t('vacay.fuseInfo4')} />
                  <InfoItem icon={Unlink} text={t('vacay.fuseInfo5')} />
                </div>
                <div className="flex gap-3 px-6 pb-6">
                  <button
                    type="button"
                    onClick={() => declineInvite(inv.plan_id)}
                    className="flex-1 rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-content-muted transition-colors"
                  >
                    {t('vacay.decline')}
                  </button>
                  <button
                    type="button"
                    onClick={() => acceptInvite(inv.plan_id)}
                    className="flex-1 rounded-xl bg-content px-4 py-2.5 text-sm font-medium text-surface-card transition-colors"
                  >
                    {t('vacay.acceptFusion')}
                  </button>
                </div>
              </div>
            ))}
          </div>,
          document.body
        )}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </PageShell>
  );
}

function InfoItem({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  text: string;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-surface-secondary px-3 py-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-content-muted" />
      <span className="text-xs text-content">{text}</span>
    </div>
  );
}

function LegendItem({ color, label, ring }: { color?: string; label: string; ring?: boolean }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-[7px]">
      {/* Shared calendars render as rings in the grid, so the legend swatch does too. */}
      {ring ? (
        <span style={{ width: 18, height: 12, borderRadius: 4, flex: 'none', border: '2px solid var(--vg-ink2)' }} />
      ) : (
        <span style={{ width: 18, height: 12, borderRadius: 4, flex: 'none', background: color }} />
      )}
      <span style={{ fontSize: 12, color: 'var(--vg-ink2)' }}>{label}</span>
    </span>
  );
}
