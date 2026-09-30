# Alerts — How the Outbreak Alert System Works

This document explains the `Alert` lifecycle end to end: what triggers one, how
duplicates are prevented, how it resolves, who can see/act on it, and how it
connects to email and the in-app Notification Center. See also
[NOTIFICATIONS.md](NOTIFICATIONS.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## What an Alert is

An `Alert` (`backend2/models/Alert.js`) is a persisted record that a
district is currently experiencing an outbreak-risk pattern serious enough to
warrant escalation — as opposed to a `Prediction`, which is just one risk
assessment for one case report. Alerts are the thing operators/admins
acknowledge, resolve, and get emailed about.

Key fields:

| Field | Meaning |
|---|---|
| `location` | District the alert concerns |
| `riskLevel` | Always `HIGH` in practice — the only level that creates alerts |
| `status` | `active` \| `resolved` |
| `reason` | Human-readable trigger description |
| `triggeringPredictions[]` | The `Prediction` records that caused/extended this alert (last 5 kept) |
| `resolvedAt` / `resolvedReason` | Set when the alert closes |
| `acknowledgedAt` / `acknowledgedBy` | Set by `POST /api/alerts/:id/acknowledge` (see note below) |
| `notificationSent` / `notificationTimestamp` / `notificationError` | Email delivery tracking for the creation email |
| `metadata.escalationLevel` | Reserved for future multi-level escalation, currently always `1` |

## Trigger logic (`backend2/services/alertChecker.js`)

All alert decisions go through one function: `checkForAlerts(prediction)`.
Every code path that creates a `Prediction` — `POST /report`/`POST /reports`,
CSV upload, and the manual `POST /predictions` endpoint — calls this
immediately after saving the prediction.

```
const ALERT_THRESHOLD = 2;                    // consecutive HIGH predictions needed
const TIME_WINDOW = 48 * 60 * 60 * 1000;      // 48 hours (ALERT_TIME_WINDOW_MS overrides)
```

For a given `(location, currentRisk)`:

1. **Look up the active alert** for that location (case-insensitive exact
   match on `location`).
2. **If `currentRisk !== 'high'`:**
   - An active alert exists → resolve it (`status = 'resolved'`, log the
     reason, send `ALERT_RESOLVED` in-app notification, **no email** — auto-resolve
     is silent by design, only creation and manual actions email).
   - No active alert → nothing to do.
3. **If `currentRisk === 'high'` and an active alert already exists** →
   append this prediction to `triggeringPredictions` (capped at the last 5)
   and return `action: 'none'`. This is the dedup guard: **one active alert
   per location, always** — a location already under an active alert never
   gets a second one, no matter how many more HIGH predictions come in.
4. **If `currentRisk === 'high'` and no active alert exists** → check whether
   the threshold is met:
   - Look up the most recent `ALERT_THRESHOLD - 1` predictions at that exact
     location (regardless of risk).
   - All of them must be `HIGH` **and** dated within the last `TIME_WINDOW`
     (48h) for the count to qualify as "consecutive."
   - If met → create the `Alert`, send the creation email, send the
     `ALERT_CREATED` in-app notification.
   - If not met → return `action: 'none'`; the app is waiting for one more
     HIGH prediction at that location.

**A single `HIGH` report never creates an alert.** It takes two, at the same
district, within 48 hours, with no other non-HIGH reading resetting the
streak in between (a MEDIUM/LOW reading doesn't reset the streak directly,
but it does resolve any *existing* alert — the streak requirement is really
"the two most recent predictions at this location are both HIGH and recent").

`ALERT_THRESHOLD` can be dropped to `1` to make a single HIGH reading trigger
immediately — there's a dedicated code path for that (`checkForAlerts`'s
"Step 4a") kept specifically so this is a one-line config change, not a
rewrite.

## The "only one email per alert" guarantee

`alertChecker.js`'s creation branches are **the only place** that calls
`notifyAlertCreation()` (in `utils/mailer.js`). Every caller
(`reports.js`, `uploads.js`, `predictions.js`) reads the outcome back off
`checkForAlerts()`'s return value (`result.notification`) instead of sending
its own follow-up email. This was a deliberate fix for a real bug: those
callers used to *also* send their own "High Risk Detected" email whenever
`action === 'created'`, so every new alert emailed admins/operators 2–3 times
from three different code paths. If you add a new caller of
`checkForAlerts()`, follow the same rule — read `result.notification`, don't
send again.

`markAlertNotified()` persists `notificationSent`/`notificationError` on the
`Alert` document right after the send attempt — `mailer.js` only *reads* that
flag for its own idempotency check, it never writes it, so this write is what
actually makes the guard effective.

## Manual actions (`backend2/routes/alertsApi.js`, mounted at `/api`)

| Endpoint | Who | Effect |
|---|---|---|
| `GET /api/alerts` | any authenticated role | List, filtered by role/district (see RBAC below) |
| `GET /api/alerts/:id` | any authenticated role | Single alert detail |
| `GET /api/alerts/export` | ADMIN, OPERATOR | CSV/Excel/PDF export |
| `POST /api/alerts/:id/notify` | ADMIN, OPERATOR | **Manually resend** the alert email (idempotent-ish "reminder", not a new alert). Also fires an `ALERT_NOTIFIED` in-app notification. See [NOTIFICATIONS.md](NOTIFICATIONS.md) for the recipient rule. |
| `POST /api/alerts/:id/acknowledge` | ADMIN, OPERATOR | Stamps `acknowledgedAt`/`acknowledgedBy`. **Not currently wired to any frontend button** — reachable via direct API call only. No in-app notification is fired for it (nothing in the UI triggers it, so there's nothing to surface). |
| `POST /api/alerts/:id/resolve` | ADMIN, OPERATOR | Manually resolves an alert before risk naturally drops. Fires `ALERT_RESOLVED` (PUBLIC, same as auto-resolve). |
| `GET /api/alerts/stats/summary` | any authenticated role | Aggregate counts + notification delivery stats |
| `GET /api/alerts/map/locations` | any authenticated role | District-level markers for the Outbreak Map (see below) |
| `POST /api/alerts/check-consecutive/:location` | ADMIN | Diagnostic: manually re-run the consecutive-HIGH check for a district |

OPERATOR is blocked (`403`) from acting on alerts outside their own assigned
district (`operatorMatchesDistrict`) on every one of the mutating endpoints
above.

## RBAC — who sees what

Alerts use `buildDistrictFilter(req.user)` from `utils/auth.js`, the same
helper used for reports/predictions/analytics:

- **ADMIN** — `getUserDistrict()` returns `""` for non-OPERATOR roles, so the
  filter is `{}`: **every alert, every district.**
- **OPERATOR** — filter locks to their own assigned district
  (`user.locations[0]`).
- **USER** — also gets `{}` (same as ADMIN), because `getUserDistrict()` only
  restricts the `OPERATOR` role. This is intentional, not a gap: outbreak
  alerts are public-safety information by design (same reasoning as the
  `ALERT_CREATED`/`ALERT_RESOLVED` notifications being `PUBLIC` audience —
  see NOTIFICATIONS.md). A logged-in USER can list all alerts and see the
  Outbreak Map for every district, but never case-level detail (no
  `reasons[]`, `activeCount`/`resolvedCount` breakdown — those are stripped
  for USER in `/api/alerts/map/locations`).

## Outbreak Map coordinates

`GET /api/alerts/map/locations` groups alerts by district, then resolves
lat/lng two ways:

1. `utils/districtCoordinates.js` — a static lookup table. Includes both
   `"hanumakonda"` and `"hanamkonda"` as separate keys pointing at the same
   coordinates, since real report/alert data uses the "Hanamkonda" spelling
   (missing the 'u') while the canonical Telangana district name is
   "Hanumakonda" — without both keys that district's alerts silently
   couldn't be placed on the map.
2. **Fallback**: if a district isn't in the static table at all, it averages
   the lat/lng of that district's own `CaseReport` documents. Only the
   aggregate average is computed and returned — no individual report's
   coordinates are ever exposed through this endpoint.

A district that matches neither is skipped from the map rather than guessed
at.

## Known limitations / things to be aware of

- `acknowledge` exists as a real, working endpoint but has no frontend button
  today — it's dead code from the UI's perspective, not a bug.
- The consecutive-HIGH check in `alertChecker.js` matches on the same
  **exact** location string (case-insensitive, but no fuzzy/alias matching).
  Two different spellings of the same district are treated as two separate
  locations for alerting purposes — each would need its own two consecutive
  HIGH readings to trigger. Only the Outbreak Map's coordinate lookup has an
  explicit alias table (`hanumakonda`/`hanamkonda`); the alert-triggering
  logic itself does not. Keep report/operator district spelling consistent
  for a given district to avoid this.
