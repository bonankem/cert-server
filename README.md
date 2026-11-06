# StableNet Training Feedback — server

NestJS 12 + Prisma 7 + PostgreSQL API for the feedback form, certificates and admin dashboard.

## Setup

```bash
cp .env.example .env          # set DATABASE_URL (and seed admin details)
npm install                   # also generates the Prisma client
npm run db:push               # sync the database with prisma/schema.prisma
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
| POST | `/responses` | public, 20/h/IP | Submit feedback. One response per email: new → **pending** (or approved instantly if on the participant list) with a private status token; repeat → replaces a pending/rejected one, or files an **update request** for an approved one (link emailed only) |
| GET | `/certificates/status/:token` | public, 120/h/IP | Participant status: pending / approved (with certificate) / rejected (with reason) |
| GET | `/certificate-settings` | public | Trainer name, training date range, signature for drawing certificates |
| POST | `/certificates/:certId/downloads` | public, 30/h/IP | Log a participant download (approved only) |
| POST | `/auth/login` | public, 10/15 min/IP | Sign in (sets session cookie) |
| POST | `/auth/logout` | public | Sign out |
| GET | `/auth/me` | admin | Current user |
| PATCH | `/auth/password` | admin | Change password (signs out other sessions) |
| GET | `/admin/dashboard` | admin | Totals, daily series, OpCo split, per-question distributions |
| GET | `/admin/responses` | admin | Paginated list: `page, pageSize, sortField, sortOrder, search, opco[], consent, status` |
| GET | `/admin/responses/export.csv` | admin | CSV export (same filters) |
| GET | `/admin/responses/verify?q=` | admin | Look up by certificate ID or verification code |
| GET / DELETE | `/admin/responses/:certId` | admin | Detail (with download history) / delete |
| POST | `/admin/responses/:certId/downloads` | admin | Log an admin download (approved only) |
| GET | `/admin/responses/pending-count` | admin | `{ pending, updates }` awaiting approval |
| POST | `/admin/responses/:certId/update/approve` | admin | Apply the pending update request (same certificate ID and code) |
| POST | `/admin/responses/:certId/update/reject` | admin | Reject the pending update request `{ reason? }` |
| POST | `/admin/responses/approve` | admin | Approve `{ certIds: [] }` (emails each participant) |
| POST | `/admin/responses/:certId/approve` | admin | Approve one |
| POST | `/admin/responses/:certId/reject` | admin | Reject or revoke `{ reason? }` (emails the participant) |
| GET / POST / DELETE | `/admin/roster` | admin | Participant list for auto-approval: list / add `{ entries: [{ name?, email? }] }` / clear |
| DELETE | `/admin/roster/:id` | admin | Remove one participant from the list |
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
prisma/            schema, seed
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

## Certificate approval

Submissions are **pending** until an admin approves them (or they match the participant list). Only approved
certificates are returned to participants, downloadable, or accepted by public verification. Participants get
emails (Amazon SES, `AWS_*` + `MAIL_FROM` env vars) on submit, approval and rejection, each linking to
`APP_URL/certificate/<token>`. Without AWS keys, emails are logged instead of sent.

One email address = one response = one certificate (`responses.email` is unique). A repeat submission
replaces a pending/rejected response, or creates a `ResponseUpdate` for an approved one that an admin must
approve before it changes the certificate. Admins listed in `ADMIN_NOTIFY_EMAILS` are emailed about new
submissions and update requests.
