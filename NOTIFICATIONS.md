# Notifications — In-App Notification Center + Email

SmartHealth has **two independent notification systems** that intentionally
never call each other:

1. **Email** (`utils/mailer.js`, `services/alertNotifier.js`,
   `utils/notificationRecipients.js`) — real SMTP delivery via Nodemailer.
   Existed first; unchanged by the Notification Center below.
2. **In-app Notification Center** (`models/Notification.js`,
   `services/notificationCenter.js`, `routes/notifications.js`,
   `frontend/src/components/NotificationBell.tsx`) — the navbar bell/panel.
   Newer; added without modifying the email pipeline.

Each event source (alert creation, CSV upload, etc.) calls both
independently, side by side. Creating an in-app notification never sends an
email, and sending an email never creates an in-app notification. This keeps
either system free to fail, be disabled, or be changed without breaking the
other — see `createNotification()`'s doc comment in `notificationCenter.js`.

---

## Part 1 — In-app Notification Center

### Data model (`backend2/models/Notification.js`)

| Field | Meaning |
|---|---|
| `type` | One of the 6 event types below |
| `title` / `message` | Display text |
| `location` | District this concerns, or `null` for non-district events |
| `severity` | `LOW`/`MEDIUM`/`HIGH`/`null` |
| `entityId` / `entityType` | Loose pointer to the `Alert`/`CaseReport`/`User` this is about |
| `audience` | `ADMIN` \| `DISTRICT` \| `PUBLIC` — who can see it (see RBAC below) |
| `readBy` | Array of `User` ObjectIds — **per-user** read state, not a global boolean |
| `createdAt` | Timestamp |

**Why `readBy` is an array, not a boolean:** the same notification (e.g.
"Alert created in Warangal") is visible to every ADMIN and to that
district's OPERATOR simultaneously. If read state were a single flag, one
admin opening it would mark it read for every other admin too. Each viewer's
read state is independent, tracked via `$addToSet`.

### The 6 event types and their audience

| Type | Fired from | Audience | Why |
|---|---|---|---|
| `ALERT_CREATED` | `services/alertChecker.js` (both threshold branches) | `PUBLIC` | Outbreak alerts are public-safety info — same visibility as the Outbreak Map |
| `ALERT_RESOLVED` | `alertChecker.js` (auto-resolve) **and** `routes/alertsApi.js` (`POST /api/alerts/:id/resolve`, manual) | `PUBLIC` | Same reasoning — the public should know a scare has passed |
| `ALERT_NOTIFIED` | `routes/alertsApi.js` (`POST /api/alerts/:id/notify`, the "resend notification" button) | `DISTRICT` if sender is ADMIN, `ADMIN` if sender is OPERATOR | Mirrors the email recipient rule exactly (see Part 2) — whoever would receive the *email* also sees the in-app notification |
| `HIGH_RISK_REPORT` | `routes/reports.js` (`createPredictionAndNotify`) and `routes/uploads.js` (CSV per-row) | `DISTRICT` | Case-adjacent detail — never public, admins + that district's operator only |
| `CSV_UPLOAD_SUCCESS` | `routes/uploads.js` (`POST /upload/case-reports`) and `routes/auth.js` (operator bulk-upload) | `DISTRICT` if the uploader is an OPERATOR (single guaranteed district), `ADMIN` if the uploader is an ADMIN (an admin's CSV can span multiple/no districts, so there's no single district to scope to) | |
| `OPERATOR_CREATED` | `routes/auth.js` (`POST /auth/operators` and the bulk-upload summary) | `ADMIN` | Account management is an admin-only concern |

### RBAC — `buildNotificationFilter()` (`services/notificationCenter.js`)

Deliberately reuses the exact same district-scoping primitives
(`getUserDistrict`, `buildDistrictFilter` from `utils/auth.js`) that every
other role-scoped resource in the app uses — no separate authorization
mechanism was invented for this feature.

```js
function buildNotificationFilter(user) {
  if (role === "ADMIN") return {};                    // sees everything, any audience
  if (role === "OPERATOR") {
    const district = getUserDistrict(user);
    if (!district) return { _id: null };               // no assigned district -> sees nothing
    return { ...buildDistrictFilter(user), audience: { $in: ["DISTRICT", "PUBLIC"] } };
  }
  return { audience: "PUBLIC" };                        // USER
}
```

- **ADMIN** — every notification, regardless of `audience`.
- **OPERATOR** — only `DISTRICT`/`PUBLIC` notifications whose `location`
  matches their own assigned district. An operator with no district assigned
  sees nothing (`_id: null` is a safe-default empty result, not "no
  restriction" — same principle as elsewhere in the codebase where an
  unscoped operator must never fall back to seeing everything).
- **USER** — only `PUBLIC` notifications (alerts created/resolved). Never
  sees `HIGH_RISK_REPORT`, `CSV_UPLOAD_SUCCESS`, `ALERT_NOTIFIED`, or
  `OPERATOR_CREATED`, regardless of district.

### API (`backend2/routes/notifications.js`)

| Endpoint | Purpose |
|---|---|
| `GET /notifications?limit=&skip=&unread=true` | Paginated list, scoped by `buildNotificationFilter`. Each item includes a per-viewer `read: boolean` derived from `readBy`. |
| `GET /notifications/unread-count` | Lightweight count for the navbar badge — avoids fetching the full list just to render a number |
| `POST /notifications/:id/read` | Marks one notification read for the caller only (`$addToSet: { readBy: userId }`), scoped through the same visibility filter so a user can't mark-read (or even discover) a notification outside their role/district |
| `POST /notifications/mark-all-read` | Batch version of the above over every currently-visible notification |

### `createNotification()` never throws

Modeled directly on `utils/auditLogger.js`'s `logAudit()` fail-safe pattern:
a broken notification write must never break the real operation (alert
creation, report submission, CSV upload...) that triggered it. Every call
site does `await createNotification({...})` without wrapping it — failures
are caught and logged inside the function itself, returning `null`.

### Frontend (`frontend/src/components/NotificationBell.tsx`)

- Bell icon in `Navigation.tsx`, next to "System Online" — only rendered
  when a `token` is present (i.e., logged in).
- Polls `GET /notifications/unread-count` every 30s (same cadence as
  `Dashboard.tsx`'s alert refresh) for the badge; fetches the full list only
  when the panel is opened.
- Click-outside closes the panel. Clicking an unread item marks it read
  (optimistic local update, then a best-effort API call). "Mark all as
  read" does the same at the panel level.
- Icons per type: 🚨 `ALERT_CREATED`, ✅ `ALERT_RESOLVED`, 🔔
  `ALERT_NOTIFIED`, 📤 `CSV_UPLOAD_SUCCESS`, ⚠️ `HIGH_RISK_REPORT`, 👤
  `OPERATOR_CREATED`.

---

## Part 2 — Email (unchanged by the Notification Center)

### Transport (`utils/mailer.js`)

- Real SMTP via Nodemailer if `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are set in
  `.env`. Falls back to an auto-created **Ethereal** test account in
  development (logs a preview URL instead of failing) if SMTP isn't
  configured.
- `sendBulkEmail()` sends to multiple recipients via **BCC**, so recipients
  never see each other's addresses.
- Both `notifyUsersOfPrediction()` and `notifyAlertCreation()` retry up to 3
  times with exponential backoff (2s/4s/8s) on send failure, and never throw
  past their own boundary — failures are logged and returned as
  `{ success: false, ... }`, not propagated to break the request that
  triggered them.

### Who gets emailed (`utils/notificationRecipients.js`)

Single source of truth for recipients, two rules:

- **Automatic** (system-triggered alert/prediction): all ADMINs + the
  OPERATOR of the affected district. Regular USERs are **never** emailed.
- **Manual notify** (`POST /api/alerts/:id/notify`, a human clicks
  "Resend notification"): recipients depend on who clicked it —
  - Sender is OPERATOR → notify all ADMINs.
  - Sender is ADMIN → notify only the OPERATOR of that alert's district.
  - Recipients are **derived from the sender's role, never taken from
    client input** — this is a deliberate security property, not an
    oversight.

This exact rule is what `ALERT_NOTIFIED`'s `audience` mirrors in Part 1 —
whoever the email would go to is who sees the in-app notification too.

### When emails actually fire

- **Alert creation** — exactly once, from `alertChecker.js` only (see
  [ALERTS.md](ALERTS.md#the-only-one-email-per-alert-guarantee) for why
  every other caller is forbidden from sending its own).
- **Alert auto-resolve** — **no email.** Silent by design; only the in-app
  `ALERT_RESOLVED` notification fires.
- **Manual resolve** (`POST /api/alerts/:id/resolve`) — no email either,
  same as auto-resolve.
- **Manual notify** (`POST /api/alerts/:id/notify`) — always emails (that's
  the entire point of the button), idempotency isn't enforced here the way
  it is for creation — it's explicitly a "send it again" action.
- **Forgot password** — a separate, unrelated flow (`routes/auth.js`,
  `POST /auth/forgot-password`), sent fire-and-forget so the HTTP response
  doesn't block on SMTP latency. Not part of either notification system
  described above.

---

## Adding a new notification type

1. Add the type to the `enum` in `models/Notification.js`.
2. Decide its `audience` using the existing three-tier model — don't invent
   a fourth tier or a custom recipient list; if the existing tiers don't fit,
   that's a sign the event needs its own `location` scoping thought through
   first, not a new audience value.
3. Call `createNotification({...})` at the single authoritative source of
   the event (not at every caller that happens to trigger it — see the
   "only one email" discipline in ALERTS.md, the same principle applies
   here to avoid duplicate in-app notifications).
4. If it should also email someone, that's `utils/mailer.js` +
   `notificationRecipients.js` — a completely separate call, not something
   `createNotification()` does for you.
5. Add an icon for it in `NotificationBell.tsx`'s `TYPE_ICON` map (falls
   back to 🔔 if omitted, so this step is cosmetic, not required).
