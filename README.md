# SmartHealth — Water-Borne Disease Surveillance & Outbreak Alerting System

Community health surveillance for Telangana districts: field workers submit case reports, a Random Forest model (with a rule-based fallback) scores each case for outbreak risk, and the system automatically escalates and emails admins/operators when a real outbreak pattern emerges.

---

## Overview

SmartHealth has three services:

- **`backend2/`** — Node.js/Express API. Owns auth (JWT), case reports, predictions, the alert lifecycle, email notifications, CSV bulk import/export, and the audit trail.
- **`ml-service/`** — Python/Flask service exposing a trained `RandomForestClassifier` (`/predict`) that scores a case report's outbreak risk as `low` / `medium` / `high` with a confidence score and top contributing factors.
- **`frontend/`** — Vite + React + TypeScript dashboard, role-aware (ADMIN / OPERATOR / USER).

---

## Key Features

### Case reporting
- Single-report submission (`POST /reports`) and CSV bulk upload (`POST /upload/case-reports`), both district-scoped: an OPERATOR's submissions are always forced to their own assigned district server-side, regardless of what a form or CSV row claims.
- Admins/operators can edit or delete reports; edits and deletes are audit-logged and cascade to any dependent prediction/alert records.
- PDF and Excel export of the reports list, filterable by severity/district/date range.

### ML-powered risk prediction
- Every report is scored by `ml-service`'s Random Forest model (age, sex, severity, symptom list as features). If the ML service is unreachable, `mlPredictor.js` falls back to a deterministic symptom-keyword rule engine — the app degrades gracefully rather than failing closed.
- **Severity floor**: a reporter marking a case "Critical" or "Severe" always escalates the resulting risk to at least `HIGH`, regardless of what the model's symptom analysis alone would have produced. This is enforced uniformly on both the ML path and the rule-based fallback.
- Only `HIGH`-risk reports generate a `Prediction` record and feed the alert pipeline.

### Alert lifecycle
- Two consecutive `HIGH`-risk predictions at the same location within 48 hours create an active `Alert` (a single `HIGH` alone never triggers one).
- A subsequent non-`HIGH` reading at that location auto-resolves the alert.
- Admins/operators can manually acknowledge, resolve, or resend the notification for an alert (`POST /api/alerts/:id/{acknowledge,resolve,notify}`).
- Alert creation triggers exactly one email — the pipeline is written to guarantee this isn't a duplicate send.

### Email notifications
- Real SMTP delivery via Nodemailer, with 3-attempt retry (exponential backoff) and per-alert delivery tracking (`notificationSent`/`notificationError`).
- Automatic alerts go to all ADMINs plus the OPERATOR of the affected district only — regular USER accounts are never notified.
- Delivery stats (sent vs. failed) are surfaced in the Alerts tab, so a broken SMTP config is visible in the UI, not just in server logs.

### Role-based access control
- **ADMIN** — full access: all reports/predictions/alerts across every district, operator and admin account management, community-user moderation, the audit log, CSV bulk imports/exports.
- **OPERATOR** — scoped to their one assigned district for reports, predictions, and alerts; can edit reports in-district but cannot delete them.
- **USER** (public, self-registered) — Health Advisory and the Outbreak Map only. Never gets raw case reports, predictions, or per-patient data — only aggregate/district-level signals (e.g. a Critical/Moderate district risk label, never symptoms, coordinates, or confidence scores).

### Analytics & Outbreak Map
- Risk distribution, symptom frequency, age/gender demographics, a 30/60/90-day time series, and top-affected-districts ranking — all computed from real report/prediction counts (not sample/placeholder data).
- The Outbreak Map plots district-level (never exact-coordinate) outbreak markers, with the same USER-safe redaction as the rest of the app.

### Admin account & platform management
- Create/list/delete additional ADMIN accounts (self-delete and last-admin deletion are both blocked to prevent lockout).
- List/remove self-registered community USER accounts (moderation for spam/abuse — registration is public).
- Operator management: create/edit/delete, plus CSV bulk import for onboarding many operators at once.
- **Audit log**: every sensitive action (report edit/delete, alert resolve/notify, CSV upload, account create/delete, password reset) is recorded with actor, role, district, timestamp, and IP — viewable and exportable (CSV/Excel/PDF) by ADMIN.

### Account & password management
- Forgot-password flow: emailed, single-use, SHA-256-hashed, 1-hour-expiry reset tokens; the endpoint always returns the same generic response whether or not the email is registered (no account enumeration).
- Self-service "Change Password" available to every logged-in role.

---

## System Architecture

```
                 ┌────────────────────────────────┐
                 │  React + TypeScript Frontend    │
                 │   Vite Dev Server (port 5173)   │
                 └───────────────┬────────────────┘
                                 │ HTTP / JSON / JWT
                                 ▼
                 ┌────────────────────────────────┐
                 │      Node.js Express API         │
                 │        backend2 (port 5000)      │
                 └──────┬────────┬────────┬────────┘
                        │        │        │
             HTTP/JSON  │        │        │ Mongoose
       ┌────────────────┘        │        └──────────────┐
       ▼                         ▼                       ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Python Flask │         │  Nodemailer   │         │   MongoDB    │
│  ml-service   │         │  (real SMTP)  │         │   (Atlas or  │
│  (port 5005)  │         │ Notifications │         │    local)    │
└──────────────┘         └──────────────┘         └──────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 16+ (with npm)
- Python 3.8+ (with pip)
- A MongoDB connection string (Atlas or local)

### 1. Backend (`backend2/`)
```bash
cd backend2
npm install
cp .env.example .env
```
Fill in `.env` — the real variables the app reads (see `backend2/.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_health
JWT_SECRET=<a strong random value, e.g. `openssl rand -hex 32`>
JWT_EXPIRES_IN=7d
API_KEY=<optional shared key for trusted server-to-server calls>
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FRONTEND_URL=http://localhost:5173

# SMTP — note the prefix is SMTP_*, not EMAIL_*
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=<an app password, not your account password>
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=SmartHealth System

# Bootstraps the very first admin on startup (remove after first login)
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=change-me
DEFAULT_ADMIN_USERNAME=admin
```
If SMTP isn't configured, `utils/mailer.js` automatically falls back to an Ethereal test account and logs a preview URL instead of failing.

```bash
npm start      # or: npm run dev  (nodemon, auto-restart)
```

### 2. ML service (`ml-service/`)
```bash
cd ml-service
pip install -r requirements.txt
python app.py
```
Trains a Random Forest on synthetic data at startup and serves `/predict` on **port 5005**.

### 3. Frontend (`frontend/`)
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL=http://localhost:5000
npm run dev
```
Dashboard at http://localhost:5173.

---

## API Surface

### Auth & accounts (`routes/auth.js`)
```
POST   /auth/register                 - Public self-registration (USER role only)
POST   /auth/login                    - Login, returns JWT
POST   /auth/forgot-password          - Request a password reset email
POST   /auth/reset-password           - Consume a reset token, set new password
PUT    /auth/me/password              - Self-service change password (any role)

POST   /auth/operators                - Create a district operator (ADMIN)
GET    /auth/operators                - List operators (ADMIN)
PUT    /auth/operators/:id            - Edit an operator (ADMIN)
DELETE /auth/operators/:id            - Delete an operator (ADMIN)
POST   /auth/operators/bulk-upload    - CSV bulk-create operators (ADMIN)

POST   /auth/admins                   - Create another admin account (ADMIN)
GET    /auth/admins                   - List admin accounts (ADMIN)
DELETE /auth/admins/:id               - Delete an admin (ADMIN; can't self-delete or delete the last admin)

GET    /auth/users                    - List self-registered USER accounts (ADMIN)
DELETE /auth/users/:id                - Delete a USER account (ADMIN)
```

### Case reports (`routes/reports.js`)
```
POST   /report, POST /reports         - Submit a case report (ADMIN/OPERATOR)
GET    /reports                       - List reports (ADMIN/OPERATOR; district-scoped for OPERATOR)
GET    /reports/:id                   - Report detail + linked prediction (ADMIN/OPERATOR)
PUT    /reports/:id                   - Edit a report (ADMIN any district; OPERATOR own district only)
DELETE /reports/:id                   - Delete a report + cascade its prediction/alerts (ADMIN only)
GET    /reports/export                - PDF/Excel export (ADMIN/OPERATOR)
```

### Predictions (`routes/predictions.js`)
```
POST   /predictions                   - Create a prediction manually (ADMIN/OPERATOR)
GET    /predictions                   - List predictions (ADMIN/OPERATOR)
GET    /predictions/:id               - Prediction detail (ADMIN/OPERATOR)
DELETE /predictions/:id               - Delete a prediction (ADMIN)
DELETE /predictions/orphaned          - Cleanup predictions whose report was deleted (ADMIN)
DELETE /predictions/untracked         - Cleanup predictions never linked to a report (ADMIN)
GET    /predictions/landing-stats     - Public landing-page stats (no auth)
GET    /analytics                     - Full analytics dashboard payload (role-redacted for USER)
```

### CSV uploads (`routes/uploads.js`)
```
POST   /upload/case-reports           - Bulk case-report CSV (ADMIN/OPERATOR)
GET    /upload/stats                  - Ingestion counts (ADMIN/OPERATOR)
```

### Alerts (`routes/alertsApi.js`, mounted at `/api`)
```
GET    /api/alerts                    - List alerts (role/district-scoped)
GET    /api/alerts/:id                - Alert detail
GET    /api/alerts/export             - CSV/Excel/PDF export (ADMIN/OPERATOR)
POST   /api/alerts/:id/acknowledge    - Mark reviewed (ADMIN/OPERATOR)
POST   /api/alerts/:id/resolve        - Resolve (ADMIN/OPERATOR)
POST   /api/alerts/:id/notify         - Resend notification (ADMIN/OPERATOR)
GET    /api/alerts/stats/summary      - Aggregate counts + notification delivery stats
GET    /api/alerts/map/locations      - District-level outbreak markers (privacy-redacted for USER)
```

### Audit log (`routes/auditLogs.js`)
```
GET    /audit-logs                    - Filterable audit trail (ADMIN only)
GET    /audit-logs/export             - CSV/Excel/PDF export (ADMIN only)
```

### ML service (`ml-service/app.py`)
```
GET    /health                        - Model status
POST   /predict                       - { patient_age, sex, severity, symptoms[] } -> risk assessment
```

---

## Repository Structure

```
SmartHealth/
├── backend2/
│   ├── models.js                # CaseReport, Prediction, User (Mongoose schemas)
│   ├── models/                  # Alert, AuditLog
│   ├── routes/                  # auth, reports, predictions, uploads, alertsApi, auditLogs
│   ├── services/                # alertChecker (threshold/escalation logic), alertNotifier
│   ├── utils/                   # auth, mailer, mlPredictor, notificationRecipients,
│   │                             #   districtCoordinates, locationGuard, auditLogger, publisher
│   ├── scripts/                 # One-off dev/diagnostic scripts (NOT part of the running app):
│   │                             #   check_*/debug_*/test_* inspectors, verify_csv,
│   │                             #   cleanup-orphan, remediate_missing_alerts, clear_db.
│   │                             #   Run from anywhere: `node backend2/scripts/check_users.js`
│   │                             #   ⚠️ clear_db.js DROPS EVERY COLLECTION — never run against prod.
│   └── index.js                 # Express app entrypoint
│
├── ml-service/
│   ├── app.py                   # Flask app: trains + serves the Random Forest model
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── components/          # Dashboard, LandingPage, Login/Register, ForgotPassword/
        │                        #   ResetPassword, ChangePasswordModal, Navigation,
        │                        #   AdminOperators, AdminUsers, AuditLogViewer, Analytics,
        │                        #   OutbreakMap, CSVUpload, HealthAdvisory, StatsCard, etc.
        └── App.tsx               # View routing (no react-router; simple state-based views)
```
