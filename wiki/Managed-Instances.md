# Managed Instances

A **managed instance** is a Tourism-Team deployment run by somebody else on your behalf — a hosted
service, a company-internal deployment, a shared instance. It is a distinct operating mode, not just
a configuration.

The mode is enabled with `TREK_MANAGED=true` on the server. It changes what an administrator can do,
because on a hosted instance the person with the admin account is not the person who operates the
server.

## What changes

On a managed instance, certain administrative surfaces are **withheld** — the server refuses them
outright rather than hiding them in the UI, so the restriction cannot be bypassed by calling the API
directly. They are the settings whose value belongs to whoever operates the install:

- **Storage backends** and their credentials
- **Cloudflare Tunnel** configuration
- **Backup** schedule and restore — backups run off-volume on a managed install, so a customer-run
  schedule would compete with the real one
- **Release channels and update checking** — the operator decides when the instance upgrades
- **SMTP, OIDC and outbound integrations** whose credentials are the operator's
- **Plugin sideloading and linking**
- **Instance API keys** registered to the operator's own accounts (maps, weather, LLM, and similar)

The pattern is consistent: anything where using a customer's own account would make the operator's
arrangement unaccountable, or where two parties would be scheduling the same job, is the operator's.

## What stays with the admin

Everything that is about *how the users of this instance work* remains available:

- User accounts and invites
- Categories and packing templates
- Addon toggles, including collaboration features
- Per-user default settings
- The audit log
- Notification configuration for channels the instance owns

The intent is that a company can run Tourism-Team for its staff, and the staff's administrator can
still shape the workspace — without being able to point the instance at a different database or
redirect its email.

## What users see

From a user's perspective a managed instance looks like a normal one, with three differences:

- **Release notices and support prompts are suppressed.** A notice asking the reader to fund the
  project makes no sense when they already pay whoever runs the instance, and bug reports belong
  with the operator rather than upstream.
- **Some integrations are pre-configured** and not editable by them.
- **The About page is trimmed** — the source link and version stay, because the licence requires
  offering the source to network users, but the parts addressed to a self-hoster are removed.

## Running one

If you operate a managed instance and want to override a withheld setting, you set it in the
instance's environment rather than through the UI. Environment values take precedence over anything
stored in the database, which is also why a customer-side change cannot silently win.

> **A note on trust.** A managed admin can still read the data of the instance they administer —
> that is what an admin account means. The mode restricts what they can *re-configure*, not what
> they can see.

## Related

- [Admin Panel Overview](Admin-Panel-Overview) — the administrative surfaces
- [Admin Storage](Admin-Storage) — one of the withheld areas, for self-hosted instances
- [Environment Variables](Environment-Variables) — `TREK_MANAGED` and the operator-side settings
- [Backups](Backups) — how backup scheduling differs
