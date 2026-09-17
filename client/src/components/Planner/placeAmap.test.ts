import { describe, expect, it } from 'vitest';
import type { Place } from '../../types';
import { getAmapUrlForPlace } from './placeAmap';

// FE-PLANNER-AMAPNAV-001 onwards

function place(overrides: Partial<Place> = {}): Place {
  return {
    name: 'Stephansdom',
    lat: 48.2038,
    lng: 16.3616,
    amap_id: null,
    ...overrides,
  } as unknown as Place;
}

describe('getAmapUrlForPlace', () => {
  it('FE-PLANNER-AMAPNAV-001: prefers the POI id, which resolves the exact entry', () => {
    const url = getAmapUrlForPlace(place({ amap_id: 'B0MRJ44YYT' }));
    expect(url).toContain('https://uri.amap.com/marker');
    expect(url).toContain('poiid=B0MRJ44YYT');
    // The coordinate form is not used when an id is available.
    expect(url).not.toContain('position=');
  });

  it('FE-PLANNER-AMAPNAV-002: falls back to coordinates, declaring the WGS-84 frame', () => {
    const url = getAmapUrlForPlace(place());
    // position is lng,lat — the reverse of how the place stores them.
    expect(url).toContain('position=16.3616,48.2038');
    // Without this AMap assumes GCJ-02 and the pin lands a few hundred metres off.
    expect(url).toContain('coordinate=wgs84');
    expect(url).toContain('name=Stephansdom');
  });

  it('FE-PLANNER-AMAPNAV-003: carries the name so the pin is labelled', () => {
    const url = getAmapUrlForPlace(place({ name: 'Café Größenwahn' }));
    expect(url).toContain(`name=${encodeURIComponent('Café Größenwahn')}`);
  });

  it('FE-PLANNER-AMAPNAV-004: omits the name when the place has none', () => {
    const url = getAmapUrlForPlace(place({ name: '' }));
    expect(url).not.toContain('name=');
    expect(url).toContain('position=');
  });

  it('FE-PLANNER-AMAPNAV-005: a place with neither id nor coordinates gets no link', () => {
    // Never a name-only link: AMap would search for it and could land elsewhere.
    expect(getAmapUrlForPlace(place({ lat: null, lng: null }))).toBeNull();
    expect(getAmapUrlForPlace(place({ lat: null, lng: null, amap_id: null }))).toBeNull();
    expect(getAmapUrlForPlace(null)).toBeNull();
  });

  it('FE-PLANNER-AMAPNAV-006: an id alone is enough, even with no coordinates', () => {
    expect(getAmapUrlForPlace(place({ lat: null, lng: null, amap_id: 'B0MRJ44YYT' }))).toContain('poiid=B0MRJ44YYT');
  });

  it('FE-PLANNER-AMAPNAV-007: latitude 0 and longitude 0 are real coordinates', () => {
    const url = getAmapUrlForPlace(place({ lat: 0, lng: 0 }));
    expect(url).toContain('position=0,0');
  });

  it('FE-PLANNER-AMAPNAV-008: labels the caller, never a credential', () => {
    expect(getAmapUrlForPlace(place())).toContain('src=tt-travel-planner');
  });
});
