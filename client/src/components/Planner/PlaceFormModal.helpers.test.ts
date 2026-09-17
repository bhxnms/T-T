import { describe, expect, it } from 'vitest';
import { extractAmapPoiId, extractAmapUrl, isAmapShareInput, isGoogleMapsUrl } from './PlaceFormModal.helpers';

describe('isGoogleMapsUrl', () => {
  it('accepts the short share hosts', () => {
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(isGoogleMapsUrl('https://goo.gl/maps/xyz')).toBe(true);
  });

  it('rejects goo.gl links that are not /maps', () => {
    expect(isGoogleMapsUrl('https://goo.gl/something')).toBe(false);
  });

  it('accepts maps.google.<tld> and maps.google.<sld>.<tld>', () => {
    expect(isGoogleMapsUrl('https://maps.google.com/?q=eiffel')).toBe(true);
    expect(isGoogleMapsUrl('https://maps.google.co.uk/?q=eiffel')).toBe(true);
  });

  it('accepts google.<tld>/maps with optional www', () => {
    expect(isGoogleMapsUrl('https://google.com/maps/place/Eiffel')).toBe(true);
    expect(isGoogleMapsUrl('https://www.google.co.uk/maps')).toBe(true);
  });

  it('rejects google.<tld> without a /maps path', () => {
    expect(isGoogleMapsUrl('https://google.com/search?q=eiffel')).toBe(false);
  });

  it('rejects spoofed hosts like maps.google.evil.com', () => {
    expect(isGoogleMapsUrl('https://maps.google.evil.com/maps')).toBe(false);
  });

  it('returns false for non-URL input', () => {
    expect(isGoogleMapsUrl('not a url')).toBe(false);
    expect(isGoogleMapsUrl('')).toBe(false);
    expect(isGoogleMapsUrl('Eiffel Tower')).toBe(false);
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(isGoogleMapsUrl('  https://maps.app.goo.gl/abc123  ')).toBe(true);
  });
});

// FE-COMP-PLACEFORMHELPERS-AMAP-001 onwards. These pin the AMap import grammar:
// a bare link, the app's share text, and a bare POI id all have to be recognised,
// while ordinary search words must fall through to keyword search.
describe('extractAmapUrl', () => {
  it('accepts the desktop place page and the app short hosts', () => {
    expect(extractAmapUrl('https://www.amap.com/place/B000A83M61')).toBe('https://www.amap.com/place/B000A83M61');
    expect(extractAmapUrl('https://ditu.amap.com/place/B000A83M61')).toBe('https://ditu.amap.com/place/B000A83M61');
    expect(extractAmapUrl('https://surl.amap.com/abcdEF')).toBe('https://surl.amap.com/abcdEF');
  });

  it('lifts the link out of the app share paragraph', () => {
    const shared = '我在高德地图发现了一个好地方，快来看看！ https://surl.amap.com/abcdEF 分享给你';
    expect(extractAmapUrl(shared)).toBe('https://surl.amap.com/abcdEF');
  });

  it('adds a scheme to a bare host', () => {
    expect(extractAmapUrl('www.amap.com/place/B000A83M61')).toBe('https://www.amap.com/place/B000A83M61');
  });

  it('rejects non-AMap hosts and lookalikes', () => {
    expect(extractAmapUrl('https://maps.google.com/place/x')).toBeNull();
    expect(extractAmapUrl('https://amap.com.evil.test/place/B000A83M61')).toBeNull();
    expect(extractAmapUrl('https://notamap.com/place/B000A83M61')).toBeNull();
  });

  it('returns null when there is no link at all', () => {
    expect(extractAmapUrl('')).toBeNull();
    expect(extractAmapUrl('Eiffel Tower')).toBeNull();
  });
});

describe('extractAmapPoiId', () => {
  it('accepts a bare POI id', () => {
    expect(extractAmapPoiId('B000A83M61')).toBe('B000A83M61');
  });

  it('rejects ids with whitespace, which are search phrases instead', () => {
    expect(extractAmapPoiId('B000A83M61 extra')).toBeNull();
    expect(extractAmapPoiId('')).toBeNull();
  });

  it('rejects lowercase words so ordinary queries are not mistaken for ids', () => {
    expect(extractAmapPoiId('restaurant')).toBeNull();
  });
});

describe('isAmapShareInput', () => {
  it('is true for a link, share text or bare id', () => {
    expect(isAmapShareInput('https://surl.amap.com/abcdEF')).toBe(true);
    expect(isAmapShareInput('看看这个 https://www.amap.com/place/B000A83M61 不错')).toBe(true);
    expect(isAmapShareInput('B000A83M61')).toBe(true);
  });

  it('is false for an ordinary search phrase', () => {
    expect(isAmapShareInput('Kyoto Station')).toBe(false);
    expect(isAmapShareInput('https://maps.google.com/place/x')).toBe(false);
  });
});
