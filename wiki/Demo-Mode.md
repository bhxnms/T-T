# Demo Mode

Demo mode lets you run a public "try before you install" instance of Tourism-Team. A shared demo account is available for visitors, write operations are blocked for that account, and the database resets automatically every hour so the instance stays in a known state.


## Enabling demo mode

Set `DEMO_MODE=true` in your environment and restart Tourism-Team. See [Environment-Variables](Environment-Variables) for how to set environment variables.

When demo mode is active, the login page shows a one-click **"Try the demo"** button. Clicking it logs the visitor in as the demo user immediately — no credentials need to be entered and no registration is required.

**Demo account (auto-created on first start):**

| Field | Value |
|---|---|
| Email | `demo@tt.local` |
| Password | `demo12345` |

**Admin account:** an admin account is also seeded on first start. By default it uses username `admin`, email `admin@tt.local`, and password `admin12345`. You can override these at seed time with the `DEMO_ADMIN_USER`, `DEMO_ADMIN_EMAIL`, and `DEMO_ADMIN_PASS` environment variables (they only take effect when `DEMO_MODE=true`, on the first start before the database is seeded). See [Environment-Variables](Environment-Variables).

**Upgrading an existing demo instance:** earlier builds seeded these accounts as `demo@trek.app` and `admin@trek.app` (and, before that, `demo@nomad.app` / `admin@nomad.app`). Those addresses are still recognised, so an instance that upgraded in place keeps working without a reset: the demo login finds the row wherever it sits, and the blocks below still apply to it. New rows are only created under the addresses above when no existing account is found.

## What the demo user can and cannot do

The demo user account has read access to the shared trip data but the following operations are permanently blocked:

- **Password change** — returns 403.
- **Account deletion** — returns 403.
- **MFA enrollment or removal** — returns 403.
- **File uploads** — avatar uploads, trip cover uploads, and document/photo file attachments are blocked and return 403.
- **All MCP write tools** — create, update, and delete operations via the MCP API are blocked for the demo user.

Registration is also disabled while demo mode is active — visitors cannot create new accounts.

The admin account is unaffected and retains full access.

## Hourly reset

Tourism-Team schedules an automatic hourly reset of the demo database. At each reset:

1. The current `travel.db` is replaced with the saved baseline (`travel-baseline.db`).
2. The admin account's credentials (`password_hash`, API keys, avatar) are re-applied on top of the restored baseline, so admin API keys and password changes survive the reset.

If no baseline has been saved yet, the reset is skipped and a message is logged.

The carry-over finds the admin row by resolving `DEMO_ADMIN_EMAIL` when you set it, and otherwise working through the current default (`admin@tt.local`) and the addresses earlier builds seeded. The seeder and the reset share that list, so they cannot disagree about which row is the admin — which matters because the restored baseline is a file written at seed time and may carry any of those addresses. Setting `DEMO_ADMIN_EMAIL` explicitly still pins the lookup to one address, and is the right choice if you renamed the account yourself.

The instance-wide Maps and Unsplash keys stored in `app_settings` are carried across either way, so map and photo search keep working after a reset.

## Saving a baseline

The baseline is the snapshot the hourly reset restores to. The admin can update it at any time:

**Endpoint:** `POST /api/admin/save-demo-baseline`

This is available in the admin panel. The baseline captures the current state of the database — including trip data, settings, and encrypted API keys — so demo features (maps, photos, weather) continue to work after each reset.

On first start with demo mode active, Tourism-Team seeds three example trips (Tokyo & Kyoto, Barcelona Long Weekend, New York City) owned by the admin and shared with the demo user, then saves the initial baseline automatically.

## Limitations

- Demo mode is not for production use with real user data. The hourly reset deletes all visitor-created content.
- All demo visitors share a single account — there is no isolation between sessions.
- File uploads (photos, documents, trip covers, avatars) are disabled for the demo user.

## See also

- [Environment-Variables](Environment-Variables)
- [Backups](Backups)
