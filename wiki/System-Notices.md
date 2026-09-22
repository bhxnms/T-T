# System Notices

System notices are messages the application shows to users on its own initiative — a release
announcement, an onboarding hint, an operational warning. They are different from
[Notifications](Notifications), which report things happening inside your trips.

## How they appear

A notice renders in one of three forms, chosen by the notice itself:

| Form | Where it appears | Typical use |
|---|---|---|
| **Banner** | A strip across the top of the app, dismissible | A warning that does not need to interrupt |
| **Modal** | A dialog in the centre of the screen | A release announcement, a first-run explanation |
| **Toast** | A brief corner message | Nothing urgent, no action needed |

A modal notice can carry a richer layout — a headline, a feature list with icons, a footnote, and a
personal note from the maintainer with a signature. The 4.0-era release notice uses this layout.

## Dismissal and re-appearance

Dismissing a notice is remembered per user, so it does not come back on the next page load.
Some notices are **recurring per version**: they reappear when the app version moves up, which is
how release announcements stay relevant without nagging. Others are one-shot forever.

A notice can also be **admin-only** — visible only to administrators, for operational messages that
would worry a regular user for no reason.

## When notices are withheld

Notices are suppressed in two situations:

- **Demo mode.** A demo instance resets itself hourly; announcements about upgrading are
  meaningless there.
- **Managed instances.** On a centrally administered install, notices that ask the reader to
  support the project or act on the operator's behalf are hidden — the reader is not the operator.

## Which notices exist

An installed instance ships with the notices that belong to its release line. The set changes
between versions: older notices are *retired* rather than deleted, so a user who dismissed one does
not see it again if it is ever re-enabled.

Retirement matters for upgrades. An instance several versions behind sees the notices for the
releases it skipped, in priority order.

## For administrators

There is nothing to configure in the UI. Notices are defined in the application's own registry with
a stable id, a translation key and a condition describing who should see it.

Two consequences for anyone maintaining a fork:

- **Ids are permanent.** Dismissal tracking is keyed by id, so a retired id is never reused.
- **Notice text is translated like any other string.** A notice body that names a version number
  should interpolate it rather than hardcoding it, so the same notice works across locales.

## Related

- [Notifications](Notifications) — trip and account notifications, and their delivery channels
- [Updating](Updating) — what changes between versions
- [Demo Mode](Demo-Mode) — what a demo instance suppresses
