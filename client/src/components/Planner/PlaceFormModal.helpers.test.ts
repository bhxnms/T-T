import { describe, expect, it } from 'vitest';
import {
  extractAmapPasscode,
  extractAmapPoiId,
  extractAmapUrl,
  isAmapShareInput,
  isGoogleMapsUrl,
  parseAmapPoiPayload,
} from './PlaceFormModal.helpers';

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

// FE-COMP-PLACEFORMHELPERS-AMAP-013 onwards. Both inputs below are real share
// messages, reproduced verbatim: each one broke a different part of an earlier
// implementation, so they are the regression cases that matter most.
describe('real AMap share messages', () => {
  // The link is glued to the preceding Chinese with no separator at all.
  const SHARE_TEXT =
    '龙猫精灵酒店(贵阳市政府林城西路地铁站店)\n经济型诚信北路81号大西南富力中心A4栋14层1401https://surl.amap.com/gXe3qqOFa56';
  // Ends with a mangled "a@amap.com" that parses as host amap.com + user "a".
  const PASSCODE_TEXT =
    '我的高德位置口令为006224，复制此消息，打开高德搜索位置口令006224即可快速找到准确位置 \\:高德地图:// a@amap.com';

  it('finds a link glued to the preceding Chinese text', () => {
    expect(extractAmapUrl(SHARE_TEXT)).toBe('https://surl.amap.com/gXe3qqOFa56');
    expect(isAmapShareInput(SHARE_TEXT)).toBe(true);
  });

  it('does not read the mangled a@amap.com tail of a passcode message as a link', () => {
    expect(extractAmapUrl(PASSCODE_TEXT)).toBeNull();
  });

  it('recognises the passcode so the caller can explain it', () => {
    expect(extractAmapPasscode(PASSCODE_TEXT)).toBe('006224');
    expect(isAmapShareInput(PASSCODE_TEXT)).toBe(true);
  });
});

describe('extractAmapUrl edge cases', () => {
  it('accepts a link at the very start of the text', () => {
    expect(extractAmapUrl('https://surl.amap.com/abc123 快来看看')).toBe('https://surl.amap.com/abc123');
  });

  it('stops at Chinese punctuation rather than swallowing it', () => {
    expect(extractAmapUrl('看看这个 https://www.amap.com/place/B000A83M61，很不错')).toBe(
      'https://www.amap.com/place/B000A83M61'
    );
  });

  it('refuses a URL carrying credentials', () => {
    // Exactly what a mangled share string produces; following it made the server
    // scrape amap.com's homepage and return an unrelated place.
    expect(extractAmapUrl('https://a@amap.com')).toBeNull();
    expect(extractAmapUrl('https://user:pass@www.amap.com/place/B000A83M61')).toBeNull();
  });

  it('still rejects lookalike hosts', () => {
    expect(extractAmapUrl('https://amap.com.evil.test/place/B000A83M61')).toBeNull();
    expect(extractAmapUrl('https://notamap.com/place/B000A83M61')).toBeNull();
  });
});

describe('parseAmapPoiPayload', () => {
  // A live short link resolved to exactly this URL shape: id, LAT, LNG, name, address.
  const redirected =
    'https://www.amap.com/?p=B0MRJ44YYT,26.65037499661199,106.62117451429364,%E9%BE%99%E7%8C%AB%E7%B2%BE%E7%81%B5%E9%85%92%E5%BA%97,%E8%AF%9A%E4%BF%A1%E5%8C%97%E8%B7%AF81%E5%8F%B7';

  it('reads id, latitude, longitude, name and address', () => {
    const payload = parseAmapPoiPayload(redirected);
    expect(payload).not.toBeNull();
    expect(payload!.amapId).toBe('B0MRJ44YYT');
    expect(payload!.lat).toBeCloseTo(26.65, 2);
    expect(payload!.lng).toBeCloseTo(106.62, 2);
    expect(payload!.name).toBe('龙猫精灵酒店');
    expect(payload!.address).toBe('诚信北路81号');
  });

  it('declines a payload whose coordinates are not latitude-then-longitude', () => {
    // Longitude in the latitude slot: the layout is not what this parser assumes.
    expect(parseAmapPoiPayload('https://www.amap.com/?p=B0MRJ44YYT,106.62,26.65,Name')).toBeNull();
  });

  it('returns null without a p parameter', () => {
    expect(parseAmapPoiPayload('https://www.amap.com/place/B000A83M61')).toBeNull();
    expect(parseAmapPoiPayload('not a url')).toBeNull();
  });
});
