import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { StudentInviteForm } from "@/components/admin/student-invite-form";
import { WelcomeBatchPanel } from "@/components/admin/welcome-batch-panel";
import { VerificationBadge } from "@/components/verification-badge";
import { formatDate } from "@/lib/format";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Students" };

const PER_PAGE = 50;

/**
 * Accounts imported from the waiting list hold no username, have finished no
 * onboarding and carry no application. An applicant passes through that same
 * state, so "dormant" is defined by all three at once — once someone applies
 * they gain an application, and once they onboard they gain a username, so
 * they leave this set automatically.
 */
const WAITING_LIST_ONLY: Prisma.UserWhereInput = {
  username: null,
  onboardingCompletedAt: null,
  applications: { none: {} },
  enrollments: { none: {} },
};

const SIGNED_UP: Prisma.UserWhereInput = {
  OR: [
    { username: { not: null } },
    { onboardingCompletedAt: { not: null } },
    { applications: { some: {} } },
  ],
};

type Tab = "all" | "signedup" | "waiting";

const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  signedup: "Signed up",
  waiting: "Waiting list",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const tab: Tab = params.tab === "signedup" || params.tab === "waiting" ? params.tab : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const searchFilter: Prisma.UserWhereInput = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { username: { contains: query, mode: "insensitive" } },
          { profile: { fullName: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  const tabFilter: Prisma.UserWhereInput =
    tab === "waiting" ? WAITING_LIST_ONLY : tab === "signedup" ? SIGNED_UP : {};

  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    AND: [tabFilter, searchFilter],
  };

  // Counts are scoped to the search so the tabs reflect what staff are viewing.
  const [students, filteredTotal, allCount, signedUpCount, waitingCount] = await Promise.all([
    db.user.findMany({
      where,
      include: { profile: true, enrollments: { include: { course: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.user.count({ where }),
    db.user.count({ where: { role: "STUDENT", AND: [{}, searchFilter] } }),
    db.user.count({ where: { role: "STUDENT", AND: [SIGNED_UP, searchFilter] } }),
    db.user.count({ where: { role: "STUDENT", AND: [WAITING_LIST_ONLY, searchFilter] } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PER_PAGE));
  const counts: Record<Tab, number> = {
    all: allCount,
    signedup: signedUpCount,
    waiting: waitingCount,
  };

  const tabHref = (t: Tab, p = 1) => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (t !== "all") sp.set("tab", t);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/students${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Students</h1>

      {/* Create accounts and hand over a temporary password (#1) */}
      <section>
        <p className="eyebrow">Add a student</p>
        <Card className="mt-3 p-6">
          <StudentInviteForm />
        </Card>
      </section>

      {/* Invite waiting-list accounts to claim their access */}
      <section>
        <p className="eyebrow">Waiting list</p>
        <Card className="mt-3 p-6">
          <WelcomeBatchPanel waiting={waitingCount} />
        </Card>
      </section>

      <form method="get" className="flex flex-wrap items-center gap-3">
        {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name, username or email…"
          aria-label="Search students"
          className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:border-brand-1 focus:outline-2 focus:outline-brand-3"
        />
      </form>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Student filters">
        {(["all", "signedup", "waiting"] as Tab[]).map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            role="tab"
            aria-selected={tab === t}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "border-brand-1 bg-brand-1 text-white"
                : "border-border bg-surface text-text-muted hover:border-brand-1/40 hover:text-text"
            }`}
          >
            {TAB_LABELS[t]} <span className="opacity-70">{counts[t]}</span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        {query ? (
          <>
            {filteredTotal} {filteredTotal === 1 ? "result" : "results"} for “{query}”
          </>
        ) : (
          <>
            Showing {students.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–
            {(page - 1) * PER_PAGE + students.length} of {filteredTotal}
          </>
        )}
      </p>

      <div className="space-y-3">
        {students.length === 0 ? (
          <EmptyState
            title="No students found"
            body={
              query
                ? "Try a different search."
                : tab === "waiting"
                  ? "Nobody is waiting on an unclaimed account."
                  : "Students will appear here once they sign up."
            }
          />
        ) : (
          students.map((student) => {
            // Imported waiting-list accounts have no username yet. Show invite
            // state rather than a second "incomplete" badge — that's what staff
            // need to act on.
            const claimed = Boolean(student.username) || student.onboardingCompletedAt !== null;
            return (
              <Link key={student.id} href={`/admin/students/${student.id}`} className="block">
                <Card className="p-4 transition-colors hover:border-brand-1/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1 text-sm font-semibold">
                        <span>{student.profile?.fullName || "—"}</span>
                        <VerificationBadge tier={student.verificationTier} />
                        {student.username ? (
                          <span className="ml-1 font-normal text-text-muted">@{student.username}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-text-muted">
                        {student.email} · Joined {formatDate(student.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!claimed ? (
                        student.welcomeEmailSentAt ? (
                          <Badge tone="neutral">invited</Badge>
                        ) : (
                          <Badge tone="brand">not invited</Badge>
                        )
                      ) : null}
                      {student.mustChangePassword ? (
                        <Badge tone="warning">password change pending</Badge>
                      ) : null}
                      <Badge tone={statusTone(student.status)}>{student.status.toLowerCase()}</Badge>
                    </div>
                  </div>
                  {student.enrollments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {student.enrollments.map((e) => (
                        <Badge key={e.id} tone={statusTone(e.status)}>
                          {e.course.name}: {e.status.toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={tabHref(tab, page - 1)}
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:border-brand-1/40"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={tabHref(tab, page + 1)}
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:border-brand-1/40"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}