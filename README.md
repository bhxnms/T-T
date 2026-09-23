<div align="center">

# ⚠️ AI-WRITTEN PROJECT / AI 编写项目

<big><strong>本项目全程由 AI 编写，可能存在反人类操作。使用前请自行验证，并做好数据备份。</strong></big><br>
<strong>This project was written entirely by AI and may contain unintuitive or hostile-to-human workflows. Verify everything and keep backups.</strong>

</div>

<p align="center"><strong>Special thanks: DeepSeek · GLM · GPT · A/</strong></p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> · <strong>English</strong>
</p>

# TT Travel Planner

A powerful self-hosted travel planning platform with real-time collaboration, interactive maps, and AI-powered features. Plan your journeys with day-by-day itineraries, track expenses, manage bookings, and explore the world with an integrated atlas.

[![License](https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square)](LICENSE)
![Version](https://img.shields.io/badge/version-0.7.0-blue?style=flat-square)

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
- **China Province Landmarks**: 34 provinces with 89 landmarks and check-in functionality
- **Modern Icons**: Beautiful, intuitive icons for 20 landmark types
- **Vacation Calendar**: Track leave days and public holidays
- **Collections**: Organize and tag places for future reference

### 🤖 AI & Extensions

- **AI Booking Parser**: OpenAI/Anthropic-powered extraction from booking confirmations
- **MCP Integration**: Claude desktop app integration via Model Context Protocol
- **Plugin System**: Extensible IFRAME-based architecture for custom features

---

## 🆕 What's New in v0.7.0

### Documentation in Chinese, with a language switcher

The in-app help wiki now ships a full **Simplified Chinese** translation — 102
pages plus their screenshots — and a switcher in the wiki header moves between
the two languages without touching the app's own language setting. The choice is
remembered per browser and can be shared as a link (`?lang=zh`). Missing pages
fall back to English rather than showing an empty document.

A wiki that reads well is also worth navigating: the sidebar keeps its scroll
position across page changes, cross-page section links (`Atlas#check-ins`) now
scroll to the section they name instead of landing at the top of the target page,
and the plugin pages state plainly that the plugin system is inherited from TREK
and not covered by TT's own guarantees.

### Cloudflare Tunnel, configured from the admin panel

Publishing an instance to the internet previously meant reading a guide and
editing cloudflared config by hand. **Admin → Cloudflare Tunnel** now does the
Cloudflare half of it: paste an API token, test it, and the panel creates the
tunnel, writes its ingress rules, points DNS at your hostname and hands you the
connector command to run. It is **off by default** and stores nothing while it is
off, so an operator already running their own tunnel, nginx or Caddy is
unaffected.

The connector is deliberately still a separate process — the app container runs
read-only with dropped capabilities and cannot host a second long-lived binary.
`docker-compose.yml` carries a commented `tunnel:` service to paste the token
into. The wiki gained a from-scratch walkthrough for operators who have never set
up a tunnel before, covering what each step produces and what has to be running.

### Atlas: check-ins, and a correct map of China

- **Check-ins** (`打卡点`) are documented and reachable: preset landmarks on the
  map plus your own trip places, counted together in the Atlas sidebar. Checking
  in a trip place also marks its country and region as visited, so recording "I
  was here" no longer means clicking the country separately.
- **Disputed areas resolve to China.** The Atlas previously drew several
  contested geometries as separate features. Demchok, the Arunachal border,
  Paracel and Senkaku, and the China–India boundary are now resolved to China by
  **geometry subtraction** against the bundled override rather than by name, so
  the result does not depend on how a boundary is spelled in the dataset.
- **Provinces highlight again while panning.** The region layer stopped
  responding once the view moved to other countries, because the request for
  China's provinces was gated on China already being on screen. Taiwan's regions
  also normalize to the CN key, so the province-name lookup matches.

### Routes open in the AMap app, and reach it correctly

- On a phone, exporting a day's route now hands off to the installed **AMap app**
  (`amapuri://` on Android, `iosamap://` on iOS) and falls back to the web link if
  nothing answers within a short grace period. The app form carries **every**
  waypoint; the web form only ever accepted one.
- The AMap web export was rebuilt on the indexed `ditu.amap.com/dir` form, which
  keeps all stops, converts to GCJ-02, and no longer truncates a name containing
  a comma.
- The client-side GCJ-02 conversion was missing the standard sinusoidal terms.
  It round-tripped, so tests passed, but it was off by 170–330 m against AMap's
  own service. It now matches the server implementation to within a metre.

### Smaller fixes

- **Password policy errors are localized.** The server returns a machine-readable
  code (`tooShort`, `tooCommon`, …) alongside its English sentence, so every
  surface — registration, reset, the forced change, both settings screens and the
  admin user editor — shows the message in the user's language.
- **First-deploy credentials moved to the login page.** They used to appear in a
  non-dismissible modal *after* sign-in, which was both unreachable (no close or
  OK button rendered) and pointless — the login form is the only place they are
  needed, and the modal could only ever show a password that had already been
  replaced. Credentials are no longer written to the browser's config cache
  either.
- **The mobile top bar gained a Help entry**, alongside Settings and Admin, so
  the wiki is reachable on a phone.
- **Wiki and demo-mode wording** no longer leaks the upstream project's branding
  into user-facing text or documentation.

---

## 0.6.2 (detail)

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
`IMAGE_TAG=0.7.0`. `latest` tracks the newest stable release; the image
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
docker build --build-arg APP_VERSION=0.7.0 -t tt-planner:local .
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

### Windows (portable, no Docker)

For a single Windows PC there is a portable package: unzip it and double-click
the launcher. No Docker, and no Node to install — the runtime is bundled. Port
conflicts are handled before startup (the launcher moves to the next free port
and tells you which), since 3000/3001 are frequently held by other software on
Windows.

> Booking import from e-mail/PDF is unavailable in this package: it needs a
> KDE helper that ships as a Linux binary. Everything else works.

Download the `-win-x64.zip` from
[Releases](https://github.com/bhxnms/T-T/releases), or see
[Install: Windows (portable)](https://github.com/bhxnms/T-T/wiki/Install-Windows)
for the full walkthrough, firewall prompts and update steps.

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
- 89 famous landmarks across China
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
