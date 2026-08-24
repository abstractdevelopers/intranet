import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ApplicationForm } from "./application-form";

export const metadata = { title: "Apply" };

export default async function ApplyPage() {
  const user = await requireStudent();

  const pending = await db.application.findFirst({
    where: { userId: user.id, status: "PENDING" },
  });
  if (pending) redirect("/student");

  const [compulsory, electives] = await Promise.all([
    db.course.findMany({ where: { type: "COMPULSORY", isActive: true }, orderBy: { name: "asc" } }),
    db.course.findMany({ where: { type: "ELECTIVE", isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Academy Application</h1>
      <p className="mt-1 text-sm text-text-muted">
        Tell us about yourself and choose your elective. Your compulsory courses are
        included automatically.
      </p>
      <ApplicationForm
        compulsory={compulsory.map((c) => ({ id: c.id, name: c.name, description: c.description, price: c.price }))}
        electives={electives.map((c) => ({ id: c.id, name: c.name, description: c.description, price: c.price }))}
      />
    </div>
  );
}
