# AMap (高德地图)

[AMap](https://www.amap.com/) (高德地图) is a Chinese mapping provider. Tourism-Team can use it
for place search, POI discovery, photos, routing and navigation — and, in mainland China, it is
usually a better source than Google Maps or OpenStreetMap for Chinese addresses, names and
opening hours.

It is entirely optional. Without an AMap key the app falls back to Google Places (if a Google key
is configured) or OpenStreetMap, and everything still works.

## Why coordinates look different

AMap answers in **GCJ-02**, a Chinese coordinate obfuscation standard that all Chinese providers
are required to use. Google, OpenStreetMap and Tourism-Team's own database all use **WGS-84**.

Tourism-Team converts at the boundary:

- Every coordinate that **enters** from AMap is converted GCJ-02 → WGS-84 before it is stored or drawn.
- Every coordinate that **leaves** for AMap (routing requests, navigation links) is converted WGS-84 → GCJ-02.

The result is that places found through AMap sit on the correct spot on OpenStreetMap tiles, and
routes requested from AMap follow the roads actually drawn on those tiles. You never do this
conversion yourself.

> **On a Chinese map provider:** the offset between the two systems is roughly 50–500 m, which is
> enough to put a marker on the wrong side of a street. If you ever see markers consistently
> offset when using a Chinese basemap, the coordinate frame is the thing to check.

## Keys

There are two separate AMap keys, used for different things. Both are entered by an administrator.

| Key | Where it goes in AMap's console | What it is used for |
|---|---|---|
| **Web Service key** (`amap_api_key`) | 应用管理 → 我的应用 → Web服务 | Server-side search, POI lookup, place details, photos, and driving/walking/cycling routes. Never sent to the browser. |
| **JS API key** (`amap_js_api_key`) | Same app, **Web端(JS API)** type | The browser-side map renderer, when 高德 is the chosen basemap provider. |

**Admin → Settings** holds the Web Service key. The JS API key sits alongside the other map
settings — see [Map Settings](Map-Settings).

Several AMap services require the key to be enabled for the right API type. If search or routing
answers `INVALID_USER_KEY` or `SERVICE_NOT_AVAILABLE`, the key usually exists but lacks that API
type or the account has not completed real-name verification.

## Enabling AMap search

**Admin → Addons → Maps** carries the switch **Use AMap for place search**
(`amap_search_enabled`). When it is on, the place-search box queries AMap first and falls back to
the native providers if AMap returns nothing or errors.

An individual search can override the instance default: the place-search form has a provider
toggle (高德 / Native), so one user can search the other provider without changing the instance
setting.

This switch requires the Web Service key. With the switch on but no key stored, search silently
degrades to the native providers rather than failing.

## What works with AMap

### Place search and POI details

Place search returns name, address, coordinates, rating, opening hours, phone number, category and
photos. Results are ranked by AMap itself.

### POI explore

The map's explore pill can list nearby POIs of a category (restaurants, cafés, hotels, sights,
museums, parks, and so on) either from AMap or from OpenStreetMap's Overpass. AMap is used when
the map provider is 高德 and a key is configured; otherwise Overpass is used, which costs nothing
and needs no key.

### Photos

A place added from AMap search gets that POI's own picture as its thumbnail. The server downloads
the image and stores it in the photo proxy cache rather than hot-linking AMap's CDN — those image
URLs expire and are referer-checked, which used to leave thumbnails blank after a while. The
picture is fetched in the background, so the place appears immediately and the thumbnail arrives a
moment later over the websocket. A place that already has a picture is never overwritten.

### Routing

**Driving, walking and cycling** routes can come from AMap instead of the built-in OSRM router.
AMap's driving duration is traffic-aware, which makes it noticeably more realistic in Chinese
cities than a plain distance-based estimate.

The route is fetched server-side — the browser never sees the API key or needs a network exception
for AMap's routing host. Route geometry is converted GCJ-02 → WGS-84 vertex by vertex so the drawn
line matches the roads on the map. If AMap is unavailable the app falls back to OSRM exactly as it
would for any routing outage.

### Navigation

A place with an AMap POI id gets an **AMap** entry in its navigation menu, next to Google Maps,
Apple Maps, Waze and others. The link prefers the POI id, which opens the exact business rather
than a coordinate pin; without one it falls back to coordinates plus the place name.

## Importing from an AMap link or share text

The place-search box accepts several AMap inputs:

- A desktop place link: `www.amap.com/place/…` or `ditu.amap.com/place/…`
- A share short link: `surl.amap.com/…` or `uri.amap.com/…`
- A bare POI id (for example `B000A83M61`)
- The AMap app's whole **分享** text, pasted as-is

That last one is the common case, and it is why the field tolerates a paragraph: the app's copy
button puts the place name, address and link into one block, and the link is often glued directly
onto the preceding Chinese text with no space. Tourism-Team lifts the URL out of the sentence
rather than asking you to trim it.

The link is resolved through AMap's own POI lookup, so name, address and coordinates come back
filled in, and the POI id is remembered on the place.

> **位置口令 (position passcodes) cannot be resolved.** A passcode is a short number with no public
> resolver — AMap only opens it inside its own app. Tourism-Team recognises one and says so
> explicitly rather than searching for the digits and returning a confidently wrong place.

## Limitations to expect

- **Photos and details are only as good as AMap's listing.** A POI with no photo keeps an empty
  thumbnail; no placeholder is invented.
- **`rating_count` is empty.** AMap's v5 API does not report a vote count, and `business.cost` is a
  price per person, so it is deliberately not shown as a review count.
- **AMap is China-focused.** Outside mainland China its coverage is thin — use Google Places or
  OpenStreetMap there.
- **The key is instance-wide.** Unlike Google Places, there is no per-user AMap key.

## Related

- [Map Settings](Map-Settings) — basemap provider, the JS API key, tile sources
- [Places and Search](Places-and-Search) — the search box and provider toggle
- [Map Features](Map-Features) — markers, clustering, POI explore
- [Route Optimization](Route-Optimization) — route profiles and fallback behaviour
