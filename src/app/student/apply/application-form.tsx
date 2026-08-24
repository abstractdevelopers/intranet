"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Select, Field } from "@/components/ui/input";
import { OCCUPATIONS, EXPERIENCE_LEVELS } from "@/lib/constants";

type CourseOption = { id: string; name: string; description: string; price: number };

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function ApplicationForm({
  compulsory,
  electives,
}: {
  compulsory: CourseOption[];
  electives: CourseOption[];
}) {
  const router = useRouter();
  const [electiveId, setElectiveId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = electives.find((e) => e.id === electiveId);
  const monthlyTotal = compulsory.reduce((s, c) => s + c.price, 0) + (selected?.price ?? 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!electiveId) {
      setError("Please select one elective course.");
      return;
    }
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      currentOccupation: form.get("currentOccupation"),
      experienceLevel: form.get("experienceLevel"),
      about: form.get("about"),
      motivation: form.get("motivation"),
      goals: form.get("goals"),
      challenge: form.get("challenge"),
      selectedElectiveId: electiveId,
    };
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't complete that action. Please try again.");
        return;
      }
      router.push(data.redirect ?? "/student");
      router.refresh();
    } catch {
      setError("We couldn't complete that action. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
      <Card>
        <h2 className="text-base font-semibold">Background</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="What do you currently do?" htmlFor="currentOccupation">
            <Select id="currentOccupation" name="currentOccupation" required defaultValue="">
              <option value="" disabled>Select…</option>
              {OCCUPATIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="What is your current experience level?" htmlFor="experienceLevel">
            <Select id="experienceLevel" name="experienceLevel" required defaultValue="">
              <option value="" disabled>Select…</option>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Tell us briefly about yourself." htmlFor="about">
            <Textarea id="about" name="about" required />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Motivation</h2>
        <div className="mt-4 space-y-4">
          <Field label="Why do you want to join the academy?" htmlFor="motivation">
            <Textarea id="motivation" name="motivation" required />
          </Field>
          <Field label="What do you hope to achieve during the program?" htmlFor="goals">
            <Textarea id="goals" name="goals" required />
          </Field>
          <Field label="What is your biggest current challenge?" htmlFor="challenge">
            <Textarea id="challenge" name="challenge" required />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Your Compulsory Courses</h2>
        <ul className="mt-4 space-y-3">
          {compulsory.map((course) => (
            <li key={course.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-1 text-xs text-white">✓</span>
              <div>
                <p className="text-sm font-medium">{course.name}</p>
                <p className="text-xs text-text-muted">Automatically included</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Choose Your Elective</h2>
        <p className="mt-1 text-sm text-text-muted">You can select only one elective course.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Elective">
          {electives.map((course) => {
            const active = electiveId === course.id;
            return (
              <button
                key={course.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setElectiveId(course.id)}
                className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-1 ${
                  active
                    ? "border-brand-1 bg-brand-3/20"
                    : "border-border bg-surface hover:border-brand-1/50"
                }`}
              >
                <p className="text-sm font-semibold">{course.name}</p>
                <p className="mt-1 text-sm text-text-muted">{course.description}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Your Academy Program</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {compulsory.map((course) => (
            <li key={course.id} className="flex items-center gap-2">
              <span className="text-brand-1 dark:text-brand-3">✓</span> {course.name}
            </li>
          ))}
          {selected ? (
            <li className="flex items-center gap-2">
              <span className="text-brand-1 dark:text-brand-3">✓</span> {selected.name}
            </li>
          ) : null}
        </ul>
        <p className="mt-2 text-sm text-text-muted">{compulsory.length + (selected ? 1 : 0)} courses</p>
        <div className="mt-4 rounded-lg bg-surface-2 p-4 text-sm">
          <div className="flex justify-between">
            <span>First month</span>
            <span className="font-semibold text-brand-1 dark:text-brand-3">FREE</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>After your first month</span>
            <span className="font-semibold">{selected ? `${naira(monthlyTotal)}/month` : "—"}</span>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Each course is {naira(compulsory[0]?.price ?? 15000)}/month after the free first month.
          </p>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full md:w-auto">
        {loading ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
