# UCA Sandbox

UCA Sandbox is the digital academy platform through which the academy operates its
students, courses, applications, enrollments, billing and (eventually) student workspaces.

It has two sides:

- **Student Portal** — apply, enroll, learn, build, submit, progress.
- **Admin Portal** — review applications, manage students, monitor operations.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with a theme-aware design system (Poppins, UCA brand colors, light + dark mode)
- **Prisma 6** ORM on **PostgreSQL** — Supabase-compatible (pooled runtime connection + direct migration connection)
- **bcryptjs** password hashing, database-backed sessions (httpOnly cookies)
- **zod** server-side input validation

## Getting started (local)

You need a PostgreSQL database. The easiest local option is Docker:

```bash
docker compose up -d        # starts Postgres 16 on localhost:5432
npm install
cp .env.example .env        # the defaults already point at the Docker database
npm run db:migrate          # create the database schema
npm run db:seed             # seed the 6 academy courses + founder account
npm run dev
```

You can also use a free Supabase project for local development — set
`DATABASE_URL` and `DIRECT_URL` in `.env` as described below.

## Deploying to Vercel + Supabase

### 1. Create the database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (free tier works).
2. In **Project Settings → Database → Connection string**, copy:
   - **Transaction pooler** (port `6543`) → use for `DATABASE_URL`
   - **Session/Direct** (port `5432`) → use for `DIRECT_URL`
3. `.env.example` shows the exact formats. Append
   `?pgbouncer=true&connection_limit=1` to the pooled URL.

### 2. Deploy to Vercel

1. Import the GitHub repository in Vercel. The framework is auto-detected.
2. Add environment variables (**Settings → Environment Variables**):

   | Name              | Value                                          |
   | ----------------- | ---------------------------------------------- |
   | `DATABASE_URL`    | Supabase pooled connection string (port 6543)  |
   | `DIRECT_URL`      | Supabase direct connection string (port 5432)  |
   | `SESSION_SECRET`  | A long random string                           |

3. Deploy. The `vercel-build` script runs
   `prisma generate && prisma migrate deploy && next build`, so the schema is
   created/updated automatically on every deploy.

### 3. Seed the academy (once)

Run this locally with the production env vars loaded (`vercel env pull`), or from
any machine that can reach the database:

```bash
SEED_ADMIN_EMAIL=you@academy.com SEED_ADMIN_PASSWORD='a-strong-password' npm run db:seed
```

This creates the six courses and your founder account.

### How the backend fits together

- **Server-rendered pages + route handlers** (`src/app/api/**`) talk to Postgres
  through a single Prisma client (`src/lib/db.ts`) — safe for serverless because
  the client is cached on `globalThis` across invocations.
- **Authentication** is database-backed sessions in httpOnly cookies; every
  sensitive page/API re-checks the session and role server-side.
- **Authorization** lives in `src/lib/rbac.ts`; the enrollment business rules
  live in `src/lib/enrollment.ts` as a single transaction.
- Email verification / password-reset links are currently written to the server
  log (visible in Vercel function logs). Plug an email provider (Resend, Postmark,
  Supabase SMTP) into `src/lib/auth.ts` when ready.
- The pooled Supabase connection is used at runtime; Prisma Migrate uses the
  direct connection automatically via `directUrl`.

The seed creates founder account(s):

- Default: `admin@ucasandbox.com` / `ChangeMe123!`
- Override with `SEED_ADMIN_EMAILS` (comma-separated) and `SEED_ADMIN_PASSWORD`

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
