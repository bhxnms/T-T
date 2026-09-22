# Contributing

Thanks for your interest in contributing to Tourism-Team! Here are the guidelines for submitting pull requests.

## Before You Start

- **Check the repository discussions first** — Before writing code, look for an existing issue or discussion that covers the idea. Explain the intended change and its scope there so maintainers can confirm the direction before implementation. PRs that bypass the project’s issue/discussion process may be closed
- **Check existing issues** — Look for open issues or discussions before starting work
- **Target the `dev` branch** — All PRs must be opened against `dev`, not `main`. Exception: PRs that only modify files under `wiki/` may target any branch
- **One thing per PR** — Keep PRs focused on a single change. Don't bundle unrelated fixes

## Pull Request Guidelines

### Code Quality

- Write clean, readable code that matches the existing style
- No unnecessary abstractions or over-engineering
- Don't add features beyond what was discussed in the issue
- Don't add comments unless the logic isn't self-evident
- Don't add error handling for scenarios that can't happen

### What We Look For

- **Does it solve the stated problem?** — The PR should match the issue it addresses
- **Is it minimal?** — No extra refactoring, no "while I'm here" changes
- **Does it break anything?** — Breaking changes are not acceptable
- **Is the code clean?** — Consistent style, no debug logs, no dead code

### Commit Messages

Use conventional commits:
```
fix(component): short description of what was fixed
feat(component): short description of new feature
```

### PR Description

Follow the template provided by default (.github/PULL_REQUEST_TEMPLATE.md).

### What Will Get Your PR Closed

- PRs that did not first go through the project’s issue/discussion process
- PRs that add unnecessary complexity (e.g. a redo button when undo already exists)
- PRs with breaking changes
- PRs that change code style or formatting across unrelated files
- PRs that add dependencies without justification

## Development Setup

See the [[Development Environment|Development-environment]] page for the full setup guide, including forking, remote configuration, branch conventions, and available scripts.

## Tech Stack

| Layer | Technology                                                                                |
|---|-------------------------------------------------------------------------------------------|
| Frontend | React 19, TypeScript, Zustand 5, Leaflet, Tailwind CSS 3.4, Vite 8 (Rolldown)             |
| Backend | NestJS 11 (Express 4 adapter), TypeScript, better-sqlite3, Zod (@trek/shared)             |
| Real-time | WebSocket (ws)                                                                            |
| Database | SQLite with WAL mode                                                                      |
| Auth | JWT (HS256), bcrypt, TOTP MFA, OIDC                                                       |
| Maps | Leaflet + react-leaflet (default, OpenFreeMap vector basemap via maplibre-gl-leaflet), MapLibre GL, Mapbox GL, OSRM, Nominatim |
| i18n | 23 languages, EN canonical (locale directories live in shared/src/i18n/)                  |

Every translation key must exist in all 23 locales — the `i18n Key Parity` CI job fails on drift, so run `npm run i18n:parity:strict --workspace=shared` before pushing. Two directory names differ from the language they hold: Brazilian Portuguese is `br`, Greek is `gr`.
