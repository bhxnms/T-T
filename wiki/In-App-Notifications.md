# In-App Notifications

Tourism-Team can notify you about things happening in your trips: an invitation, a changed booking,
a message in a shared trip, a to-do falling due. This page covers the **in-app inbox** — the
notifications you read inside the app. For delivery by email or webhook, see [Notifications](Notifications).

## The inbox

The bell in the navigation bar opens a list of recent notifications. Each entry shows what happened,
who did it and when, and usually links to the thing it is about — clicking a booking notification
opens the trip at that booking.

Unread items are counted on the bell. Opening the inbox does not silently mark everything read; you
can clear them deliberately.

There is also a full-page view of the same list, reachable from the bell or directly at
`/notifications`. It exists mainly for phones, where the dropdown is cramped.

## What you get notified about

The set of events is fixed by the application:

| Event | When it fires |
|---|---|
| Trip invitation | Somebody invites you to a trip |
| Booking change | A booking is added or changed on a trip you are on |
| Trip reminder | A trip is approaching |
| To-do due | A to-do is nearing or past its due date |
| Vacation invite / share | Vacay fusion requests and shared calendars |
| Collection invite | Somebody shares a collection with you |
| Photos shared | Photos were added to a trip you are on |
| Collaboration message | A new message in a trip's collaboration chat |
| Packing assignment | You were assigned to a packing category |
| Version available | A newer release exists (administrators) |

## Controlling what you receive

**Settings → Notifications** shows a matrix of events against delivery channels, and it applies to
the in-app inbox as well as the other channels. Turning an event off stops it arriving anywhere,
including the bell.

Two layers exist:

- **Instance channels** — an administrator decides which delivery channels the instance offers at
  all (in-app, email, webhook, and any plugin-supplied channel).
- **Your preferences** — within what the instance offers, you choose which events reach you.

An event with no explicit preference is on. The matrix is a way to opt *out*, not a checklist you
must fill in.

Notification emails follow your account language, and are sent to the address on the account.

## Reminders and timing

Trip reminders and to-do reminders are not instant events — they are scheduled. A trip reminder
fires a set number of days before a trip starts; a to-do reminder has its own lead time. Both are
evaluated on a schedule rather than on page load, so a reminder arrives even if you never open the
app.

The reminder lead time is a per-trip setting for trips, and an instance-level default for to-dos.

## Related

- [Notifications](Notifications) — delivery channels, email, webhooks and plugins
- [Trip Members and Sharing](Trip-Members-and-Sharing) — who can notify whom
- [Real-Time Collaboration](Real-Time-Collaboration) — live updates, a separate mechanism
