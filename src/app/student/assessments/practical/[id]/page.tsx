import { notFound } from "next/navigation";
import { requireOnboardedStudent } from "@/lib/rbac";
import { getAssessmentView } from "@/lib/assessments";
import { PracticalForm } from "@/components/assessments/practical-form";

export const metadata = { title: "Practical assessment" };

/** Practical paper: one deliverable, submitted as text, a link, and/or a file. */
export default async function PracticalAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOnboardedStudent();
  const { id } = await params;

  const assessment = await getAssessmentView(id, user.id);
  if (!assessment || assessment.kind !== "PRACTICAL") notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PracticalForm assessment={assessment} />
    </div>
  );
}
