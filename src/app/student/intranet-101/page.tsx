import { requireOnboardedStudent } from "@/lib/rbac";
import { getIntranet101 } from "@/lib/quiz";
import { Intranet101Quiz } from "@/components/lessons/intranet-101-quiz";
import { INTRANET_101_VIDEO_ID } from "@/lib/intranet-101";
import { notFound } from "next/navigation";

export const metadata = { title: "Intranet 101" };

/**
 * Intranet 101 — the compulsory academy-wide intro.
 *
 * Not attached to a course, so it sits outside the course/module/lesson tree and
 * every onboarded student can reach it directly.
 *
 * The video is embedded through youtube-nocookie with `rel=0` so the end screen
 * only offers videos from this channel rather than the wider YouTube grid, and
 * `modestbranding` to keep the YouTube chrome down. YouTube will not let a
 * third-party embed remove suggestions entirely.
 */
export default async function Intranet101Page() {
  const user = await requireOnboardedStudent();
  const quiz = await getIntranet101(user.id);
  if (!quiz) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-xl border border-border bg-surface p-6">
        <p className="eyebrow">Welcome to the academy</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Intranet 101</h1>
        <div className="mt-4 space-y-4 text-sm leading-7 text-text">
          <p>
            Before you begin your UCA journey, it&rsquo;s important to understand how to navigate
            the intranet and make the most of everything available to you.
          </p>
          <p>
            In this lesson, you&rsquo;ll get a complete walkthrough of the intranet — from your
            dashboard and its different buttons to your courses, assignments, profile, progress,
            and everything else you&rsquo;ll need to know.
          </p>
          <p className="font-medium text-text">Click the button below to watch the video.</p>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-border bg-ink">
        <div className="relative aspect-video">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${INTRANET_101_VIDEO_ID}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=1`}
            title="UCA Intranet 101 walkthrough"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>

      <p className="text-sm leading-7 text-text-muted">
        After watching, take the short assessment to confirm that you understood the lesson, then
        click Finish when you&rsquo;re done.
      </p>

      <Intranet101Quiz
        title={quiz.title}
        description={quiz.description}
        passMark={quiz.passMark}
        maxAttempts={quiz.maxAttempts}
        attemptsUsed={quiz.attemptsUsed}
        attemptsLeft={quiz.attemptsLeft}
        passed={quiz.passed}
        questions={quiz.questions}
        initialScore={quiz.lastAttempt?.score ?? null}
      />
    </div>
  );
}
