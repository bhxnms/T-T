import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../../tests/helpers/render';
import type { TranslationFn } from '../../types';
import AtlasLayerToggle from './AtlasLayerToggle';

// FE-ATLAS-TOGGLE-001 to FE-ATLAS-TOGGLE-003

const t = ((key: string) => key) as TranslationFn;

describe('AtlasLayerToggle', () => {
  it('FE-ATLAS-TOGGLE-001: stays out of the way while nothing is planned', () => {
    const { container } = render(<AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={0} />);

    expect(screen.queryByText('atlas.showPlanned')).not.toBeInTheDocument();
    expect(screen.getByText('atlas.showLandmarks')).toBeInTheDocument();
  });

  it('FE-ATLAS-TOGGLE-002: shows the label and how many countries the layer would add', () => {
    render(<AtlasLayerToggle t={t} showPlanned={false} onToggle={vi.fn()} plannedCount={4} />);

    expect(screen.getByText('atlas.showPlanned')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'atlas.showPlanned' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('FE-ATLAS-TOGGLE-003: reports the flip and reflects the current state', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<AtlasLayerToggle t={t} showPlanned={false} onToggle={onToggle} plannedCount={4} />);

    fireEvent.click(screen.getByRole('button', { name: 'atlas.showPlanned' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<AtlasLayerToggle t={t} showPlanned onToggle={onToggle} plannedCount={4} />);
    expect(screen.getByRole('button', { name: 'atlas.showPlanned' })).toHaveAttribute('aria-pressed', 'true');
  });

  // The component test above uses an identity `t`, so it can only prove WHICH
  // keys are requested — never that they resolve. That is exactly how
  // `atlas.showLandmarks` shipped untranslated in every locale: the label
  // rendered as the literal string "atlas.showLandmarks" on the real map, and
  // FE-ATLAS-TOGGLE-001 happily asserted that raw key as the expected text.
  it('FE-ATLAS-TOGGLE-004: every key this component asks for exists in the bundles', async () => {
    const en = (await import('@trek/shared/i18n/en')).default;
    const strings = en as unknown as Record<string, string>;

    const requested: string[] = [];
    const recording = ((key: string) => {
      requested.push(key);
      return key;
    }) as TranslationFn;

    render(<AtlasLayerToggle t={recording} showPlanned onToggle={vi.fn()} plannedCount={3} />);

    expect(requested.length).toBeGreaterThan(0);
    for (const key of requested) {
      expect(strings[key], `${key} is missing from the en bundle`).toBeTypeOf('string');
    }
  });
});
