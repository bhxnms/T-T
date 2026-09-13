# TT Travel Planner

A powerful self-hosted travel planning platform with real-time collaboration, interactive maps, and AI-powered features. Plan your journeys with day-by-day itineraries, track expenses, manage bookings, and explore the world with an integrated atlas.

[![License](https://img.shields.io/badge/license-AGPL_v3-6B7280?style=flat-square)](LICENSE)
![Version](https://img.shields.io/badge/version-0.3.0-blue?style=flat-square)

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

## 🆕 What's New in v0.3.0

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

## 🚀 Quick Start

### Docker (Recommended)

```bash
docker run -d \
  --name tt-planner \
  -p 3000:3000 \
  -v tt-data:/app/data \
  -e AMAP_API_KEY=your_amap_api_key \
  ghcr.io/your-repo/tt-planner:0.3.0
```

### Docker Compose

```yaml
version: '3.8'
services:
  tt-planner:
    image: ghcr.io/your-repo/tt-planner:0.3.0
    container_name: tt-planner
    ports:
      - "3000:3000"
    volumes:
      - tt-data:/app/data
    environment:
      - AMAP_API_KEY=your_amap_api_key
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  tt-data:
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AMAP_API_KEY` | 高德地图 API key for China map features | Recommended |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Optional |
| `MAPBOX_TOKEN` | Mapbox access token for maps | Optional |
| `NODE_ENV` | Environment (production/development) | No |
| `PORT` | Server port (default: 3000) | No |

---

## 🛠️ Development

### Prerequisites
- Node.js 18+ and npm 9+
- PostgreSQL 14+ or SQLite

### Local Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/tt-planner.git
cd tt-planner

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

---

## 📂 Project Structure

```
tt-planner/
├── client/          # React frontend application
├── server/          # Node.js backend server
├── shared/          # Shared types and utilities
├── migrations/      # Database migration files
└── docs/           # Documentation
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
