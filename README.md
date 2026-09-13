# TT Travel Planner

A powerful self-hosted travel planning platform with real-time collaboration, interactive maps, and AI-powered features. Plan your journeys with day-by-day itineraries, track expenses, manage bookings, and explore the world with an integrated atlas.

[![License](https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square)](LICENSE)
![Version](https://img.shields.io/badge/version-0.4.0-blue?style=flat-square)

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

## 🆕 What's New in v0.4.0

### Atlas & Check-ins
- Landmark markers redesigned as clean colored dots (visited landmarks glow)
- Markers hide while zooming and fade back in as one layer when zooming settles
- New "Check-ins" tab in the Atlas sidebar: total count plus landmark and trip-place lists
- Check-in any place from the trip planner (desktop & mobile) — it automatically appears as a dot on the Atlas map
- Mobile Atlas gains the Check-ins sheet and landmark popups

### Fixes & Improvements
- Place search no longer fails in restricted networks: Photon (OpenStreetMap data) now backs up Nominatim automatically
- Removed the upstream TREK update check — TT never shows "update available" banners or notifications
- Trip loading splash now features the TT mascot on desktop and mobile
- i18n key parity restored across all 20 languages; test suite fully green (13,400+ cases)

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
`IMAGE_TAG=0.4.0`. `latest` tracks the newest stable release; the image
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
docker build --build-arg APP_VERSION=0.4.0 -t tt-planner:local .
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

| Variable | Purpose |
|----------|---------|
| `HOST_PORT` | Host port mapped to the container's port 3000 (Compose only) |
| `ENCRYPTION_KEY` | Recommended 256-bit hex key for encrypted stored secrets |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First admin, used together only on an empty database |
| `TZ` | Timezone for logs, reminders and schedules; default `UTC` |
| `LOG_LEVEL` | `info` or `debug`; default `info` |
| `ALLOWED_ORIGINS` | Comma-separated browser origins for CORS |
| `APP_URL` and `OIDC_*` | Optional OpenID Connect configuration |

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
