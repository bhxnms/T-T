# Cloudflare Tunnel

> **Complete beginner?** Start with [Zero-basics setup](#zero-basics-setup) below — it walks through
> every step from creating the account onward and says, for each one, what you need to end up with
> and what has to be running. The reference material above it is written for people who already know
> their way around a reverse proxy; feel free to skip it for now.

This page is the step-by-step walkthrough for publishing your instance to the internet through a
Cloudflare Tunnel. For the surrounding proxy context — WebSocket upgrades, body size limits, MCP
header passthrough — see [Reverse Proxy](Reverse-Proxy).

> **Short version:** you need a Cloudflare account, a domain on that account, and a Cloudflare API
> token. You run one extra container. You do not need to open a port, obtain a certificate, or edit
> a config file.

## What a tunnel actually does

`cloudflared` runs on your machine and dials *out* to Cloudflare's edge. Cloudflare then serves your
hostname from the edge and forwards requests back down that already-open connection.

Two consequences worth understanding before you start:

- **Nothing is exposed on your network.** There is no inbound port, so there is nothing to scan.
- **A process has to run.** Tourism-Team deliberately does **not** run it. The container mounts its
  filesystem read-only and drops its capabilities, so it cannot host a second long-lived binary.
  The connector is a separate container (or service) sitting next to the app.

## Before you start

You need:

1. A **Cloudflare account** with your domain added as a zone (the domain's nameservers must point
   at Cloudflare).
2. An **API token** with these permissions:
   - **Account → Cloudflare Tunnel → Edit**
   - **Zone → DNS → Edit**

   Create it under *My Profile → API Tokens → Create Token → Custom token*. The permission names
   are searched in the token builder.
3. Your **Account ID** — visible in the Cloudflare dashboard URL:
   `dash.cloudflare.com/<account-id>/…`
4. About five minutes.

> **Write permission is needed.** The panel creates the tunnel, writes its ingress rules and points
> DNS at it. A read-only token will pass the connection test and then fail at the create step.

## Step 1 — Configure the panel

1. Sign in as an administrator and open **Admin → Configuration → Cloudflare Tunnel**.
2. The feature is **off by default**. Tick **Enable Cloudflare Tunnel configuration**.
   Off is not cosmetic: while it is off nothing is stored, nothing is applied, and if you already
   run your own tunnel it keeps working untouched.
3. Fill in:
   - **Account ID** — the 32-character id from the dashboard URL.
   - **API Token** — the token from above. It is encrypted at rest and only ever shown back as
     `••••••••`.
   - **Tunnel name** — any label, e.g. `tt-planner`. It is how the tunnel appears in Cloudflare's
     dashboard, not a hostname.
   - **Public hostname** — the address you will use, e.g. `tt.example.com`. It must be inside a zone
     on this account.
   - **Service host** — where the connector reaches the app. Leave it at `app` when the connector
     runs as a sidecar in the same Docker network (what the shipped compose file sets up). Set it to
     `localhost` for any install where the connector is **not** a sibling container — the portable
     Windows package, bare metal, LXC, or a connector run from the host in front of a container whose
     port is published. The panel pre-fills the right one for your install.
   - **Service port** — the panel fills in the port this instance is actually listening on, so you
     normally leave it alone. Change it only if you moved the app or put a proxy in front of it.
4. Press **Save**.

The panel lists which fields are still missing, so a half-filled form tells you what it is waiting
for rather than failing silently.

## Step 2 — Test the credentials

Press **Test connection**.

- **Success** shows the account name and a list of tunnels already in the account, so a typo in the
  tunnel name is visible before you create anything.
- **A rejected token** shows Cloudflare's own message (typically `Invalid API Token`).
- **A token without account scope** is reported as such — the token is valid, it just cannot manage
  tunnels, and the message names the permission to add.

The test does not save anything and does not create anything.

## Step 3 — Create the tunnel

Press **Create the tunnel**. In one action the panel:

1. Creates the tunnel (or reuses an existing tunnel with the same name — running it twice is safe).
2. Writes the tunnel's ingress rules so the public hostname routes to the service host and port from
   the form (`http://app:3000` on a Docker install that kept the defaults).
3. Creates the DNS record pointing your hostname at the tunnel.
4. Displays the **connector token**.

**Copy the connector token immediately.** It is shown once and Tourism-Team does not keep a copy —
the app never runs the connector, so it has no later use for it. If you lose it, press
**Recreate the tunnel** to get a fresh one.

Because the tunnel is created as *remotely managed*, there is no `config.yml` and no credentials
file anywhere: the routing rules live in Cloudflare's configuration, which the panel wrote for you.
That is the whole reason this flow needs no `cloudflared tunnel create` and no interactive login.

## Step 4 — Run the connector

The panel renders the instructions for **your** install, and the two cases are genuinely different.

### In Docker (the connector is a sidecar)

Add a second service next to your existing `app` service:

```yaml
services:
  app:
    # ... your existing app service, unchanged ...

  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - app
```

Put the token you copied into `CLOUDFLARE_TUNNEL_TOKEN`, then `docker compose up -d`.

The connector joins the same network as the app, which is why the service host is `app` — that name
resolves inside the compose network and nowhere else.

### Not in Docker (the connector runs on the same machine)

The portable Windows package, a bare-metal or LXC install, and a connector run from the host all
take the same shape: download cloudflared and run one command. There is no compose network to join,
so the service host is `localhost`.

1. Download `cloudflared` for your platform from Cloudflare's
   [releases page](https://github.com/cloudflare/cloudflared/releases) — on Windows take
   `cloudflared-windows-amd64.exe`.
2. Run it with the token from step 3:

```bash
cloudflared tunnel --no-autoupdate run --token <your-connector-token>
```

On Windows, rename the download to `cloudflared.exe` and run it from a terminal in that folder:

```powershell
.\cloudflared.exe tunnel --no-autoupdate run --token <your-connector-token>
```

There is no config file to write, and no `cloudflared tunnel create` to run: the routing rules
already live in Cloudflare's configuration, which the panel wrote for you.

> **The service host is the field that breaks silently.** Point the connector at a name it cannot
> resolve — `app` outside Docker, `localhost` from a sidecar — and the connector starts cleanly, the
> hostname resolves, and every request answers **502**. If that happens, check the service host and
> port in the panel against what the app is actually listening on; the panel shows both.

> **Point it at `app`, not `localhost`.** Inside a Compose network the connector reaches the app by
> its service name on the container port. The panel already wrote the right target into Cloudflare's
> config; this only matters if you rebuild the setup by hand.

## Step 5 — Tell the app its own address

Two values live in your `.env` file, not in the database, so the panel cannot set them for you:

```env
APP_URL=https://tt.example.com
TRUST_PROXY=1
```

Both are shipped as commented, hard-coded lines in `docker-compose.yml`, so they also have to be
uncommented there — a value in `.env` alone never reaches the container. See
[step 9 of the zero-basics setup](#step-9-tell-the-app-its-own-address) for the exact edit.

- **`APP_URL`** is the address the app believes it is served from. It is used in password-reset
  emails, calendar-feed URLs, OIDC redirect URIs and the HTTPS redirect target. If it is wrong,
  those links point somewhere that does not work — the app itself will look fine, which is what
  makes this easy to miss.
- **`TRUST_PROXY`** is how many proxies sit in front of the app. Cloudflare directly is `1`. If you
  also run your own nginx or Caddy between Cloudflare and the app, it is `2`.

Recreate the app container after changing either one (`docker compose up -d`, not `restart` — the
container has to pick up the new `environment:` values).

## Verifying it works

1. Open `https://<your-hostname>` in a browser. The padlock should be valid — Cloudflare's
   certificate, no setup on your side.
2. Sign in. If login appears to succeed and then bounces you back to the login page, `TRUST_PROXY`
   is usually wrong: the session cookie is being issued without the `Secure` flag it needs.
3. Open a trip and watch the map. Tiles and websocket updates prove the tunnel is carrying more
   than plain HTML.

## Changing the hostname later

Edit the hostname in the panel and save. The panel then shows the tunnel as **not created**, because
the tunnel that exists no longer matches what the form says. Press **Create the tunnel** again to
reconcile it.

This is deliberate: silently leaving a stale routing rule behind would produce a hostname that
resolves but serves the wrong thing.

## Turning it off

Untick **Enable Cloudflare Tunnel configuration**. Nothing is deleted — the credentials and hostname
are kept, and re-enabling restores exactly the previous state. Your tunnel keeps running as long as
its connector container is up, because the connector was never managed by the app in the first
place.

If you want the tunnel gone entirely:

1. Stop and remove the `tunnel` service.
2. Delete the tunnel and its DNS record in the Cloudflare dashboard.
3. Optionally clear the stored credentials in the panel.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Invalid API Token` on test | Token is wrong, revoked, or lacks the two permissions above. |
| `No zone in this account owns that hostname` | The domain is not added to this Cloudflare account, or you typed a hostname under a domain you do not have. |
| Connector starts, hostname returns 502 | The connector cannot reach the app. Check the service host and port in the tunnel's ingress rules — `app` only resolves inside the Docker network, so a native install needs `localhost`. |
| Login works but the session does not stick | `TRUST_PROXY` is wrong, or `APP_URL` does not match the hostname you are visiting. |
| Emails contain `localhost` links | `APP_URL` is unset. |
| Changes to the panel do nothing | The feature is off; the panel only applies while enabled. |

## Zero-basics setup

This section is for someone who has never used Cloudflare and has never configured a reverse proxy.
Every step states **which site you are on**, **what you should end up holding**, and **whether
anything has to be running**. Follow them in order; there is no need to understand why any of it
works.

The sections above are reference material. Skip them for now and come back when you need them.

### What you need before starting

| Thing | Rough cost | Where it comes from | Where it gets used |
|---|---|---|---|
| A domain name | Roughly $1.50 to $100 per year, depending on the domain | Any registrar | The address people visit |
| A Cloudflare account | Free | Sign up at dash.cloudflare.com | Hosts the domain, owns the tunnel |
| Account ID | Free | In the Cloudflare dashboard URL | Typed into the TT panel |
| API token | Free | Created in the Cloudflare dashboard | Typed into the TT panel |
| Connector token | Free | Generated when the TT panel creates the tunnel | Pasted into docker-compose |

**About the domain:** Cloudflare does not sell you one as part of this — you need a domain first,
from any registrar (Namecheap, Cloudflare Registrar, Google Domains, your local provider). **The
cheapest path** is buying it directly from Cloudflare Registrar, which wires it up automatically and
lets you skip step 2 entirely.

> **Want to try this without buying a domain yet?** Cloudflare also offers a "quick tunnel" that
> needs no account and no domain, and hands you a random `xxx.trycloudflare.com` address. It changes
> on every restart, and **this panel does not support it** (the panel requires a domain and an
> account ID). For that route, see the self-managed cloudflared section under
> [Reverse Proxy](Reverse-Proxy).

### Step 1 — Create the Cloudflare account

1. Go to `dash.cloudflare.com`, click **Sign up**, enter an email and password, then click the
   verification link in the email.
2. Once you are signed in you will land on a screen asking you to add a site. Ignore it for now and
   continue to step 2.

**You should end up with:** a Cloudflare account you can sign into. Nothing else.

### Step 2 — Add your domain to Cloudflare

> If you bought the domain from Cloudflare itself, **skip this step** and go to step 3.

1. In the Cloudflare dashboard click **Add a site** and enter your domain, e.g. `example.com` — with
   **no** `https://` and **no** `www`.
2. Choose the **Free** plan (it is enough; keep clicking Continue at the bottom).
3. Cloudflare shows you two **nameservers**, looking something like:
   ```
   aria.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
4. **Copy those two addresses**, then go to the site where you bought the domain, find the
   "Nameservers" or "DNS settings" section, and **replace** the existing nameservers with the two
   Cloudflare gave you.
5. Back in Cloudflare, click **Done, check nameservers**. This usually takes minutes to a few hours
   (up to 24). Wait until Cloudflare emails you that the domain is active.

**You should end up with:** the domain showing as **Active** in the Cloudflare dashboard.

**Anything to run:** no, this is all in the browser.

### Step 3 — Get your Account ID

1. In the Cloudflare dashboard, click any domain on the left to open its management page.
2. Look at the browser **address bar**. It looks like this:

   ```
   https://dash.cloudflare.com/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p/example.com
   ```

   Read it as three parts — you only want the middle one:

   | Part | What it is |
   |---|---|
   | `https://dash.cloudflare.com/` | Fixed prefix; always looks like this |
   | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p` | **This 32-character string is the Account ID** |
   | `/example.com` | The domain you opened — **not** part of the Account ID |

3. Copy that **32-character string** and keep it somewhere.

**You should end up with:** the Account ID (32 letters and digits, e.g.
`1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`).

> Cannot find it? Use the account switcher in the top right, or just visit `dash.cloudflare.com` —
> the Account ID is the segment right before the domain.

**Anything to run:** no.

### Step 4 — Create the API token

This is the step people most often get wrong. Follow it literally — **the permissions must be
exactly these**.

1. Click your **avatar in the top right** of the Cloudflare dashboard → **My Profile**.
2. Choose **API Tokens** on the left → click **Create Token**.
3. Scroll down to **Custom token** and click **Get started** next to it.
4. Under **Token name**, type anything, e.g. `tt-tunnel`.
5. In the **Permissions** section add **two rows** (use `+ Add more` for the second):

   | Column 1 | Column 2 | Column 3 |
   |---|---|---|
   | Account | Cloudflare Tunnel | Edit |
   | Zone | DNS | Edit |

6. Under **Account Resources** pick your account; under **Zone Resources** pick `All zones` or your
   specific domain.
7. Click **Continue to summary** → **Create Token**.
8. The page now shows the token. **Copy it immediately** — it is shown once. It looks like:
   ```
   AbCdEf1234567890_thisIsYourApiTokenXyZ...
   ```

**You should end up with:** the API token (one long string).

> **⚠️ Common mistake:** granting only *Read*. The panel has to **create** a tunnel and **write** a
> DNS record, so both entries must be **Edit**. A read-only token passes the connection test and
> then fails when you create the tunnel.

**Anything to run:** no.

### Step 5 — Fill in the TT panel

1. Sign in to your Tourism-Team instance **as an administrator**.
2. Go to **Admin** → the **Configuration** group → **Cloudflare Tunnel**.
3. Turn on **Enable Cloudflare Tunnel configuration** (**it is off by default**; while it is off,
   nothing you type below is saved).
4. Fill in:

   | Field in the panel | What goes in it |
   |---|---|
   | **Account ID** | The 32 characters from step 3 |
   | **API Token** | The token you copied in step 4 |
   | **Tunnel name** | Any label, e.g. `tt-planner`. It is a label, **not a web address** |
   | **Public hostname** | The address you want, e.g. `tt.example.com`. It must sit under the domain from step 2 |
   | **Service host** | Leave the pre-filled value. `app` on Docker, `localhost` everywhere else — see step 8 |
   | **Service port** | Leave the pre-filled value: the panel fills in the port this instance is listening on |

5. Click **Save**.

**You should end up with:** a "settings saved" confirmation. If it says **Missing: …** instead, a
field is still empty.

**Anything to run:** no.

### Step 6 — Test the credentials

Click **Test connection**.

- ✅ **Success** shows your account name and the tunnels already in the account — a good moment to
  check you have not reused an existing tunnel name.
- ❌ **`Invalid API Token`** — the token was copied wrong, revoked, or has the wrong permissions. Re
  do step 4.
- ❌ **A message about missing account scope** — the token is valid but lacks *Account → Cloudflare
  Tunnel → Edit*. Go back and add it.

**The test saves nothing and creates nothing**, so it is safe to click repeatedly.

**You should end up with:** a green success message.

### Step 7 — Create the tunnel and copy the connector token

1. Click **Create the tunnel**. The panel does all of this for you (you do not touch the Cloudflare
   dashboard):
   - creates the tunnel (reusing one with the same name, so clicking twice is safe)
   - writes the routing rule that points your public hostname at the service host and port from the form
   - creates the DNS record
2. When it finishes, the panel displays the **connector token**.

**⚠️ This is what you must capture: the connector token.** Copy it **immediately** — it is shown
once and Tourism-Team keeps no copy. If you lose it, click **Recreate the tunnel** to get a fresh
one.

It is a long opaque string, e.g.:
```
eyJhIjoiMWFiYzM0...（very long, right to the end）
```

> **Two different tokens — do not mix them up.** The one from step 4 is for Tourism-Team (it acts on
> Cloudflare). This one is for the `cloudflared` connector (it joins the tunnel). They are not
> interchangeable.

### Step 8 — Run the connector (the one extra process)

As explained above, **Tourism-Team does not run the connector**. You have to run a `cloudflared`
container yourself. This is the only step where you start something new.

**If you deploy with docker-compose (recommended):**

1. Open your `docker-compose.yml`. The block is **already there at the bottom**, just commented out:
   ```yaml
   #  tunnel:
   #    image: cloudflare/cloudflared:latest
   #    container_name: tt-planner-tunnel
   #    restart: unless-stopped
   #    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
   #    depends_on:
   #      - app
   ```
2. **Delete the leading `#`** from every line from `tunnel:` down to `- app`.
3. Open the `.env` file next to it and add one line (with the token from step 7):
   ```env
   CLOUDFLARE_TUNNEL_TOKEN=paste-your-connector-token
   ```
4. Run:
   ```bash
   docker compose up -d
   ```
5. Check that the connector came up:
   ```bash
   docker compose logs tunnel
   ```
   A line like `Registered tunnel connection` means it is connected.

**If you are not using compose (installing cloudflared directly):**

This is the path for the portable Windows package, bare metal and LXC. There is no compose network,
so the **Service host** in the panel must be `localhost` — with `app` the connector would start fine
and every request would answer 502.

1. Download `cloudflared` from Cloudflare's
   [releases page](https://github.com/cloudflare/cloudflared/releases). On Windows take
   `cloudflared-windows-amd64.exe` and rename it to `cloudflared.exe`.
2. Run one command — there is no config file to write:
   ```bash
   cloudflared tunnel --no-autoupdate run --token paste-your-connector-token
   ```
   On Windows, from a terminal in the folder holding the download:
   ```powershell
   .\cloudflared.exe tunnel --no-autoupdate run --token paste-your-connector-token
   ```

To start it on boot, wrap that in a systemd unit on Linux. Still **no `config.yml`**.

**Anything to run:** one `cloudflared` container (or process). **That is the only one.**

### Step 9 — Tell the app its own address

Two more settings are needed. They do **not** live in the database (so the panel cannot set them for
you) — they go in the two files inside your **deployment directory**.

**Where those files are:** the directory where you put `docker-compose.yml` — the one you `cd` into
to run `docker compose up -d`, e.g. `/opt/tt-planner/` or `~/tt-planner/`. The `.env` file sits
**next to** `docker-compose.yml`:

```
your-deployment-directory/
├── docker-compose.yml     ← where you uncommented the tunnel service in step 8
├── .env                   ← the file this step edits (create it if it is missing)
├── data/                  ← database (created automatically)
└── uploads/               ← uploaded files (created automatically)
```

> Not sure which directory you are in? Run
> `docker inspect tt-planner --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'`
> on the server and it prints the deployment directory. `.env` is there.

**You have to edit both files — do not skip the second one:**

**① Add these two lines to `.env`:**

```env
APP_URL=https://tt.example.com
TRUST_PROXY=1
```

**② Then open `docker-compose.yml` and delete the leading `#` from these two lines in the `app`
service's `environment:` section:**

```yaml
    environment:
      # ... other settings above ...
#      - TRUST_PROXY=1
#      - APP_URL=https://planner.example.com
```

so they read:

```yaml
    environment:
      # ... other settings above ...
      - TRUST_PROXY=${TRUST_PROXY:-1}
      - APP_URL=${APP_URL:-}
```

> **Why both files?** In `docker-compose.yml`, `APP_URL` and `TRUST_PROXY` ship as **hard-coded
> commented lines** — unlike `CLOUDFLARE_TUNNEL_TOKEN`, they are not written as `${APP_URL}` to pull
> from `.env`. So **putting them in `.env` alone does nothing**: the container never receives the
> value. Rewriting the line as `${...}` (as above) is what makes the `.env` value reach the
> container. This is the general rule described under
> [Install: Docker Compose](Install-Docker-Compose#environment-variables).

What the two values mean:

- **`APP_URL`** is the public hostname from step 5, **including `https://`**. It decides the URLs in
  password-reset emails, calendar feeds and SSO redirects. Get it wrong and **the app itself still
  looks fine** while the links in its emails point nowhere — which is exactly why this is easy to
  miss.
- **`TRUST_PROXY`** is `1` (Cloudflare directly). Use `2` only if you also run your own nginx or
  Caddy between Cloudflare and the app.

Then **recreate the app container** (from the same deployment directory):

```bash
docker compose up -d
```

> Use `up -d`, not `restart`: after changing `environment:` the container has to be **recreated** for
> the new variables to take effect — a plain `restart` keeps using the old configuration.

**You should end up with:** two lines added to `.env` plus two lines uncommented in
`docker-compose.yml`, and the container recreated.

> Not sure it took effect? Run `docker compose exec app printenv APP_URL TRUST_PROXY` — if it prints
> the values you set, they reached the container.

### Step 10 — Verify

1. Open `https://your-hostname` in a browser. The padlock should be valid — that is Cloudflare's
   certificate, and you configured nothing for it.
2. Sign in. **If login appears to succeed and then bounces you back to the login page**, that is
   almost always `TRUST_PROXY`; revisit step 9.
3. Open a trip and watch the map. Map tiles and live collaboration loading proves the tunnel is
   carrying more than plain HTML.

### All steps at a glance

| Step | Where | What you end up with | Anything to run? |
|---|---|---|---|
| 1 | dash.cloudflare.com | Cloudflare account | No |
| 2 | Cloudflare + your registrar | Domain shows Active | No |
| 3 | Cloudflare dashboard URL | Account ID (32 chars) | No |
| 4 | Cloudflare → My Profile → API Tokens | API token (both permissions Edit) | No |
| 5 | TT → Admin → Configuration → Cloudflare Tunnel | Settings saved | No |
| 6 | Same panel, "Test connection" | Green success | No |
| 7 | Same panel, "Create the tunnel" | **Connector token** (shown once) | No |
| 8 | Your server | Connector running | **Yes — one cloudflared container** |
| 9 | `.env` + `docker-compose.yml` in your deployment directory | `APP_URL` + `TRUST_PROXY` | Recreate the app container |
| 10 | Browser | Padlock + login works | No |

### Zero-basics stumbling blocks

| Symptom | Cause | Fix |
|---|---|---|
| Cannot find the permission names in step 4 | Wrong token type | It must be a **Custom token**, not a template |
| Test says `Invalid API Token` | Token copied incompletely, or granted Read | Recreate it with **Edit** on both entries |
| Saving does nothing | The enable switch is off | Turn it on (step 5), then save |
| Test says no zone owns the hostname | Domain not on this account, or a typo | Recheck step 2 — the domain must be Active |
| Panel says "not created" though you created it | You changed the public hostname | Expected; click **Create the tunnel** again |
| Connector is up but the hostname returns 502 | Connector cannot reach the app | Check the connector's own log; confirm the service host and port match what the app is listening on (`app` inside Docker, `localhost` outside it) |
| Login works but the session does not stick | `TRUST_PROXY` is wrong | Use `1` for Cloudflare directly |
| Emails contain `localhost` links | `APP_URL` is unset | Set it (step 9) and restart |
| No "Cloudflare Tunnel" menu at all | The instance is in managed mode | Managed instances are configured by the hoster; the tab is hidden |

## Related

- [Reverse Proxy](Reverse-Proxy) — self-managed cloudflared, nginx and Caddy, plus the three hard
  requirements for WebSockets, large uploads and MCP
- [Environment Variables](Environment-Variables) — `APP_URL`, `TRUST_PROXY`, `COOKIE_SECURE`
- [Security Hardening](Security-Hardening) — what to review before exposing an instance
- [Troubleshooting](Troubleshooting) — Cloudflare WAF blocking MCP clients
