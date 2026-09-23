# Install: Windows (portable)

Run Tourism-Team on a Windows machine without Docker and without installing
Node: download a zip, extract it, double-click the launcher. Nothing is written
to the registry and nothing is installed system-wide — deleting the folder
removes the app completely.

> **Not the recommended install for a server.** This package is aimed at a
> single Windows machine — a laptop, a home PC. For a always-on server, the
> [Docker Compose](Install-Docker-Compose) image is the better choice: it
> updates with one command, runs as a service, and is what the documentation
> elsewhere assumes. See [Choosing an install](#choosing-an-install) below.

## What you get

```
TT-Travel-Planner-<version>-win-x64.zip   (~200 MB)
```

Extract it anywhere (your Desktop, `D:\Apps\`, a USB stick) and the folder
contains:

| Path | What it is |
|---|---|
| `TT Travel Planner.exe` | Double-click this. Picks a port, starts the app, opens your browser. |
| `runtime\node.exe` | The Node runtime the app runs on — you do not need Node installed. |
| `app\` | The application itself. |
| `app\server\data\` | Your database, logs and encryption key. **Back this up.** |
| `app\server\uploads\` | Photos, documents and covers you upload. |
| `tt-port.json` | Written on first run; remembers which port to use. |
| `README.txt` | The same instructions, offline. |

## Install

1. Download the zip from the [Releases page](https://github.com/bhxnms/T-T/releases)
   (the file ending in `-win-x64.zip`).
2. Right-click it → **Extract All**, and keep every file together. Do not run
   the launcher from inside the zip: Windows opens it in a temporary folder and
   your data would be deleted when that folder is cleaned up.
3. Double-click **`TT Travel Planner.exe`**.
4. A console window opens. The first run creates its database and prints the
   admin account it generated — **write the password down**, it is shown only
   there.
5. Your browser opens at `http://localhost:3001` (or whichever port was free —
   see below). Sign in and change the password when asked.

> **Avoid `C:\Program Files\`.** Windows restricts writes there, which means the
> app cannot create its data folder. Extract to your user folder or to `D:\`
> instead. The launcher does not need administrator rights.

## The port: what happens on a conflict

Port 3001 is checked **before** the app starts, so a conflict never produces an
error page:

- If 3001 is free, the app uses it.
- If it is taken, the launcher moves up to the next free port (up to 20 along)
  and says so in the console:

  ```
  [!] Port 3001 was in use - using 3002 instead.
  ```

The port that worked is written to `tt-port.json`, so the next launch reuses it
and your bookmark keeps working.

**To pin a port**, edit `tt-port.json` next to the launcher:

```json
{
  "port": 8080
}
```

If that port is in use too, the launcher still moves on rather than failing, and
tells you which port it chose. Delete the file to go back to automatic.

> **Why this matters on Windows specifically.** 3000 and 3001 are popular
> neighbours — other development servers, and Hyper-V's dynamic port
> reservations, which can hold a range without anything visibly listening on it.
> The server itself treats a failed bind as fatal (correct for a container,
> where a restart policy handles it), so the check happens in the launcher
> instead.

## Firewall

The first launch may raise a Windows Defender prompt. Allow it for **private
networks** only unless you intend to reach the app from other devices:

- **Private networks** — lets other machines on your home network open it.
- **Public networks** — leave unchecked on a laptop that joins café or hotel
  Wi-Fi.

The app is reachable at `http://localhost:<port>` regardless of the firewall:
loopback traffic is never filtered. The prompt is only about other devices.

## Starting it automatically

The launcher is a normal program, so the usual Windows ways work:

- **On sign-in:** press `Win+R`, run `shell:startup`, and put a shortcut to
  `TT Travel Planner.exe` in the folder that opens.
- **Task Scheduler:** create a task with trigger "At log on" and action "Start a
  program" pointing at `TT Travel Planner.exe`. Leave "Start in" set to the
  folder you extracted to.

A console window stays open while the app runs; that window **is** the app.
Closing it stops the server.

## Updating

Your data lives in `app\server\data\` and `app\server\uploads\`, and a new
version ships those folders empty. To update:

1. Stop the app (close the console window).
2. Copy `data\` and `uploads\` out of `app\server\` somewhere safe.
3. Extract the new version to a **new folder**.
4. Copy your saved `data\` and `uploads\` into the new `app\server\`, replacing
   what is there.
5. Start the new launcher. The database is migrated automatically on boot.

> **Keep a copy of `app\server\data\.encryption_key`.** It decrypts the secrets
> stored in your database (API keys, MFA seeds, SMTP and OIDC credentials). If
> the file is lost, those values cannot be recovered and have to be re-entered.
> It lives in the same folder as the database, so backing up `data\` covers it.

## Backups

The whole state is two folders:

```
app\server\data\      the database, secrets and logs
app\server\uploads\   uploaded files
```

Copy both while the app is stopped. The admin panel's
**Admin → Backup** also produces an archive, and
[Backups](Backups) describes what it includes.

## Reaching it from outside: Cloudflare Tunnel

The admin panel's **Admin → Cloudflare Tunnel** works here, with one difference from the Docker
instructions you will find in [Cloudflare Tunnel](Cloudflare-Tunnel): there is no compose network, so
the connector runs as an ordinary program on this machine.

What that changes in the panel:

| Field | Docker | Here |
|---|---|---|
| **Service host** | `app` (the compose service name) | **`localhost`** — `app` does not resolve outside the container network |
| **Service port** | `3000` (the image's fixed port) | **whatever the launcher picked** — the panel fills in the port this instance is listening on, so leave it |

The panel pre-fills both correctly for a native install, so in practice you accept the defaults.

Then run the connector on the same machine:

1. Download `cloudflared-windows-amd64.exe` from Cloudflare's
   [releases page](https://github.com/cloudflare/cloudflared/releases) and rename it to
   `cloudflared.exe`.
2. Open a terminal in that folder and run the command the panel shows, with the connector token from
   step 3 of the tunnel walkthrough:

   ```powershell
   .\cloudflared.exe tunnel --no-autoupdate run --token <your-connector-token>
   ```

   There is no config file to write — the routing rules already live in Cloudflare's configuration.

Leave that window open alongside the app's. If you want the connector to start on boot, register it
as a Windows service (from an **administrator** terminal):

```powershell
.\cloudflared.exe service install <your-connector-token>
```

> **A 502 on your hostname means the service host is wrong.** The connector starts cleanly, DNS
> resolves, and every request fails — the connector is dialling an address it cannot reach. On this
> package the answer is `localhost` plus the port the launcher printed at startup.

## What does not work on Windows

- **Booking import from e-mail or PDF.** It relies on
  `kitinerary-extractor`, a KDE helper that ships as a Linux binary. The app
  detects its absence and disables that import path; the AI-based parser
  (see [AI Booking Import](AI-Booking-Import)) is the alternative, and the rest
  of the app is unaffected.
- **The `docker`-based update instructions** elsewhere in this wiki — they
  describe the container image, not this package.

Everything else — trips, maps, Atlas, bookings you enter by hand, budgets,
packing lists, collaboration, the in-app help — works exactly as documented.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| A console window flashes and disappears | You started it in a way that closes on exit. Open a terminal in the folder and run `"TT Travel Planner.exe"` to read the message. |
| "The download is incomplete" | Some files were not extracted (often the zip was opened rather than extracted, or the antivirus quarantined the exe). Extract the whole archive again. |
| "Ports 3001-3020 are all in use" | Something holds that whole range. Set a different port in `tt-port.json`, e.g. `8080`, or close the process holding them (`netstat -ano \| findstr :3001`). |
| Browser opens to a blank page | The app is still migrating its database on first run. Wait a few seconds and reload; the console prints `Ready` when it is up. |
| Forgotten admin password | Stop the app and run `runtime\node.exe app\server\reset-admin.js` from the folder — it prints a fresh admin password. See [Troubleshooting](Troubleshooting). |
| Antivirus deletes the launcher | Unsigned executables that start a local server sometimes trip heuristics. Restore it from quarantine and add an exclusion for the folder. |
| Port is right but nothing loads | Check the console window for the real error, and `app\server\data\logs\trek.log`. |

## Choosing an install

| | Windows portable | Docker Compose |
|---|---|---|
| Needs Docker | No | Yes |
| Needs Node installed | No | No |
| Starts on boot | Task Scheduler or Startup folder | `restart: unless-stopped` |
| Updates | Extract a new zip, move `data`/`uploads` | `docker compose pull && up -d` |
| Update notifications in-app | Yes | Yes |
| Booking import from e-mail/PDF | **No** (Linux-only helper) | Yes |
| Multi-architecture images | x64 only | amd64 + arm64 |
| Best for | A single Windows PC | A home server, NAS, VPS |

## Building the package yourself

The package is produced by a workflow, not by hand:

```bash
node packaging/windows/build-windows.mjs
```

On Windows this embeds the host's own `node.exe` and installs
`better-sqlite3`'s native binary normally. On Linux it cross-builds: it downloads
the matching `node.exe` and asks better-sqlite3's release page for the
**win32-x64** prebuilt for that exact Node version — building on the host would
otherwise stage a Linux binary, which installs cleanly and fails on the user's
machine at the first database query. The script verifies the staged tree
(including that the native module really is a Windows binary and that no
symlinks remain) before zipping, so that failure mode cannot reach a release.

The GitHub workflow is `.github/workflows/windows-package.yml`
(manual dispatch; uploads the zip as a build artifact).
