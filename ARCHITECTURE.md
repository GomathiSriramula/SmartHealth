# Architecture — How Everything Fits Together

A guided walk through what happens when the system runs, end to end. For the
alert lifecycle in depth see [ALERTS.md](ALERTS.md); for the notification
systems in depth see [NOTIFICATIONS.md](NOTIFICATIONS.md); for setup and the
raw API list see [README.md](README.md).

## The three services

```
React/TS Frontend (Vite, :5173)
        │  HTTP + JWT
        ▼
Node/Express API — backend2 (:5000)
        │                      │
        │ HTTP                │ Mongoose
        ▼                      ▼
Python/Flask ml-service (:5005)   MongoDB
        (RandomForestClassifier)
```

- **`frontend/`** never talks to `ml-service` or MongoDB directly — everything
  goes through `backend2`.
- **`backend2`** is the only thing that calls `ml-service`, and the only
  thing that touches MongoDB.
- **`ml-service`** is stateless and disposable: it trains its
  `RandomForestClassifier` on synthetic data fresh every time it starts
  (`generate_synthetic_data(1500)` in `app.py`), and exposes exactly two
  routes: `GET /health` and `POST /predict`. Nothing about it persists
  between restarts.

If `ml-service` is down or times out (3s), `backend2` degrades gracefully
rather than failing the request — see "Risk scoring" below.

## Request flow: a case report end to end

This is the path that exercises almost every subsystem in the app, so it's
the best way to understand how the pieces connect.

```
1. OPERATOR submits a case report
   POST /report or /reports  (routes/reports.js)
        │
        ▼
2. locationGuard() + district auto-fill
   An OPERATOR's report is force-assigned to their own district
   server-side — a form field or CSV value claiming a different
   district is silently overridden, not trusted.
        │
        ▼
3. Risk scoring — utils/mlPredictor.js: getPredictionWithFallback()
        │
        ├─ POST http://localhost:5005/predict (age, sex, severity, symptoms)
        │  On success: use the RandomForestClassifier's riskLevel/confidence
        │  On failure/timeout (3s): fall back to a deterministic
        │  symptom-keyword rule engine (analyzeReportRiskRuleBased) —
        │  the app never fails closed just because ml-service is unreachable
        │
        └─ Severity floor (applySeverityFloor, applied to BOTH paths):
           reporter-marked "Critical"/"Severe" always escalates the result
           to at least HIGH, regardless of what the model/rules alone said.
           A clinician's direct judgement is never silently downgraded.
        │
        ▼
4. Only if riskLevel === 'high': createPredictionAndNotify() (reports.js)
        │
        ├─ Prediction document saved to MongoDB
        ├─ HIGH_RISK_REPORT in-app notification created (DISTRICT audience)
        │
        ▼
5. checkForAlerts(prediction)  (services/alertChecker.js)
        │
        ├─ Not HIGH / no streak yet → nothing further happens
        │
        ├─ 2nd consecutive HIGH at same district within 48h → Alert created:
        │     • notifyAlertCreation() — ONE email to all ADMINs + the
        │       district's OPERATOR (see ALERTS.md for the anti-duplicate
        │       guarantee)
        │     • ALERT_CREATED in-app notification (PUBLIC audience)
        │
        └─ A later non-HIGH reading at that district → Alert auto-resolves:
              • ALERT_RESOLVED in-app notification (PUBLIC), no email
        │
        ▼
6. Response returned to the OPERATOR's browser with the risk analysis;
   the Notification Center bell (polling every 30s) picks up any new
   in-app notifications for everyone whose audience/district matches.
```

The exact same `createPredictionAndNotify()` → `checkForAlerts()` chain is
reused by the CSV bulk-upload path (`routes/uploads.js`) and by manually
created predictions (`routes/predictions.js`) — there is one alerting engine,
not three.

## Auth & RBAC

- **JWT** (`utils/auth.js`) — issued on `/auth/login`, verified by
  `authMiddleware` on every protected route. `requireRole(...)` gates
  specific roles on top of that where needed (most reporting/management
  routes are `ADMIN`/`OPERATOR` only).
- **Three roles**, one enforcement primitive:
  - **ADMIN** — global, every district, full account management.
  - **OPERATOR** — exactly one assigned district (`user.locations[0]`).
  - **USER** — public, self-registered (`POST /auth/register`, always
    forced to role `USER` server-side even if the request body says
    otherwise), aggregate/district-level visibility only.
- **`getUserDistrict(user)`** returns `""` for anyone who isn't an
  `OPERATOR` — that single fact is what makes ADMIN and USER both see
  "everything" through `buildDistrictFilter()` by default. The two roles
  are then differentiated at the route level by `requireRole(...)` (most
  routes are ADMIN/OPERATOR-only, so USER never reaches them at all) or by
  explicit field redaction in the handler (e.g. the Outbreak Map strips
  `reasons[]`/`activeCount`/`resolvedCount` for USER — see ALERTS.md).
- **`buildDistrictFilter(user, fieldName)`** is the one Mongo-query-filter
  helper reused everywhere district scoping applies: reports, predictions,
  analytics, alerts, and (via `buildNotificationFilter`, which wraps it) the
  Notification Center. New district-scoped features should reuse this
  rather than reimplementing the scoping logic.
- **Operators can never escalate their own scope**: every mutating
  alert/report endpoint that takes a target district double-checks
  `operatorMatchesDistrict(req.user, targetDistrict)` and 403s otherwise,
  even though the district filter alone would already exclude
  out-of-district data from *reads*.

## Data model (MongoDB collections)

| Collection | Defined in | Purpose |
|---|---|---|
| `users` | `models.js` | Accounts — `role`, `locations[]` (OPERATOR's district), password hash |
| `casereports` | `models.js` | Raw field-submitted case data (symptoms, severity, patient demographics, coordinates) |
| `predictions` | `models.js` | One risk assessment per HIGH-risk case report (or manual entry) — the input to alerting |
| `alerts` | `models/Alert.js` | Outbreak escalation records — see [ALERTS.md](ALERTS.md) |
| `notifications` | `models/Notification.js` | In-app Notification Center entries — see [NOTIFICATIONS.md](NOTIFICATIONS.md) |
| `auditlogs` | `models/AuditLog.js` | Every sensitive action (edit/delete/resolve/CSV upload/account changes), actor + IP + timestamp |

`models.js` and `models/*.js` both use the same self-registering pattern
(`try { mongoose.model('X') } catch { mongoose.model('X', schema) }`) so
requiring a model file twice in the same process (e.g. from a route and a
service) never throws `OverwriteModelError`.

## Frontend structure

- **No router** — `App.tsx` is a single `useState<currentView>` switch
  between `landing` / `login` / `register` / `forgot-password` /
  `reset-password` / `dashboard`. A JWT in `localStorage` is what
  determines whether `dashboard` is reachable; there's no route-guard
  middleware because there's no router to guard.
- **`Dashboard.tsx`** is the shell for every role — it doesn't fork into
  separate ADMIN/OPERATOR/USER components. Instead, the sidebar
  (`TabButton`s) and each tab's body both conditionally render based on
  `userRole`:
  - **ADMIN + OPERATOR**: Overview, Reports, Submit Report, Alerts, CSV
    Upload, Analytics, Outbreak Map.
  - **ADMIN only, additionally**: District Operators, Community Users,
    Audit Log.
  - **USER only**: Health Advisory, Outbreak Map, Analytics (redacted).
- **`Navigation.tsx`** is the top bar shared by every view inside
  `Dashboard`: back-to-landing, the `NotificationBell`, username, Change
  Password, Logout.
- API base URL is centralized in `components/api.ts`
  (`VITE_API_URL`, defaults to `http://127.0.0.1:5000`) — every component
  imports `API_URL` from there rather than hardcoding it.

## Error handling philosophy (why side-effects never throw)

Three independent "fail-safe" helpers show up repeatedly in this codebase,
all following the same shape — log the failure, return a neutral/failure
value, and let the real operation that triggered them succeed anyway:

- `utils/auditLogger.js`'s `logAudit()` — a broken audit write must never
  block the action being audited.
- `services/notificationCenter.js`'s `createNotification()` — a broken
  in-app notification must never block report/alert/CSV/account creation.
- `utils/mailer.js`'s `notifyAlertCreation()`/`notifyUsersOfPrediction()` —
  a broken email (bad SMTP creds, network blip) must never block the alert
  or prediction itself; delivery success/failure is tracked on the
  `Alert` document instead (`notificationSent`/`notificationError`) so it's
  visible in the UI rather than silently swallowed.

If you add a new side-effect that hangs off a core write (report, alert,
account), follow this same pattern rather than letting it `throw` — wrap it,
log it, return a neutral result.

## Ports & environment (dev defaults)

| Service | Port | Key env vars |
|---|---|---|
| `frontend` | 5173 | `VITE_API_URL` |
| `backend2` | 5000 | `MONGODB_URI`, `JWT_SECRET`, `SMTP_*`, `FRONTEND_ORIGINS`, `ML_SERVICE_URL` |
| `ml-service` | 5005 | `PORT` (optional override) |

See `README.md` for the full `.env` walkthrough and first-run setup.
