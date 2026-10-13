# HR Management System

A production-ready **Human Resources portal** for small and mid-size teams.  
Admins manage people, attendance, leave, and payroll. Employees self-serve check-in, leave requests, payslips, and profile updates — all behind role-based authentication.

---

## What this project solves

| Problem | How this app helps |
|---------|-------------------|
| Scattered employee records | Central employee directory with soft-delete |
| Manual attendance tracking | Web check-in / check-out + shift rules + auto check-out cron |
| Leave chaos | Policies, balances, and approval workflow |
| Payslip emails / PDFs | Generate, version, and download payslips |
| Forgotten birthdays | Daily cron emails via Resend |
| Weak access control | NextAuth JWT + admin / employee roles |
| No team-level delegation | Department Head role: scoped leave approvals + attendance edits |
| Slow page loads | Batched DB queries, indexes, and SWR client-side caching |

---

## System overview

```mermaid
flowchart TB
  subgraph Clients
    A[Admin Portal]
    E[Employee Portal]
  end

  subgraph Next.js App Router
    P[proxy.ts<br/>page auth]
    API[API Routes<br/>role-guarded]
    AUTH[NextAuth<br/>credentials + JWT]
  end

  subgraph Data and services
    DB[(MongoDB Atlas)]
    CL[Cloudinary<br/>profile photos]
    RS[Resend<br/>transactional email]
  end

  subgraph Vercel Cron
    C1["/api/cron/birthdays<br/>daily 19:00 UTC / 00:00 PKT"]
    C2["/api/cron/employee-attendance<br/>daily 19:00 UTC / 00:00 PKT"]
    C3["/api/cron/check-reviews<br/>daily 19:00 UTC / 00:00 PKT"]
    C4["/api/cron/leave-reset<br/>daily 19:00 UTC / 00:00 PKT"]
  end

  A --> P --> API
  E --> P --> API
  API --> AUTH
  API --> DB
  API --> CL
  API --> RS
  C1 --> DB
  C1 --> RS
  C2 --> DB
```

### Role flows

```mermaid
flowchart LR
  L[Login] --> R{Role?}
  R -->|admin| AD[Admin dashboard]
  R -->|employee| ED[Employee dashboard]

  AD --> EM[Employees]
  AD --> AT[Attendance]
  AD --> LV[Leave approvals]
  AD --> PS[Payslips]
  AD --> BD[Birthdays]
  AD --> ST[Settings]

  ED --> CI[Check-in / Check-out]
  ED --> LR[Leave requests]
  ED --> MY[My payslips]
  ED --> PF[Profile + photo]

  ED -->|if department head| TH[Team attendance + team leaves]
```

---

## Features

### Admin
- Employee CRUD (soft-delete → `Inactive`, login user removed on delete)
- Attendance timesheets, manual / retro edits, monthly locking
- Shift rules: start/end, grace period, display windows, auto check-out buffer
- Leave policies (global + per employee) and approvals
- Payslip generation with PDF download
- Birthday tracker + automated emails
- Activity log and company settings

### Employee
- Check-in / check-out (Asia/Karachi timezone)
- Attendance history and monthly stats
- Leave requests with live balances
- Own payslips only
- Profile + Cloudinary photo upload (server-side)
- Birthday greeting on dashboard

### Department Head (assigned per department by admin)
- Approve / reject leave requests for their own department members
- View and correct team check-in / check-out times
- Cannot see payslips, cannot change leave policies, cannot act on their own records
- Assignment is atomic: replacing a head instantly demotes the old one to a
  regular employee and grants the new one full head access
- Head status is verified **live against the database** on every request —
  never trusted from the JWT

### Auth and security
- NextAuth credentials + JWT
- Roles: `admin` | `employee` (+ database-verified department-head capability)
- `tokenVersion` for global session invalidation
- Password reset via Resend
- Admin APIs guarded with `getAdminUser()`
- Cron routes require `Authorization: Bearer $CRON_SECRET`

### Performance
- **Batched queries** — leave listings resolve employees + balances in 3
  queries total (previously 2 queries *per* leave row)
- **Parallel reads** — dashboard metrics fetched with a single `Promise.all`
- **Lean + select** — list endpoints return only rendered fields
- **Compound indexes** — `Leave(status, createdAt)`, `Employee(department, status)`,
  `ActivityLog(createdAt)`
- **SWR client cache** — every page renders instantly from cache on revisit and
  revalidates in the background; mutations update the cache optimistically
- **Bulk writes** — auto check-out uses one `bulkWrite` instead of per-record updates

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Database | MongoDB Atlas + Mongoose |
| Auth | NextAuth v4 (JWT) |
| UI | Tailwind CSS v4 |
| Data fetching | SWR (stale-while-revalidate cache) |
| Media | Cloudinary |
| Email | Resend |
| Hosting | Vercel (+ Cron) |

---

## Project structure (high level)

```
app/
  (admin)/admin/        # Admin UI pages (dashboard, employees, leaves, ...)
  (employee)/employee/  # Employee UI pages (+ department/* for heads)
  api/
    admin/              # Admin-only REST handlers
    employee/           # Employee self-service handlers
    head/               # Department-head scoped handlers
    auth/, settings/    # Auth + shared settings
  components/
    admin/              # Admin feature components
    employee/           # Employee feature components
    ui/                 # Shared primitives (FilterSelect, ...)
lib/                    # Service layer + infrastructure
  api-client.ts         # Shared SWR fetcher (typed errors)
  attendance-service.ts # Attendance business logic (admin + head)
  leave-service.ts      # Leave business logic (admin + head)
  department-head.ts    # Head authorization + scoping helpers
  auth.ts, mongodb.ts, cloudinary.ts, email/
modals/                 # Mongoose models (indexes defined here)
scripts/                # seed-admin, db:test, test:email
proxy.ts                # Page-level route protection
vercel.json             # Cron schedules
```

---

## Quick start

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Fill values from `.env.example`. Minimum for local run:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Atlas connection string |
| `NEXTAUTH_SECRET` | JWT signing (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `http://localhost:3000` locally |
| `CRON_SECRET` | Protects cron endpoints |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Emails |
| `CLOUDINARY_*` or `CLOUDINARY_URL` | Profile photos |

### 3. Seed first admin

```bash
# In .env (temporary):
# SEED_ADMIN_EMAIL=admin@syncup.com
# SEED_ADMIN_PASSWORD=YourSecurePassword

npm run seed:admin

# Then remove SEED_ADMIN_PASSWORD from .env
```

### 4. Run

```bash
npm run db:test    # optional: verify MongoDB
npm run dev        # http://localhost:3000
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run db:test` | Test MongoDB connection |
| `npm run seed:admin` | Create / update admin user |
| `npm run test:email` | Send a Resend test email |

```bash
TEST_EMAIL=you@gmail.com npm run test:email
```

---

## Deploy on Vercel

```mermaid
sequenceDiagram
  participant Dev as Developer
  participant GH as GitHub
  participant V as Vercel
  participant M as MongoDB Atlas
  participant R as Resend / Cloudinary

  Dev->>GH: Push main
  V->>GH: Import / redeploy
  Dev->>V: Set env vars
  Dev->>M: Network Access 0.0.0.0/0 + backups
  V->>M: App queries
  V->>R: Photos + emails
  V->>V: Cron with CRON_SECRET
```

### Steps

1. Push this repo to GitHub and import it in Vercel.
2. Set **all** production env vars (see table above).  
   - `NEXTAUTH_URL` = your live URL, e.g. `https://hr.yourdomain.com`
3. MongoDB Atlas → **Network Access** → allow Vercel (`0.0.0.0/0` is fine for serverless). Enable backups.
4. Deploy. Seed admin once against the production database (`npm run seed:admin` locally with prod `MONGODB_URI`).
5. Confirm crons in Vercel → **Crons**:
   - Birthdays: `/api/cron/birthdays` — `0 19 * * *` (19:00 UTC = 00:00 PKT)
   - Review sync (internship/probation end → Due Review): `/api/cron/check-reviews` — `0 19 * * *` (19:00 UTC = 00:00 PKT)
   - Leave reset (year rollover): `/api/cron/leave-reset` — `0 19 * * *` (19:00 UTC = 00:00 PKT, checks Asia/Karachi year daily)
   - Auto check-out: `/api/cron/employee-attendance` — runs once daily at `0 15 * * *` UTC (**8:00 PM Asia/Karachi**). If the admin Auto Check-Out option is enabled, it closes still-open, unlocked, non-future attendance records and stamps checkout at the configured shift end. If disabled, no records are changed.

All cron routes **require** `CRON_SECRET`. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.

> Vercel cron schedules use UTC. The auto-checkout job is intentionally a single daily run; Vercel delivery can have platform timing variance.

---

## Attendance model (important)

```mermaid
flowchart TD
  CI[Employee check-in] --> REC[(Attendance day record)]
  CO[Employee check-out] --> REC
  CRON[Daily auto-checkout<br/>PKT 20:00] -->|if autoCheckOut enabled| REC
  ADMIN[Admin manual / retro edit] --> REC
  REC --> MONTH[(MonthlyAttendance aggregates)]
  LOCK[Month lock] --> MONTH
```

- Timezone: **Asia/Karachi**
- Auto check-out is controlled only by the `autoCheckOut` setting and runs at 8:00 PM Asia/Karachi.
- Locked months are **not** reopened by sync / cron
- When auto check-out is **off**, forgotten open shifts stay open for admin correction (no silent corruption)

> Biometric fingerprint machines are **not** integrated yet. Admin “Refresh Attendance” only reloads data from MongoDB.

---

## Security notes

- Never commit `.env` (ignored via `.gitignore`; only `.env.example` is tracked)
- Rotate secrets if they were ever pushed historically
- Keep `CRON_SECRET` set in production — cron routes reject requests without it
- Employees can only access their own payslips / leave / attendance
- Profile photo upload goes through an authenticated API (API secret stays server-side)

---

## Production smoke checklist

After deploy:

- [ ] Admin login
- [ ] Employee login
- [ ] Create employee → welcome email received
- [ ] Forgot password → reset link uses production `NEXTAUTH_URL`
- [ ] Profile photo upload
- [ ] Check-in / check-out
- [ ] Create payslip + PDF download
- [ ] Leave request + admin approval
- [ ] Cron endpoints return `401` without secret (expected)

---

## License

Private / proprietary — all rights reserved unless otherwise stated by the repository owner.
