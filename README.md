<div align="center">

# ⚠️ AI-WRITTEN PROJECT / AI 编写项目

<big><strong>本项目全程由 AI 编写，可能存在反人类操作。使用前请自行验证，并做好数据备份。</strong></big><br>
<strong>This project was written entirely by AI and may contain unintuitive or hostile-to-human workflows. Verify everything and keep backups.</strong>

</div>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> · <strong>English</strong>
</p>

# TT Travel Planner

A powerful self-hosted travel planning platform with real-time collaboration, interactive maps, and AI-powered features. Plan your journeys with day-by-day itineraries, track expenses, manage bookings, and explore the world with an integrated atlas.

[![License](https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square)](LICENSE)
![Version](https://img.shields.io/badge/version-0.6.2-blue?style=flat-square)

---

## ✨ Key Features

### 🗺️ Planning & Maps

- **Interactive Maps**: Multiple map providers (Mapbox, MapLibre, Amap) with clustering and route visualization
- **Activity Management**: Drag-and-drop scheduling with time-based planning and dual-view support
- **Amap Integration**: Complete 高德地图 support for China travel with place search and navigation
- **Place Search**: Integrated search with Google Places, OpenStreetMap, and Amap
- **Smart Routes**: Auto-sort days, multiple transport modes, direct navigation app integration
- **Weather Forecasts**: 16-day forecasts and historical weather data
- **Import/Export**: Support for Google Maps lists, GPX, KML, KMZ, and ICS formats

### 🗓️ Activity & Day Planning

- **Unified Timeline**: Manage places and reservations in a single, cohesive schedule
- **Drag-and-Drop**: Reorder activities within days or move between days effortlessly
- **Time Scheduling**: Set start times and durations for precise planning
- **Dual View Modes**: Switch between classic day plans and modern activities view
- **Real-time Updates**: Changes sync instantly across all devices

### 🧳 Bookings & Expenses

- **Comprehensive Booking Types**: 16+ booking categories including flights, trains, hotels, and activities
- **Smart Import**: Extract booking details from emails, PDFs, and PKPass files
- **Multi-Traveler Support**: Track confirmation codes, travelers, and booking status
- **Expense Splitting**: Split costs with custom shares, multiple payers, and settlement suggestions
- **Multi-Currency**: Per-expense currencies with frozen exchange rates
- **Packing Lists**: Create templates, assign items, track packing progress
- **To-Do Management**: Assignees, due dates, priorities, and reminders

### 👥 Real-Time Collaboration

- **Live Sync**: WebSocket-based instant updates for all trip members
- **Flexible Permissions**: Granular control over 16 different trip actions
- **Multiple Invite Methods**: Add members by email/username or shareable links
- **Guest Access**: Optional expiry dates for invite links
- **Public Sharing**: Generate read-only public pages for your trips
- **Collaboration Tools**: Group chat, shared notes, polls, and activity coordination

### 📔 Travel Journal & Tracking

- **Journey Studio**: Create rich travel journals with photos, videos, mood tracking, and weather
- **Interactive Atlas**: Track visited countries and regions on a visual world map
- **China Province Landmarks**: 34 provinces with 200+ landmarks and check-in functionality
- **Modern Icons**: Beautiful, intuitive icons for 20+ landmark types
- **Vacation Calendar**: Track leave days and public holidays
- **Collections**: Organize and tag places for future reference

### 🤖 AI & Extensions

- **AI Booking Parser**: OpenAI/Anthropic-powered extraction from booking confirmations
- **MCP Integration**: Claude desktop app integration via Model Context Protocol
- **Plugin System**: Extensible IFRAME-based architecture for custom features

---

## 🆕 What's New in v0.6.2

### AMap share links now actually resolve

Two parsing bugs, both reproduced with real share messages:

- A share link is pasted glued to the preceding Chinese text
  (`…14层1401https://surl.amap.com/…`) with no separator. The parser split on
  whitespace and then stripped everything from the first Chinese character —
  which deleted the URL with it, so the message resolved to nothing. The link is
  now found by scanning the text directly, stopping at the first character that
  cannot be part of a URL.
- A position passcode message ends with a mangled `\:高德地图:// a@amap.com`,
  which `new URL()` accepts as host `amap.com` with username `a`. That was taken
  as a valid link, the server fetched amap.com's homepage on the strength of it,
  and returned whichever place the page happened to mention — a wrong address
  presented with full confidence. URLs carrying credentials are now refused, the
  server no longer scrapes any page body for a POI id, and a passcode is
  recognised and declined with an explanation instead of being searched for.

### AMap share links also work without a Web-Service key

The page an AMap share link redirects to carries its coordinates directly in the
link (`?p=<id>,<lat>,<lng>,<name>,<address>`), so a place can be added from a
share link on an instance with no AMap key configured at all. The coordinates are
GCJ-02 and are converted to the WGS-84 frame the app stores.

### Discoverability and navigation

- The place search box now says that an AMap share link can be pasted into it.
  The import had no control of its own — it rides the search button — and with no
  hint anywhere it was effectively invisible.
- The place detail card's navigation menu gained an **AMap** entry, alongside
  Google Maps, Waze and Apple Maps.

### Fixed

- The 21 non-English locales were missing the `system_notice.bootstrap_password`
  strings added in 0.6.0, which the i18n parity check caught.

---

## 0.6.1 (detail)

### Test-suite fixes

- `MapViewAMap.test.tsx` left four cases failing: the store mock answered every
  call with a freshly built object and ignored the selector, so the AMap key the
  component reads was a new value on each render. That restarted the
  map-lifecycle effect endlessly, `ready` never settled and no marker was ever
  drawn. The mock now honours the selector, and all six cases pass in ~60 ms each
  instead of timing out at 3 s.
- The mobile Atlas case that asserted “no switch is present” now asserts on the
  planned-countries switch it is actually about. The preset-landmark switch is
  deliberately always rendered, so the blanket query was the wrong check.
- The places e2e harness builds its schema by hand; it was missing the new
  `amap_id` column, which made every place write in that suite answer 500.
- Two assertions were updated for the provider argument the POI endpoints now
  take (`mapsApi.pois` / `MapsService.pois`).

### Existing 0.6.0 features

- A place added from AMap (高德) search gets that POI's photo as its thumbnail,
  fetched and cached server-side behind the existing photo proxy.
- The place search box accepts AMap share links and the app's 分享 text.
- `amap_js_api_key` is now included in the encryption-key rotation.

---

## 0.6.0 (detail)

### AMap places now come with their photo

- A place added from AMap (高德) search remembers its POI id, and the server
  fetches that POI's own picture and attaches it as the place thumbnail. A POI
  with no picture keeps an empty thumbnail rather than getting a placeholder.
- The image is downloaded and cached server-side behind the existing photo proxy,
  the same way Google and Wikimedia photos already are — it is never hot-linked,
  so a CDN referer check or an expiring URL cannot turn the thumbnail blank later.
- The fetch is detached from the save: the place appears immediately and the
  thumbnail arrives over the websocket. It never overwrites a picture the place
  already has.

### Import a place from an AMap share link

- The place search box now accepts an AMap link: `www.amap.com/place/…`,
  `ditu.amap.com/place/…`, the `surl.amap.com` / `uri.amap.com` short links, or a
  bare POI id.
- The AMap app's 分享 text can be pasted whole — the link is lifted out of the
  surrounding sentence, which is what actually ends up on the clipboard.
- Resolving goes through the AMap POI id (`/v5/place/detail`), so the name,
  address and coordinates are the POI's own rather than reverse-geocoded guesses.
  Every redirected hop is re-checked by the SSRF guard.

### Fixed

- `amap_js_api_key` was encrypted at rest but missing from the key-rotation
  script, so rotating the encryption key would have silently left every user's
  AMap browser key unreadable. It is now rotated with the other encrypted
  settings.

### Existing 0.5.4 improvements

- AMap place search uses the documented v5 request contract (`page_size` /
  `page_num` / `show_fields`, and `place/around` whenever a coordinate exists).
- AMap search results show photos, ratings, opening hours, phone and category.
- AMap has an independent encrypted per-user Web JS API Key setting.

### Existing 0.5.3 improvements

- Mobile Atlas includes the same one-tap preset-landmark visibility switch as desktop.
- “Explore places on the map” uses AMap for nearby restaurants, hotels and categories when AMap search is enabled.
- The first-run administrator receives a one-time credential notice and must change the generated password before continuing.

---

## v0.5.4 (detail)

### AMap place search fixed

- Place search against AMap was calling the v5 POI endpoints with the older v3
  parameter names (`offset`, `page`, `extensions`) and reading the v3 response
  path (`biz_ext`). AMap answers those requests with `status: 0`, and the search
  then fell back to OpenStreetMap — which is unreachable from many Chinese
  networks, so the user saw only “place search failed”.
- Requests now use the documented v5 contract: `page_size` / `page_num` for
  paging, `show_fields=business,photos` for the detail groups, and
  `place/around` (not `place/text`) whenever a coordinate is available, since
  only `around` accepts `location` and `radius`. Detail fields are read from
  `poi.business`.
- The rating shown for an AMap result is the rating alone. AMap reports no vote
  count, and the price per person is deliberately not substituted for one.
- Added 14 regression tests pinning the v5 parameter names, endpoint choice,
  field paths and GCJ-02 → WGS-84 conversion.

### Build reliability

- Docker builds carry a one-hour ceiling and npm fetch retries on every stage.
  They previously hung for nearly six hours inside the emulated arm64 build
  before being cancelled, and the retry settings had been applied to only some
  of the builder stages.

### Existing 0.5.3 improvements

- Mobile Atlas includes the same one-tap preset-landmark visibility switch as desktop.
- “Explore places on the map” uses AMap for nearby restaurants, hotels and categories when AMap search is enabled.
- The first-run administrator receives a one-time credential notice and must change the generated password before continuing.
- Bug reports and feature requests open TT GitHub pages instead of the former mailbox.

### Existing 0.5.2 improvements

- AMap search results include photos, ratings, opening hours, phone numbers and category details.
- AMap has an independent encrypted per-user Web JS API Key setting.
- The weather API wording now identifies TT as continuing to use the TREK weather API.

---

## 🚀 Deploy from a fresh checkout

The repository is self-contained: clone it, copy the environment template, and
run either the published multi-architecture image or build the production image
locally. Both paths use the same persistent data and upload directories.

### Prebuilt GHCR image (recommended)

Stable multi-architecture images are published at
`ghcr.io/bhxnms/tt-planner`. On a new machine, after creating `.env` and the
persistent directories:

```bash
docker compose pull
docker compose up -d
```

Use a fixed release in `.env` for production, for example
`IMAGE_TAG=0.6.2`. `latest` tracks the newest stable release; the image
supports `linux/amd64` and `linux/arm64`. If the package is private, authenticate
first with a GitHub token that can read packages:

```bash
echo "$CR_PAT" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

### Build from the checkout

To verify or run unreleased source instead of pulling an image:

```bash
docker compose up -d --build
```

This uses the same `Dockerfile` and tags the local result as configured by
`IMAGE_NAME`/`IMAGE_TAG` in `.env`.

Open [http://localhost:3000](http://localhost:3000). To use another host port,
set `HOST_PORT=8080` in `.env`; the container-side port remains `3000`.

The first administrator variables apply only when the database has no users and
must be set together. If both are left empty, the server creates
`admin@tt.local` with a random password and prints it in the container log:

```bash
docker compose logs app | grep -A4 "First Run"
```

Persist both `./data` (database, encryption key, logs) and `./uploads` (photos
and files). **Do not mount a volume at `/app`**: that hides the application
files inside the image.

To stop or update the deployment:

```bash
docker compose down
# Published image:
docker compose pull && docker compose up -d
# Source build:
git pull && docker compose up -d --build
```

### Docker without Compose

```bash
git clone https://github.com/bhxnms/T-T.git
cd T-T
mkdir -p data uploads
docker build --build-arg APP_VERSION=0.6.2 -t tt-planner:local .
docker run -d --name tt-planner --restart unless-stopped \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/uploads:/app/uploads" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='replace-with-a-strong-password' \
  tt-planner:local
```

Keep the generated `ENCRYPTION_KEY` backed up and reuse the same value when
recreating the container. Do not put real secrets in Git.

### Environment variables

| Variable                         | Purpose                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| `HOST_PORT`                      | Host port mapped to the container's port 3000 (Compose only) |
| `ENCRYPTION_KEY`                 | Recommended 256-bit hex key for encrypted stored secrets     |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First admin, used together only on an empty database         |
| `TZ`                             | Timezone for logs, reminders and schedules; default `UTC`    |
| `LOG_LEVEL`                      | `info` or `debug`; default `info`                            |
| `ALLOWED_ORIGINS`                | Comma-separated browser origins for CORS                     |
| `APP_URL` and `OIDC_*`           | Optional OpenID Connect configuration                        |

If `OIDC_ONLY=true`, password login is disabled and the first SSO user becomes
administrator; local `ADMIN_EMAIL`/`ADMIN_PASSWORD` are not used.

---

## 🛠️ Development from source

### Prerequisites

- Node.js 24+ and npm 11+
- SQLite is the default local database; Docker is recommended for production

### Local development

```bash
git clone https://github.com/bhxnms/T-T.git
cd T-T
npm install
npm run build --workspace=shared
cp server/.env.example server/.env
npm run dev --workspace=server
# In another terminal:
npm run dev --workspace=client
```

### Build and test

```bash
npm run build
npm test
npm run e2e --workspace=client
```

For another machine, use the Docker Compose procedure above; it includes the
production build and does not require a local Node.js installation.

---

## 📂 Project Structure

```
tt-planner/
├── client/          # React frontend application
├── server/          # Node.js backend server
├── shared/          # Shared types and utilities
├── wiki/            # In-app help documentation
├── Dockerfile       # Multi-stage production image
└── docker-compose.yml # Source-based production deployment
```

---

## 🗺️ Map Providers

TT supports multiple map providers:

- **Mapbox GL**: Full-featured with global coverage
- **MapLibre GL**: Open-source alternative to Mapbox
- **Amap (高德地图)**: Optimized for China with Chinese language support
- **OpenStreetMap**: Community-driven mapping

---

## 🌏 China Travel Features

### Amap Integration

- Native Chinese language support
- Accurate POI data for mainland China
- Public transport and driving directions
- Place search with Chinese characters

### Atlas - China Provinces

- 34 provinces, municipalities, and special administrative regions
- 200+ famous landmarks across China
- Check-in functionality for visited landmarks
- Beautiful modern icons for different landmark types
- Interactive province tooltips with Chinese names

---

## 🔒 Security & Privacy

- Self-hosted: Your data stays on your server
- AGPL v3 licensed: Open source and transparent
- Granular permissions: Control who can see and edit what
- Optional public sharing: Share trips only when you want to

---

## 📝 License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

See [LICENSE](LICENSE) for the full license text.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

## 📧 Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

**Made with ❤️ for travelers around the world**
