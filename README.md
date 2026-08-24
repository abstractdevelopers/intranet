# UCA Sandbox

UCA Sandbox is the digital academy platform through which the academy operates its
students, courses, applications, enrollments, billing and (eventually) student workspaces.

It has two sides:

- **Student Portal** — apply, enroll, learn, build, submit, progress.
- **Admin Portal** — review applications, manage students, monitor operations.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with a theme-aware design system (Poppins, UCA brand colors, light + dark mode)
- **Prisma 6** ORM — SQLite locally, swap `provider` + `DATABASE_URL` for Postgres in production
- **bcryptjs** password hashing, database-backed sessions (httpOnly cookies)
- **zod** server-side input validation

## Getting started

```bash
npm install
cp .env.example .env        # then edit values
npm run db:migrate          # create the database schema
npm run db:seed             # seed the 6 academy courses + founder account
npm run dev
```

The seed creates a founder account:

- Email: `admin@ucasandbox.com`
- Password: `ChangeMe123!` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)

In development, email verification and password-reset links are printed to the
server log (email delivery plugs in later).

## Core business rules (enforced server-side)

1. Every student gets **Personal Branding + Social Media** — auto-included, auto-approved.
2. Every student selects **exactly one elective** (Video Editing, Graphics Design,
   Communication / Influence, Content Writing) — it starts as **PENDING**.
3. Only staff (Founder / Super Admin / Academy Admin) can approve or reject an elective.
4. Pending and rejected electives are inaccessible.
5. **First month is free**; trial dates are calculated dynamically at enrollment.
6. Every course costs **₦15,000/month** after the free month — pricing comes from the
   database, stored as per-course **subscription items** (never a hardcoded total).
7. All authorization is enforced on the server; the middleware is only a routing gate.

## Structure

```
prisma/
  schema.prisma        # full relational data model
  seed.ts              # courses + founder account
src/
  middleware.ts        # edge routing gate (cookie presence only)
  lib/
    auth.ts            # sessions, password hashing, email tokens
    rbac.ts            # role guards (requireStudent / requireStaff / ...)
    enrollment.ts      # application + enrollment transaction (core rules)
    progress.ts        # real progress calculation
    audit.ts           # audit logs + notifications
    constants.ts       # roles, statuses, pricing constants
  components/ui/       # design system (Button, Card, Input, Badge, Progress, EmptyState)
  app/
    page.tsx           # landing page (program + transparent pricing)
    login|signup|verify-email|forgot-password|reset-password/
    student/           # dashboard, apply, courses, assignments, progress,
                       # calendar, notifications, workspace, profile
    admin/             # dashboard, students, applications review, enrollments,
                       # courses, submissions, audit logs, ...
    api/               # auth + application + admin review route handlers
```

## Theming

Light, dark and system themes are supported everywhere. The preference is persisted
in `localStorage` (`uca-theme`) and applied before hydration to avoid flashing.

Brand tokens (in `src/app/globals.css`):

| Token     | Value     | Use                         |
| --------- | --------- | --------------------------- |
| `brand-1` | `#570E83` | primary actions, active nav |
| `brand-2` | `#410B61` | hovers, deep accents        |
| `brand-3` | `#E6A9FF` | highlights (esp. dark mode) |
| `ink`     | `#0D070B` | dark-mode background, text  |

## Roadmap

Phased per the product specification: learning content (modules, lessons, YouTube,
protected PDF viewer) → assignments & grading → academy operations → billing provider
→ UCA Workspace provisioning. The schema already includes the tables for all of these.
