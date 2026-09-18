"use client";

import { useState } from "react";
import { CourseMark } from "@/components/course-mark";
import { CrestBackground } from "@/components/crest";
import { ProgressRing } from "@/components/ui/progress-ring";
import { IconArrowRight } from "@/components/icons";

/**
 * Collapsible course header (#7). Students can collapse the introductory
 * section to get straight to the week's content.
 */
export function CourseHeader({
  courseName,
  courseType,
  description,
  slug,
  completedModules,
  totalModules,
  completedLessons,
  totalLessons,
  percent,
}: {
  courseName: string;
  courseType: string;
  description: string;
  slug: string;
  completedModules: number;
  totalModules: number;
  completedLessons: number;
  totalLessons: number;
  percent: number;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="hero-band rounded-2xl p-6 md:p-8" aria-label="Course">
      <CrestBackground className="pointer-events-none absolute -right-10 -top-6 h-40 w-auto opacity-10" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <CourseMark slug={slug} size="lg" />
            <div>
              <p className="hero-eyebrow text-[11px] font-semibold uppercase tracking-[0.18em]">
                {courseType === "COMPULSORY" ? "Compulsory course" : "Elective course"}
              </p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">
                {courseName}
              </h1>
              {collapsed ? (
                <p className="hero-muted mt-1 text-sm">
                  {completedModules} of {totalModules} weeks · {completedLessons} of{" "}
                  {totalLessons} lessons
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {collapsed ? null : (
              <div className="text-right text-sm">
                <p className="font-medium text-white/80">
                  {completedModules} of {totalModules} weeks
                </p>
                <p className="text-white/60">
                  {completedLessons} of {totalLessons} lessons
                </p>
              </div>
            )}
            <ProgressRing value={percent} size={collapsed ? 56 : 76} stroke={6} />
          </div>
        </div>

        {collapsed ? null : <p className="hero-muted mt-4 max-w-2xl text-sm">{description}</p>}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="hero-muted mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-white"
        >
          {collapsed ? "Show course details" : "Collapse course details"}
          <IconArrowRight
            className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-90"}`}
          />
        </button>
      </div>
    </section>
  );
}