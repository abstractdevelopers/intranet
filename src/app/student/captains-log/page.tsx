import Link from "next/link";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CaptainLogForm } from "@/components/captains-log/captain-log-form";
import { IconCheckCircle, IconAnnouncement, IconLock } from "@/components/icons";
import { CaptainLogAnswers } from "@/components/captains-log/captain-log-answers";
import { CAPTAIN_LOG_QUESTIONS } from "@/lib/constants";
import { getCaptainLogState } from "@/lib/captains-log";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Captain's Log" };

export default async function CaptainLogPage() {
  const user = await requireStudent();
  const state = await getCaptainLogState(user.id);
  const history = await db.captainLog.findMany({
    where: { userId: user.id },
    orderBy: { weekNumber: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="hero-band rounded-2xl p-6 md:p-8">
        <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
          Weekly reflection
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">Captain&rsquo;s Log</h1>
        <p className="hero-muted mt-2 max-w-xl text-sm">
          A mandatory weekly review. Complete it before the following week&rsquo;s courses
          become available.
        </p>
      </section>

      {state.currentWeek === null ? (
        <EmptyState
          title="Your log opens with your first week"
          body="Once your first week of content is released, your Captain's Log will appear here."
        />
      ) : (
        <>
          {state.blocking ? (
            <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <IconLock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-semibold">
                    Week {state.currentWeek + 1} is waiting on this log
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    Submit your Week {state.currentWeek} reflection and next week&rsquo;s
                    content unlocks automatically.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <IconCheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-semibold">
                  Week {state.currentWeek} log submitted — you&rsquo;re up to date.
                </p>
              </div>
            </Card>
          )}

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="eyebrow">Week {String(state.currentWeek).padStart(2, "0")}</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">
                  {state.log ? "Your reflection" : "Reflect on your week"}
                </h2>
              </div>
              {state.log ? (
                <span className="text-xs text-text-muted">
                  Submitted {formatDateTime(state.log.submittedAt)}
                </span>
              ) : null}
            </div>
            <Card className="mt-4 p-6">
              <CaptainLogForm
                weekNumber={state.currentWeek}
                questions={CAPTAIN_LOG_QUESTIONS.map((q) => ({ ...q }))}
                initial={state.log?.responses ?? {}}
                alreadySubmitted={Boolean(state.log)}
              />
            </Card>
          </section>

          <section>
            <p className="eyebrow">History</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Past logs</h2>
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <EmptyState title="No logs yet" body="Your submitted reflections will be listed here." />
              ) : (
                history.map((log) => (
                  <Card key={log.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <IconAnnouncement className="h-4.5 w-4.5 text-brand-1 dark:text-brand-3" />
                        <span className="text-sm font-semibold">Week {log.weekNumber}</span>
                        <Badge tone={log.status === "REVIEWED" ? "success" : "neutral"}>
                          {log.status.toLowerCase()}
                        </Badge>
                      </div>
                      <span className="text-xs text-text-muted">
                        {formatDateTime(log.submittedAt)}
                      </span>
                    </div>
                    {log.reviewNote ? (
                      <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-text-muted">
                        <span className="font-semibold">Academy note:</span> {log.reviewNote}
                      </p>
                    ) : null}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-brand-1 dark:text-brand-3">
                        View answers
                      </summary>
                      <CaptainLogAnswers responses={log.responses} />
                    </details>
                  </Card>
                ))
              )}
            </div>
          </section>
        </>
      )}

      <p className="text-xs text-text-muted">
        Your log is part of your permanent student record.{" "}
        <Link href="/student/progress" className="underline-offset-2 hover:underline">
          See your full progress
        </Link>
        .
      </p>
    </div>
  );
}
