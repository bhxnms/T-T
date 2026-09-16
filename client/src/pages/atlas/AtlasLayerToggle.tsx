import React from 'react';
import ToggleSwitch from '../../components/Settings/ToggleSwitch';
import type { TranslationFn } from '../../types';

interface AtlasLayerToggleProps {
  t: TranslationFn;
  showPlanned: boolean;
  onToggle: () => void;
  plannedCount: number;
  showLandmarks?: boolean;
  onToggleLandmarks?: () => void;
}

// Floating switch that reveals the countries you only plan to visit (#1048). Hidden
// entirely when there is nothing planned — an always-present control for an empty set
// is just clutter over the globe. Sits on the desktop map only; MAtlas renders the
// same two layers as compact chips in its top control row.
export default function AtlasLayerToggle({
  t,
  showPlanned,
  onToggle,
  plannedCount,
  showLandmarks,
  onToggleLandmarks,
}: AtlasLayerToggleProps): React.ReactElement | null {
  return (
    <div
      data-testid="atlas-layer-toggle"
      className="absolute z-20 hidden md:flex"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 18 }}
    >
      <div
        className="flex items-center gap-3 rounded-full border border-edge"
        style={{
          padding: '8px 14px',
          background: 'var(--bg-elevated)',
          boxShadow: 'var(--shadow-popover)',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
        }}
      >
        {plannedCount > 0 && (
          <>
            <span className="whitespace-nowrap text-caption font-semibold text-content">{t('atlas.showPlanned')}</span>
            <span className="text-caption font-bold tabular-nums text-content-muted">{plannedCount}</span>
            <ToggleSwitch on={showPlanned} onToggle={onToggle} label={t('atlas.showPlanned')} />
          </>
        )}
        <span className="whitespace-nowrap text-caption font-semibold text-content">{t('atlas.showLandmarks')}</span>
        <ToggleSwitch
          on={showLandmarks ?? true}
          onToggle={onToggleLandmarks ?? (() => {})}
          label={t('atlas.showLandmarks')}
        />
      </div>
    </div>
  );
}
