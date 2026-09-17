/**
 * Unit tests for the AMap (高德) Web-Service adapter — AMAP-SVC-001 onwards.
 *
 * The cases here exist because the adapter talks to the v5 POI endpoints, whose
 * parameter names and response shape are NOT the v3 ones. A regression that
 * sends v3 spellings (`offset`/`page`/`extensions`) or reads v3 response paths
 * (`poi.biz_ext`) makes AMap answer `status: 0`; the search path then silently
 * degrades to the native providers, which on a China-only network look like
 * "place search is broken". Both halves are pinned below.
 *
 * fetch is stubbed; the DB module is mocked.
 */
import { amapPlaceDetail, amapSearchPlaces } from '../../../src/nest/geo/amap.service';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInstanceGet } = vi.hoisted(() => ({
  mockInstanceGet: vi.fn((..._args: unknown[]) => undefined as any),
}));

/** The DatabaseService seam amap.service reads through (get + prepare). */
const dbStub = { get: (...args: unknown[]) => mockInstanceGet(...args) } as any;

vi.mock('../../../src/db/database', () => ({
  db: { get: (...args: unknown[]) => mockInstanceGet(...args), prepare: () => ({ all: () => [], run: () => {} }) },
}));

vi.mock('../../../src/nest/common/crypto/apiKeyCrypto', () => ({
  decrypt_api_key: (v: string | null) => v,
  maybe_encrypt_api_key: (v: unknown) => v,
  encrypt_api_key: (v: unknown) => v,
  is_encrypted_api_key: () => false,
}));

/** One v5 POI carrying every field the adapter maps. */
const v5Poi = {
  id: 'B000A83M61',
  name: '故宫博物院',
  location: '116.397451,39.916342',
  type: '风景名胜;风景名胜;世界遗产',
  pname: '北京市',
  cityname: '北京市',
  adname: '东城区',
  address: '景山前街4号',
  business: {
    tel: '010-85007421',
    rating: '4.7',
    cost: '60',
    business_area: '天安门地区',
    opentime_today: '08:30-17:00',
  },
  photos: [
    { title: '故宫', url: 'https://store.is.autonavi.com/showpic/1' },
    { title: '太和殿', url: 'https://store.is.autonavi.com/showpic/2' },
  ],
};

function stubFetch(payload: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => payload });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function keyConfigured(): void {
  mockInstanceGet.mockReturnValue({ value: 'test-amap-key' });
}

beforeEach(() => {
  mockInstanceGet.mockReset();
  keyConfigured();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('amapSearchPlaces — v5 request contract', () => {
  it('AMAP-SVC-001: without a bias it calls place/text with the v5 page parameters', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [] });

    await amapSearchPlaces(dbStub, '餐厅', { limit: 10 });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/v5/place/text');
    expect(url).toContain('keywords=');
    expect(url).toContain('page_size=10');
    expect(url).toContain('page_num=1');
    // v3 spellings must never reappear: v5 answers status 0 for them.
    expect(url).not.toContain('offset=');
    expect(url).not.toContain('&page=');
    expect(url).not.toContain('extensions=');
  });

  it('AMAP-SVC-002: a location bias switches to place/around, the only endpoint taking radius', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [] });

    await amapSearchPlaces(dbStub, '餐厅', { locationBias: { lat: 39.9, lng: 116.4, radius: 3000 } });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/v5/place/around');
    expect(url).toContain('location=');
    expect(url).toContain('radius=3000');
    // place/text rejects these, so they may only ever ride along with around.
    expect(url).not.toContain('/v5/place/text');
  });

  it('AMAP-SVC-003: asks for the business and photo field groups', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [] });

    await amapSearchPlaces(dbStub, '餐厅');

    expect(decodeURIComponent(String(fetchMock.mock.calls[0][0]))).toContain('show_fields=business,photos');
  });

  it('AMAP-SVC-004: clamps page_size to the documented 1-25 window', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [] });

    await amapSearchPlaces(dbStub, '餐厅', { limit: 60 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('page_size=25');

    fetchMock.mockClear();
    await amapSearchPlaces(dbStub, '餐厅', { limit: 0 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('page_size=1');
  });

  it('AMAP-SVC-005: clamps the around radius to the 50 km ceiling', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [] });

    await amapSearchPlaces(dbStub, '餐厅', { locationBias: { lat: 39.9, lng: 116.4, radius: 300_000 } });

    expect(String(fetchMock.mock.calls[0][0])).toContain('radius=50000');
  });

  it('AMAP-SVC-006: falls back to place/text when the bias is unusable', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [] });

    await amapSearchPlaces(dbStub, '餐厅', { locationBias: { lat: Number.NaN, lng: 116.4 } });

    // around requires a real location; sending NaN would be a status-0 request.
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v5/place/text');
  });

  it('AMAP-SVC-007: returns nothing without touching the network when no key is stored', async () => {
    mockInstanceGet.mockReturnValue({ value: '' });
    const fetchMock = stubFetch({ status: '1', pois: [] });

    await expect(amapSearchPlaces(dbStub, '餐厅')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AMAP-SVC-008: a status-0 answer throws instead of reading as an empty result', async () => {
    stubFetch({ status: '0', info: 'INVALID_USER_KEY', infocode: '10001' });

    await expect(amapSearchPlaces(dbStub, '餐厅')).rejects.toThrow(/INVALID_USER_KEY/);
  });
});

describe('amapSearchPlaces — v5 response mapping', () => {
  it('AMAP-SVC-009: reads details from poi.business, not the v3 poi.biz_ext', async () => {
    stubFetch({ status: '1', pois: [v5Poi] });

    const [place] = await amapSearchPlaces(dbStub, '故宫');

    expect(place.name).toBe('故宫博物院');
    expect(place.amap_id).toBe('B000A83M61');
    expect(place.phone).toBe('010-85007421');
    expect(place.rating).toBe(4.7);
    expect(place.open_time).toBe('08:30-17:00');
    expect(place.business_area).toBe('天安门地区');
    // v5 reports no vote count, and the client prints this in parentheses next to
    // the rating — so it must stay null rather than borrow the price.
    expect(place.rating_count).toBeNull();
    expect(place.amap_type).toBe('风景名胜;风景名胜;世界遗产');
  });

  it('AMAP-SVC-010: joins the v5 admin names into the address', async () => {
    stubFetch({ status: '1', pois: [v5Poi] });

    const [place] = await amapSearchPlaces(dbStub, '故宫');

    expect(place.address).toBe('北京市 · 北京市 · 东城区 · 景山前街4号');
  });

  it('AMAP-SVC-011: keeps only absolute photo URLs', async () => {
    stubFetch({
      status: '1',
      pois: [
        {
          ...v5Poi,
          photos: [
            { url: 'https://store.is.autonavi.com/showpic/1' },
            { url: '/relative/2' },
            { title: 'no url here' },
          ],
        },
      ],
    });

    const [place] = await amapSearchPlaces(dbStub, '故宫');

    expect(place.photos).toEqual(['https://store.is.autonavi.com/showpic/1']);
  });

  it('AMAP-SVC-012: converts the GCJ-02 location to WGS-84', async () => {
    stubFetch({ status: '1', pois: [v5Poi] });

    const [place] = await amapSearchPlaces(dbStub, '故宫');

    // The stored frame is WGS-84, so Beijing must land west/south of its GCJ-02
    // reading rather than being passed through unchanged.
    expect(place.lng).not.toBeCloseTo(116.397451, 5);
    expect(place.lat).not.toBeCloseTo(39.916342, 5);
    expect(place.lng).toBeCloseTo(116.3912, 3);
    expect(place.lat).toBeCloseTo(39.9149, 3);
  });

  it('AMAP-SVC-013: a POI without a usable location keeps its fields but no coordinates', async () => {
    stubFetch({ status: '1', pois: [{ ...v5Poi, location: '' }] });

    const [place] = await amapSearchPlaces(dbStub, '故宫');

    expect(place.lat).toBeNull();
    expect(place.lng).toBeNull();
    expect(place.name).toBe('故宫博物院');
  });

  it('AMAP-SVC-014: missing optional groups yield nulls, not throw', async () => {
    stubFetch({ status: '1', pois: [{ id: 'x', name: '某地', location: '116.4,39.9' }] });

    const [place] = await amapSearchPlaces(dbStub, '某地');

    expect(place.rating).toBeNull();
    expect(place.phone).toBeNull();
    expect(place.open_time).toBeNull();
    expect(place.photos).toEqual([]);
  });
});

describe('amapPlaceDetail — v5 detail contract', () => {
  it('AMAP-SVC-015: addresses the POI by id and asks for the detail groups', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [v5Poi] });

    await amapPlaceDetail(dbStub, 'B000A83M61');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/v5/place/detail');
    expect(url).toContain('id=B000A83M61');
    expect(decodeURIComponent(url)).toContain('show_fields=business,photos');
    // page_* and keywords belong to the search endpoints, not this one.
    expect(url).not.toContain('page_size=');
    expect(url).not.toContain('keywords=');
  });

  it('AMAP-SVC-016: maps the POI the same way search does', async () => {
    stubFetch({ status: '1', pois: [v5Poi] });

    const place = await amapPlaceDetail(dbStub, 'B000A83M61');

    expect(place?.name).toBe('故宫博物院');
    expect(place?.amap_id).toBe('B000A83M61');
    expect(place?.rating).toBe(4.7);
    expect(place?.photos).toEqual([
      'https://store.is.autonavi.com/showpic/1',
      'https://store.is.autonavi.com/showpic/2',
    ]);
    expect(place?.address).toBe('北京市 · 北京市 · 东城区 · 景山前街4号');
  });

  it('AMAP-SVC-017: converts the detail coordinates to WGS-84 too', async () => {
    stubFetch({ status: '1', pois: [v5Poi] });

    const place = await amapPlaceDetail(dbStub, 'B000A83M61');

    expect(place?.lng).toBeCloseTo(116.3912, 3);
    expect(place?.lat).toBeCloseTo(39.9149, 3);
  });

  it('AMAP-SVC-018: no stored key means no request at all', async () => {
    mockInstanceGet.mockReturnValue({ value: '' });
    const fetchMock = stubFetch({ status: '1', pois: [v5Poi] });

    await expect(amapPlaceDetail(dbStub, 'B000A83M61')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AMAP-SVC-019: an empty id is refused without a request', async () => {
    const fetchMock = stubFetch({ status: '1', pois: [v5Poi] });

    await expect(amapPlaceDetail(dbStub, '   ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AMAP-SVC-020: a POI-less answer is a null result, not a throw', async () => {
    stubFetch({ status: '1', pois: [] });

    await expect(amapPlaceDetail(dbStub, 'B000A83M61')).resolves.toBeNull();
  });

  it('AMAP-SVC-021: an upstream status-0 still throws so callers can tell it apart', async () => {
    stubFetch({ status: '0', info: 'INVALID_USER_KEY', infocode: '10001' });

    await expect(amapPlaceDetail(dbStub, 'B000A83M61')).rejects.toThrow(/INVALID_USER_KEY/);
  });
});
