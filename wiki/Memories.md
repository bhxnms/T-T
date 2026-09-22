# Memories (Photo Providers)

**Memories** connects Tourism-Team to a photo library you already run, so trip and journal photos
can come from there instead of being uploaded by hand. It is the bridging layer between your photo
server and Journey's galleries.

Memories itself has no page in the app. It is configured under **Settings → Integrations**, and its
photos appear wherever a journal or trip shows pictures.

## Supported providers

| Provider | What it is | Credentials |
|---|---|---|
| **Immich** | Self-hosted photo and video library | Server URL + API key |
| **Synology Photos** | Synology NAS photo app | NAS URL + username/password (or session) |

Both are configured per user: each person connects their own account, so a shared trip does not
pool everyone's photo libraries.

## Setup

### Immich

1. Open **Settings → Integrations → Photos**.
2. Enter your Immich **server URL** (the address you open Immich at) and an **API key** created in
   Immich under *Account Settings → API Keys*.
3. Press **Test** — the dialog reports whether it connected, which account it authenticated as, and
   the canonical URL it resolved.

> **Immich on a private network:** if Immich runs on a LAN address, the SSRF guard blocks it by
> default. Set `ALLOW_INTERNAL_NETWORK=true` (see [Internal Network Access](Internal-Network-Access))
> if you intend to reach a local server. The app will otherwise report a blocked connection rather
> than hanging.

### Synology Photos

1. Enter the NAS URL, username and password.
2. **Skip SSL verification** is available for a NAS with a self-signed certificate. Turning it on
   disables certificate validation for that connection only — it is a convenience for a trusted
   home network, not something to enable over the internet.
3. Press **Test** to confirm the login.

A Synology session can expire or be invalidated when the URL or account changes. When that happens
the app clears the stored session and you sign in again; a notice tells you why.

## Using provider photos

Once connected:

- **Journey galleries** can browse and import photos from the connected provider instead of only
  accepting uploads.
- **Photo search** across your library works from inside the app, filtered by provider.
- Imported photos are referenced rather than copied in some flows and cached in others, so a large
  library does not have to be duplicated. Cached thumbnails are re-derivable and are excluded from
  backups.

## Automatic capture

With a provider connected, location-tagged photos taken during a trip can be pulled into that trip's
journal automatically — the backfill walks your library, matches photos against the trip's dates and
places, and attaches the ones that fit. This is what makes a journal fill itself in after a trip
rather than requiring a manual sort.

## What Memories does not do

- It does not modify your photo library. Photos are read and referenced; nothing is written back.
- It does not replace Journey. Journey owns the journal and its own uploads; Memories is one possible
  source of pictures for it.
- It does not work without the Journey addon enabled — photo providers are derived from it.

## Related

- [Photo Providers](Photo-Providers) — the settings reference for both integrations
- [Journey Journal](Journey-Journal) — where provider photos end up
- [Admin Storage](Admin-Storage) — where cached thumbnails live
- [Internal Network Access](Internal-Network-Access) — reaching a LAN photo server
