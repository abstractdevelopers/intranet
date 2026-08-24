import Link from "next/link";
import { Crest, CrestBackground } from "@/components/crest";
import { ThemeToggle } from "@/components/theme-toggle";
import { CourseMark } from "@/components/course-mark";
import { IconCheck, IconArrowRight, IconTrophy, IconMilestone, IconWorkspace } from "@/components/icons";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="flex items-center gap-2.5">
          <Crest className="h-8 w-auto text-ink dark:text-white" />
          <span className="text-lg font-bold tracking-tight">UCA Sandbox</span>
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-1 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-2"
          >
            Apply now
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — academy identity first */}
        <section className="hero-band relative" aria-label="Introduction">
          <CrestBackground className="pointer-events-none absolute -left-10 top-10 h-72 w-72 text-white/5" />
          <CrestBackground className="pointer-events-none absolute -right-16 bottom-0 h-96 w-96 text-white/5" />
          <div className="relative mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
            <Crest className="mx-auto h-14 w-auto text-white" />
            <p className="hero-eyebrow mt-6 text-xs font-semibold uppercase tracking-[0.22em]">
              A modern academy for the ambitious
            </p>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
              Learn. Build. Become undeniable.
            </h1>
            <p className="hero-muted mx-auto mt-6 max-w-2xl text-base leading-relaxed md:text-lg">
              UCA Sandbox is a digital academy where you master branding, media and creative
              skills through structured weekly training — then prove them by building real work
              in your own sandbox workspace.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-brand-3"
              >
                Begin your application <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Student sign in
              </Link>
            </div>
          </div>
        </section>

        {/* The loop */}
        <section className="mx-auto max-w-5xl px-6 py-16 md:py-20" aria-label="How it works">
          <p className="eyebrow text-center">The academy loop</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: IconMilestone, step: "01", title: "Learn", body: "Weekly modules with lessons, video and resources — released as you advance." },
              { icon: IconWorkspace, step: "02", title: "Build", body: "Apply every lesson in your sandbox workspace, on real briefs and projects." },
              { icon: IconTrophy, step: "03", title: "Progress", body: "Submit work, receive expert feedback, and earn milestones toward graduation." },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-3/20 text-brand-1 dark:text-brand-3">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold tracking-widest text-text-muted">{item.step}</span>
                </div>
                <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The program */}
        <section className="border-t border-border bg-surface-2/60" aria-label="Program">
          <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
            <p className="eyebrow">The program</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              Two foundations. One specialization. Zero filler.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface p-6">
                <p className="eyebrow">Compulsory foundations</p>
                <ul className="mt-4 space-y-4">
                  {[
                    { slug: "personal-branding", name: "Personal Branding", desc: "Define and own your professional identity." },
                    { slug: "social-media", name: "Social Media", desc: "Build presence, reach and audience systems." },
                  ].map((c) => (
                    <li key={c.slug} className="flex items-center gap-3.5">
                      <CourseMark slug={c.slug} />
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {c.name}
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-3/25 px-2 py-0.5 text-[10px] font-semibold text-brand-2 dark:text-brand-3">
                            <IconCheck className="h-3 w-3" /> Auto-included
                          </span>
                        </p>
                        <p className="text-sm text-text-muted">{c.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-surface p-6">
                <p className="eyebrow">Choose your elective</p>
                <ul className="mt-4 space-y-4">
                  {[
                    { slug: "video-editing", name: "Video Editing" },
                    { slug: "graphics-design", name: "Graphics Design" },
                    { slug: "communication-influence", name: "Communication / Influence" },
                    { slug: "content-writing", name: "Content Writing" },
                  ].map((c) => (
                    <li key={c.slug} className="flex items-center gap-3.5">
                      <CourseMark slug={c.slug} size="sm" />
                      <p className="text-sm font-semibold">{c.name}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-text-muted">Exactly one elective, reviewed by the academy.</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-6">
              <div>
                <p className="eyebrow">Membership</p>
                <p className="mt-1 text-sm text-text-muted">
                  Your first month is free. After that, ₦15,000 per course per month.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-brand-1 dark:text-brand-3">₦45,000</p>
                <p className="text-xs text-text-muted">per month after your free month</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <Crest className="h-6 w-auto text-ink dark:text-white" />
            <span className="text-sm font-semibold">UCA Sandbox</span>
          </span>
          <p className="text-xs text-text-muted">
            A serious platform for your growth. © {new Date().getFullYear()} UCA Sandbox.
          </p>
        </div>
      </footer>
    </div>
  );
}
