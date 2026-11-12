import { notFound } from "next/navigation";
import { requireOnboardedStudent } from "@/lib/rbac";
import { getAssessmentView } from "@/lib/assessments";
import { TheoryRunner } from "@/components/assessments/theory-runner";

export const metadata = { title: "Theory assessment" };

/**
 * Theory paper.
 *
 * The paper is fetched server-side with correct answers stripped, so the
 * browser never receives them. The runner is a client island for the answer
 * form; grading happens in the API.
 */
export default async function TheoryAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOnboardedStudent();
  const { id } = await params;

  const assessment = await getAssessmentView(id, user.id);
  if (!assessment || assessment.kind !== "THEORY") notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <TheoryRunner assessment={assessment} studentId={user.id} />
    </div>
  );
}
