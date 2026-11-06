# StableNet Training Feedback — server

NestJS 12 + Prisma 7 + PostgreSQL API for the feedback form, certificates and admin dashboard.

## Setup

```bash
cp .env.example .env          # set DATABASE_URL (and seed admin details)
npm install                   # also generates the Prisma client
npm run db:migrate            # create/update the database schema
npm run db:seed               # create the admin account
npm run start:dev             # http://localhost:4000/api
```

### Admin seed

`npm run db:seed` creates the admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME` /
`SEED_ADMIN_PASSWORD`. Leave the password empty to have a strong one generated and printed
once. Re-running never overwrites an existing admin unless `SEED_ADMIN_RESET_PASSWORD=true`
(which also signs out its sessions). Admins can change their password on the Account page.

## API (`/api`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Liveness + database check |
| GET | `/form-config` | public | Questions, sections, OpCos (the form is rendered from this) |
| POST | `/responses` | public, 20/h/IP | Submit feedback → issues certificate ID + verification code |
| GET | `/certificate-settings` | public | Trainer name, training date range, signature for drawing certificates |
| POST | `/certificates/:certId/downloads` | public, 30/h/IP | Log a participant download |
| POST | `/auth/login` | public, 10/15 min/IP | Sign in (sets session cookie) |
| POST | `/auth/logout` | public | Sign out |
| GET | `/auth/me` | admin | Current user |
| PATCH | `/auth/password` | admin | Change password (signs out other sessions) |
| GET | `/admin/dashboard` | admin | Totals, daily series, OpCo split, per-question distributions |
| GET | `/admin/responses` | admin | Paginated list: `page, pageSize, sortField, sortOrder, search, opco[], consent, status` |
| GET | `/admin/responses/export.csv` | admin | CSV export (same filters) |
| GET | `/admin/responses/verify?q=` | admin | Look up by certificate ID or verification code |
| GET / DELETE | `/admin/responses/:certId` | admin | Detail (with download history) / delete |
| POST | `/admin/responses/:certId/downloads` | admin | Log an admin download |
| PUT | `/admin/certificate-settings` | admin | Update trainer name, start/end dates, signature |

## Security

- **Sessions**: random 256-bit token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` when
  `COOKIE_SECURE=true`); only its SHA-256 is stored. Fixed expiry (`SESSION_TTL_HOURS`).
- **Passwords**: scrypt (N=2¹⁵), constant-time comparison, timing-equalised for unknown emails.
- **Every route requires an admin** unless marked `@Public()` (global `SessionAuthGuard`).
- **CSRF**: state-changing requests must send `X-Requested-With: XMLHttpRequest`, on top of SameSite.
- **Validation**: DTOs with `whitelist` + `forbidNonWhitelisted`; answers checked against the form config.
- **Rate limiting** (`@nestjs/throttler`), `helmet` headers, CSV formula-injection escaping.

## Structure

```
prisma/            schema, migrations, seed
src/
├─ config/         env validation
├─ prisma/         PrismaService (pg driver adapter)
├─ common/         @Public, @CurrentUser, CSRF guard, Prisma error filter, CSV
├─ auth/           login/logout/me/password, sessions, password hashing, guard
├─ users/
├─ form-config/    the form's questions/OpCos (single source of truth)
├─ responses/      submit, list/detail/delete, verify, CSV, download log
├─ certificate-settings/
├─ dashboard/      aggregated stats
└─ health/
```
