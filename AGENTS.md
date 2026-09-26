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
- Email: SendByte (`SENDBYTE_API_KEY`, `EMAIL_FROM`), NOT Resend. `EMAIL_FROM`'s domain must be verified in the SendByte dashboard. Templates in `src/lib/email-templates.ts`; brand colours are duplicated there because email clients strip CSS variables. The logo is a WHITE PNG — keep it on the purple band, never a light background.
- `NEXT_PUBLIC_APP_URL` must be set or token links and the email logo point at the wrong host.
- Waiting-list accounts (imported 2026-09-20, ~655) are identified by `WAITING_LIST_ONLY` in `/admin/students`: no username + no onboarding + no application. They hold no known password, so access is only via "forgot password" or a welcome invite.
- Waiting-list invites: `/admin/students` → "Send next 25 invites" (batches of 25, `welcomeEmailSentAt` stamped before send so retries can't duplicate).
- Bulk emails: `scripts/send-notice.ts`, dry-run unless `--apply`; `--limit=N` caps a run, `--to=` targets one address, `--resend` includes already-sent. Progress columns (`welcomeEmailSentAt`, `noticeEmailSentAt`) are stamped BEFORE sending, so a rerun resumes and can never double-send. Sent 2026-09-20: 656 invites + 683 notices.
- Reclaim sends (both dry-run unless `--apply`, both stamp progress BEFORE sending so a rerun resumes and can never double-send):
  - `scripts/send-reclaim.ts` — the first "your account is back" email. Progress `welcomeEmailSentAt`. Sent 2026-09-26: 676.
  - `scripts/send-reclaim-nudge.ts` — the "four clicks away" follow-up, to NOT_SIGNED_UP only. Progress `reclaimNudgeEmailSentAt` (separate column, so this nudge resumes independently of the first send). Honours `emailOptOutAt`. Sent 2026-09-26: 649, 8 suppressed bounces left.
  - `--test --to=` deliberately ignores the audience filters so a test can go to a signed-up inbox; it does not stamp, so the bulk run still reaches that address.
  - Both scripts mint a `PASSWORD_RESET` token per recipient, so the link is unique per person. **The campaign tool cannot do this** — `campaign-sender.ts` substitutes only the unsubscribe tag, so any per-recipient-link email must go through a script, not `/admin/campaigns`.
- Signup funnel (checked 2026-09-26): 684 active students, 27 signed up, 657 not, 1 signed up with no course, 25/100 Elite places used. The `SIGNED_UP_NO_COURSE` audience is nearly always empty early on because anyone who onboards also applies in the same sitting.
- Onboarding-week announcement: `scripts/send-onboarding-week.ts` (two copies — waiting-list vs already-signed-up), preview with `scripts/preview-onboarding-week.ts`. `--test --to=` sends without stamping so the bulk run still reaches that address. Progress columns `onboardingWeekEmailSentAt` / `onboardingWeekSignedUpEmailSentAt`. Sent 2026-09-21: 601 + 82 = 683.
- Email campaigns (Mailchimp-style) live at `/admin/campaigns`: composer with live preview, 5 built-in styles, image uploads, saved templates, audience targeting (all / signed-up / waiting list / course / pathway), send-now, schedule, and delete. Per-recipient rows are claimed `FOR UPDATE SKIP LOCKED` and marked `SENDING` before the provider call, so a crash skips someone but never double-sends. Bulk mail honours `User.emailOptOutAt`; transactional mail does not. Campaign images are served publicly at `/api/public/email-assets/[id]`, which only exposes images referenced by a campaign (or to staff, so the composer can preview).
- Campaign scheduling runs from the DATABASE, not Vercel: `pg_cron` + `pg_net` are enabled and the `uca-campaign-worker` job (every 5 min) calls `public.trigger_campaign_worker()` → `POST /api/cron/campaigns`. Vercel Hobby rejects any cron more frequent than daily, which is why `vercel.json` only carries a once-daily backstop. The app URL and bearer token live in Supabase Vault (`uca_app_url`, `uca_cron_secret`) — never in `cron.job` command text. To rotate: update the Vercel `CRON_SECRET` and the Vault `uca_cron_secret` together.
- `runCampaign` sends on a wall-clock budget (`TIME_BUDGET_MS`, 45s for cron, `INTERACTIVE_BUDGET_MS` 20s for a UI click), not a batch count. It claims 25 at a time, sends with concurrency 15, bulk-writes outcomes, and leaves unfinished rows PENDING so the next run resumes. A campaign whose run throws stays `SENDING` (resumable) rather than `FAILED`. The admin "Send now" loops the `DRAIN` action to finish a send without waiting for a cron tick; "Resume send" does the same for an interrupted campaign.
- Admin notifications: `/admin/notifications` lists portal notifications and deletes them — single (`DELETE /api/admin/notifications/[id]`) or filtered bulk (`DELETE /api/admin/notifications`), which refuses a filterless request so it can't wipe the table.
- Follows are one-directional (`Follow` model). `/student/creators` has Discover / Following / Followers tabs; the button reads "Follow back" when the other student follows you (`isFollowedBy` on `CreatorCard`). Helpers live in `src/lib/creators.ts` (`searchCreators`, `getFollowedCreators`, `getFollowers`); the shared tile is `src/components/creators/creator-card.tsx`.
- Unread notifications show as a nav badge: the student layout counts `readAt: null` and passes `badges={{ "/student/notifications": n }}` to `PortalShell`.
- Theme toggle is icon-only (sun / moon / monitor stroke SVGs from `icons.tsx`) — never text labels.
- PWA: `src/app/manifest.ts` (installable, `display: fullscreen` + `display_override` fallback chain so the installed app has no status bar; iOS has no true fullscreen and keeps a translucent bar), `public/sw.js`, icons + splash screens generated by `scripts/generate-pwa-icons.ts` into `public/icons/` and `public/splash/`, `src/app/offline/page.tsx`. Splash sizes/ratios are shared data in `src/lib/pwa.ts` (pure data — no `sharp` import — so the layout can build the iOS `startupImage` list). The SW precaches an offline shell, serves static assets cache-first and navigations network-first with the offline page as fallback, and never caches `/api/`.
- Installed-app detection is `src/lib/display-mode.ts` (`isInstalledApp`), mirrored by the layout's pre-paint `installedInit` script which adds `.pwa-installed` to `<html>`. The launch splash, the refresh preloader and the fullscreen safe-area padding are all scoped to that class, so the normal website shows none of them and needs no notch padding. Keep the inline script and the helper in sync.
- Client islands in `src/components/pwa/`: `PwaProvider` (SW registration), `AppSplash` (branded launch splash, installed app only, once per session via `uca-splash-shown`), `AppPreloader` (brand-purple refresh spinner, installed app only, gated on `.pwa-installed.splash-skip` so it never competes with the splash), `NotificationSound` (plays `/sounds/notification.wav` when a push lands in a focused window, and mirrors unread count onto the app badge), `InstallBanner` (once per visit; iOS gets Share → Add to Home Screen guidance), `PushSubscribe`.
- Fullscreen safe areas: `.pwa-installed` rules in `globals.css` add `env(safe-area-inset-*)` to `.app-shell-header` / `.app-shell-nav` / `.app-shell-main` (phone) and `.app-shell-main` / `.app-shell-sidebar` (tablet). Those class hooks live on `PortalShell`.
- To regenerate PWA art after a logo change: `npx tsx scripts/generate-pwa-icons.ts` (runs `sharp`; produces icons + 12 iOS startup images). Notification chime: `npx tsx scripts/generate-notification-sound.ts`. Bump `SW_VERSION` in `public/sw.js` to invalidate caches on a deploy that changes precached assets.
- Push sound: browsers ignore the `sound` option on system notifications (no browser supports it), so backgrounded pushes rely on the OS default tone — `public/sw.js` sets `silent: false` and a `vibrate` pattern for that case. When a window is focused/visible the SW instead posts `{type:"uca-push"}` to the client, marks the notification `silent: true`, and `NotificationSound` plays the branded chime, so the two never sound at once. Audio needs a user gesture first; `NotificationSound` unlocks it on the first pointer/key event.
- Web push: `web-push` + VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; generate with `npx web-push generate-vapid-keys`). Delivery in `src/lib/push.ts` (`sendPushToUsers`, `pushToUser`); it prunes 404/410 subscriptions and no-ops when VAPID is unset. Subscriptions live in `PushSubscription` (one row per device endpoint); device registration is `POST/DELETE /api/student/push/subscribe` (caller-scoped). `notify()` also pushes for `PUSH_TYPES` (enrollment decisions, grades, feedback, announcements, payments, course completed) — social events like new followers stay in-app to avoid spamming devices.
- Admin push: `/admin/push` + `POST /api/admin/push` (modes `AUDIENCE` → count of subscribed devices, `SEND` → fan out; optional `alsoInApp`). Persisted in `PushCampaign`. Email and push share the same audience rules (`campaign-sender.ts`).
- Campaign audiences now include `ELECTIVE` ("on an elective course") and `SIGNED_UP_NO_COURSE` ("signed up, no course") alongside Everyone / Signed up / Waiting list / By course / By pathway. Email resolution honours `emailOptOutAt`; push resolution (`resolveAudienceForPush`) does not, since push is consent-by-subscription.
- Email templates: transactional shells in `src/lib/email-templates.ts`; campaign rendering in `src/lib/email-campaigns.ts` + `src/lib/campaign-content.ts`; sender/audience logic in `src/lib/campaign-sender.ts`.
- Auth form gotcha: `AuthForm` renders hidden fields only when the field gets an explicit `value`. A hidden token with no value fails silently as "link invalid or expired" — check the rendered input, not the server.

- Peer Body: rounds live in `PeerBodyRound` (course- or pathway-scoped, `REVIEWING`/`CLOSED`), work in `PeerBodySubmission` (one per student per round, upsert on `(roundId, authorId)`), feedback in `PeerBodyReview` (three kindness-forward fields; unique `(submissionId, reviewerId)`, author denormalised as `authorId`). Logic in `src/lib/peer-body.ts`; student UI at `/student/peer-body[/id]`, staff at `/admin/peer-body`. Reviews fire a `PEER_BODY_REVIEW` notification (in-app + push + email).
- Studio Wall (route `/student/warm-up`, nav label "Studio Wall"): the pre-class declaration. One card per student in `Promise` (unique `userId`): `body` is the promise ("the brand I'd love to design is…") and `ambition` is the deliverable ("by the end of term I'll have made…"), plus a picked `goal` (keys in `PROMISE_GOALS`) and a `pathway` craft derived server-side from their elective (never from the client). Peers cheer with `PromiseCheer` (unique `promiseId`+`userId`). Logic in `src/lib/promises.ts`; UI at `/student/warm-up`; API at `/api/student/promises` and `/api/student/promises/[id]/cheer`. Writing closes end of 3 Oct (`PROMISE_WALL_CLOSES`); cards stay readable after. `CLASSES_START` is 5 Oct. Per-craft copy lives in `STUDIO_CRAFT` (craft, medium, deliverable suggestions, ethos) and `STUDIO_BRIEF` (the two prompts); `PATHWAY_TO_SLUG` draws the right course mark. `StudioStandings` ranks the four crafts — fair because every craft has the same cohort size. Deliberately no points, streaks or global leaderboard.
- Elite badge is a tiny gold UCA crest PNG (`public/icons/elite-crest-gold.png`, generated by tinting `uca-logo.png`), not a drawn shape — a purple gem vanished against the purple hero band. Rank is carried in the title/aria-label, not drawn. `EliteBadge` takes `size="sm" | "lg"`.
- PWA app chrome, installed app only (all scoped to `.pwa-installed` in globals.css): `AppStatusBar` (purple band with mark, name and a live clock — the manifest is `fullscreen`, so the app owns that space) and `MobileTabBar` (fixed bottom bar of 5 primary tabs + a "More" sheet for the rest). The browser keeps the header strip and scrolling nav; `.pwa-installed` hides those and shows the tabs. Tab sets live in `portal-shell.tsx` (`MOBILE_TABS` / `ADMIN_TABS`), keyed off the portal name.
- Full-screen PWA gotcha: `min-h-screen`/`100vh` is a *viewport* unit, so in a `fullscreen` launch it excludes the area behind the OS insets and the shell stops short, leaving a band top and bottom. The shell must be `100dvh`, and the `html` element needs `background-color` — only `body` was set, so anything the body box didn't cover fell through to the browser default (black in a standalone launch). `.app-shell-body` carries `margin-top: calc(2rem + env(safe-area-inset-top))` to clear the fixed status bar. Bump `SW_VERSION` in `public/sw.js` when changing app-shell CSS, or installed clients keep the cached stylesheet.
- Reclaim perks: `ReclaimPerks` (`src/components/onboarding/reclaim-perks.tsx`) shows returning creators what they get before they finish setup — free month, Elite status (with live places left from `elitePlacesRemaining`), pathway start, and the 5 Oct class date. Shown on onboarding steps 1 (password) and 4 (pathway). Plain list, no points or urgency tricks.
- Follows/followers, theme SVG icons, PWA (manifest `src/app/manifest.ts`, `public/sw.js`, install banner, push subscribe), and the email/push audience categories (`ALL_STUDENTS` / `SIGNED_UP` / `SIGNED_UP_NO_COURSE` / `ELECTIVE` / `NOT_SIGNED_UP` / `COURSE` / `PATHWAY` in `src/lib/campaign-sender.ts`) are already built — don't rebuild them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
