# UCA Sandbox — agent notes

## Product

UCA Sandbox (not "UCS") — a digital academy platform. Two portals: Student and Admin.
Never rename it to "LMS" / "Academy Portal" as the product identity.

## Commands

- `npm run dev` — dev server
- `npm run build` / `npm start` — production
- `docker compose up -d` — local Postgres 16
- `npm run db:migrate` — prisma migrate dev
- `npm run db:seed` — seed 6 courses + founders. Use `SEED_ADMIN_EMAILS` (comma-separated) + `SEED_ADMIN_PASSWORD`
- Role management: FOUNDER/SUPER_ADMIN only, at /admin/settings (`canManageRoles` in rbac.ts, API at /api/admin/users/[id]/role). Role changes revoke sessions and are audit-logged.
- `npm run db:deploy` — prisma migrate deploy (production)
- Prisma 6 is pinned intentionally (Prisma 7 changed datasource config; do not upgrade casually)
- Database is PostgreSQL (Supabase-compatible): DATABASE_URL = pooled runtime, DIRECT_URL = migrations

## Non-negotiable business rules (enforced in src/lib/enrollment.ts)

- Compulsory: Personal Branding + Social Media → auto-ACCEPTED on application submit.
- Exactly one elective → PENDING until staff approve; rejected stays inaccessible.
- First month free (TRIAL_DAYS=30, computed at enrollment); then ₦15,000/course/month.
- Prices live in the DB; subscription items are per-course. Never hardcode ₦45,000.
- Server-side authorization everywhere; middleware is routing-only.

## Conventions

- Roles/statuses are string enums in `src/lib/constants.ts` (kept as String columns for portability).
- Theme: class-based dark mode, tokens in `src/app/globals.css` (@theme), Poppins via next/font.
- UI primitives in `src/components/ui/` — reuse them; both themes always.
- Friendly client errors; technical details only in server logs.
- Dev email links (verify/reset) are console.logged server-side until an email provider is added.
