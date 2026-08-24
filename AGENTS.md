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

## Design system
- `src/components/icons.tsx` — custom stroke SVG icon set (35 icons); never add emoji or generic icons
- `src/components/crest.tsx` — `Crest` (UCA shield mark), `BrandLockup`, `CrestBackground` (watermark)
- `src/components/course-mark.tsx` — brand-gradient course tile; icons mapped by course slug
- `src/components/ui/progress-ring.tsx` — SVG progress ring
- `.eyebrow` (uppercase editorial label) and `.hero-band` (deep purple gradient hero) in globals.css
- Editorial pattern: eyebrow + numbered sections ("01 — Your Academy Program")
- Workspace is a distinct product area: dark surface, grid texture, mono terminal accent
- Milestones computed from real data in `src/lib/milestones.ts` — never fabricate

## Performance
- Supabase pooler round-trip from outside eu-west-1 is ~500ms+ per query — batch queries with Promise.all, never query in loops
- `getSessionUser` is React `cache()`-deduped per request (layout + page share one lookup)
- DATABASE_URL carries `connection_limit=8`; below 4, parallel query batches serialize into multi-second stalls
- `vercel.json` pins functions to `dub1` (same region as Supabase eu-west-1) — production latency is far lower than this sandbox
- Keep `globalForPrisma.prisma = db` unconditional (singleton in prod too)

## Conventions

- Roles/statuses are string enums in `src/lib/constants.ts` (kept as String columns for portability).
- Theme: class-based dark mode, tokens in `src/app/globals.css` (@theme), Poppins via next/font.
- UI primitives in `src/components/ui/` — reuse them; both themes always.
- Friendly client errors; technical details only in server logs.
- Dev email links (verify/reset) are console.logged server-side until an email provider is added.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
