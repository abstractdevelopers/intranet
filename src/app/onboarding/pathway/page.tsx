import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PathwayPicker } from "@/components/onboarding/pathway-picker";
import { StepProgress } from "@/components/onboarding/step-progress";
import { ReclaimPerks } from "@/components/onboarding/reclaim-perks";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/rbac";
import { hasProgramme } from "@/lib/enrollment";
import { isPathwayAutoApprovalActive } from "@/lib/constants";
import { elitePlacesRemaining } from "@/lib/elite";

export const metadata = { title: "Choose your pathway" };

/**
 * Step 4 of the reclaim flow: pick a pathway and start immediately.
 *
 * Only available while the time-boxed auto-approval allowance is open (see
 * PATHWAY_AUTO_APPROVAL_UNTIL). Once it lapses, a creator who still has no
 * pathway is sent to the normal application flow rather than this picker.
 */
export default async function OnboardingPathwayPage() {
  const user = await requireStudent();
  if (user.mustChangePassword) redirect("/onboarding/password");
  if (!user.username) redirect("/onboarding/username");
  if (!user.onboardingCompletedAt) redirect("/onboarding/profile");
  if (await hasProgramme(user.id)) redirect("/student");
  if (!isPathwayAutoApprovalActive()) redirect("/student/apply");

  const [courses, eliteRemaining] = await Promise.all([
    db.course.findMany({
      where: { type: "ELECTIVE", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, slug: true, price: true },
    }),
    elitePlacesRemaining(),
  ]);

  return (
    <div className="space-y-6">
      <StepProgress steps={["Password", "Username", "Profile", "Pathway"]} current={4} />
      <div>
        <p className="eyebrow">Step 04</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Choose your pathway</h1>
        <p className="mt-2 text-sm text-text-muted">
          Pick the specialism you want to build. Your two compulsory foundations (Personal
          Branding and Social Media) come with it, and there&apos;s no waiting on approval while
          the reclaim window is open.
        </p>
      </div>
      <Card className="p-6">
        {courses.length === 0 ? (
          <p className="text-sm text-text-muted">
            Pathways aren&apos;t available right now. Please check back shortly.
          </p>
        ) : (
          <PathwayPicker
            courses={courses.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              slug: c.slug,
              price: c.price,
            }))}
          />
        )}
      </Card>
      <ReclaimPerks eliteRemaining={eliteRemaining} />
    </div>
  );
}
