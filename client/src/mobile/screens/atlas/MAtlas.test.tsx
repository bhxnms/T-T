// FE-COMP-MATLAS-001 to FE-COMP-MATLAS-004
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../../../../tests/helpers/render';
import MAtlas from './MAtlas';

// The screen is presentation over useAtlas: everything below the header comes
// from the hook, so the test stubs the hook and drives the two layer toggles.
const useAtlasMock = vi.hoisted(() => vi.fn());
vi.mock('../../../pages/atlas/useAtlas', () => ({ useAtlas: useAtlasMock }));

function makeAtlas(overrides: Record<string, unknown> = {}) {
  return {
    t: (key: string) => key,
    navigate: vi.fn(),
    resolveName: (code: string) => code,
    loading: false,
    mapRef: { current: null },
    regionTooltipRef: { current: null },
    stats: { totalCountriesPlanned: 0 },
    countries: [],
    visitedCountries: [],
    showPlanned: false,
    togglePlanned: vi.fn(),
    showLandmarks: true,
    setShowLandmarks: vi.fn(),
    bucketList: [],
    selectedCountry: null,
    countryDetail: null,
    handleUnmarkCountry: vi.fn(),
    select_country_from_search: vi.fn(),
    atlas_country_options: [],
    selectedLandmark: null,
    setSelectedLandmark: vi.fn(),
    toggleLandmarkVisit: vi.fn(),
    ...overrides,
  };
}

describe('MAtlas layer toggles', () => {
  it('FE-COMP-MATLAS-001: renders the landmark toggle even when nothing is planned', () => {
    useAtlasMock.mockReturnValue(makeAtlas());
    render(<MAtlas />);

    // The landmark layer defaults to on, so its switch is not gated behind the
    // planned-count chip the way the planned-countries switch is.
    expect(screen.getByLabelText('atlas.showLandmarks')).toBeInTheDocument();
    expect(screen.queryByLabelText('atlas.showPlanned')).not.toBeInTheDocument();
  });

  it('FE-COMP-MATLAS-002: flipping the landmark switch toggles the shared layer state', () => {
    const setShowLandmarks = vi.fn();
    useAtlasMock.mockReturnValue(makeAtlas({ setShowLandmarks }));
    render(<MAtlas />);

    fireEvent.click(screen.getByLabelText('atlas.showLandmarks'));

    // The state setter carries the reducer, so assert on the updater's result
    // rather than on a value the stub never stores.
    expect(setShowLandmarks).toHaveBeenCalledTimes(1);
    const updater = setShowLandmarks.mock.calls[0][0] as (prev: boolean) => boolean;
    expect(updater(true)).toBe(false);
    expect(updater(false)).toBe(true);
  });

  it('FE-COMP-MATLAS-003: the switch reflects the persisted off state', () => {
    useAtlasMock.mockReturnValue(makeAtlas({ showLandmarks: false }));
    render(<MAtlas />);

    expect(screen.getByLabelText('atlas.showLandmarks')).toHaveAttribute('aria-checked', 'false');
  });

  it('FE-COMP-MATLAS-004: the planned-countries switch returns alongside the landmark switch', () => {
    const togglePlanned = vi.fn();
    useAtlasMock.mockReturnValue(makeAtlas({ stats: { totalCountriesPlanned: 3 }, togglePlanned }));
    render(<MAtlas />);

    const planned = screen.getByLabelText('atlas.showPlanned');
    expect(planned).toBeInTheDocument();
    expect(screen.getByLabelText('atlas.showLandmarks')).toBeInTheDocument();

    fireEvent.click(planned);
    expect(togglePlanned).toHaveBeenCalledTimes(1);
  });
});
