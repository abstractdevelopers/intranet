import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/format";

export default async function Home() {
  const courses = await db.course.findMany({
    where: { isActive: true, status: "PUBLISHED" },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const compulsory = courses.filter((c) => c.type === "COMPULSORY");
  const electives = courses.filter((c) => c.type === "ELECTIVE");
  const monthlyTotal = compulsory.slice(0, 2).reduce((s, c) => s + c.price, 0) + (electives[0]?.price ?? 0);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold tracking-tight">
          <span className="text-brand-1 dark:text-brand-3">UCA</span> Sandbox
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
          <ButtonLink href="/signup">Apply now</ButtonLink>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-16 md:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-1 dark:text-brand-3">
            UCA Sandbox
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            A serious platform designed for your growth.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-text-muted">
            Learn, build, submit, receive feedback, and progress through a structured
            academy program — all in one place.
          </p>
          <div className="mt-8 flex gap-3">
            <ButtonLink href="/signup">Start your application</ButtonLink>
            <ButtonLink href="#program" variant="secondary">View the program</ButtonLink>
          </div>
        </section>

        <section id="program" className="pb-20">
          <h2 className="text-2xl font-bold tracking-tight">Your Academy Program</h2>
          <p className="mt-2 text-text-muted">
            Every student takes two compulsory courses and chooses exactly one elective — three courses in total.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card>
              <h3 className="text-base font-semibold">Compulsory courses</h3>
              <p className="mt-1 text-sm text-text-muted">Automatically included for every student.</p>
              <ul className="mt-4 space-y-3">
                {compulsory.map((course) => (
                  <li key={course.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-1 text-xs text-white">✓</span>
                    <div>
                      <p className="text-sm font-medium">{course.name}</p>
                      <p className="text-sm text-text-muted">{course.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className="text-base font-semibold">Choose one elective</h3>
              <p className="mt-1 text-sm text-text-muted">You can select only one elective course.</p>
              <ul className="mt-4 space-y-3">
                {electives.map((course) => (
                  <li key={course.id}>
                    <p className="text-sm font-medium">{course.name}</p>
                    <p className="text-sm text-text-muted">{course.description}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-6">
            <h3 className="text-base font-semibold">Transparent pricing</h3>
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-3xl font-bold text-brand-1 dark:text-brand-3">FREE</p>
                <p className="mt-1 text-sm text-text-muted">Your first month is completely free.</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{formatNaira(courses[0]?.price ?? 15000)}</p>
                <p className="mt-1 text-sm text-text-muted">Per course, per month, after your free month.</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{formatNaira(monthlyTotal)}/mo</p>
                <p className="mt-1 text-sm text-text-muted">
                  Standard program of three courses after the free first month.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-text-muted">
          <span>© {new Date().getFullYear()} UCA Sandbox</span>
          <Link href="/login" className="hover:text-text">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
