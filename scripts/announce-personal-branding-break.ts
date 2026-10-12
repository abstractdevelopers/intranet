/**
 * Publishes the Personal Branding & Social Media "revision week" announcement.
 *
 * Mirrors POST /api/admin/announcements exactly — an ACADEMY announcement plus
 * one ANNOUNCEMENT notification per active student — because that route needs an
 * authenticated staff session and this runs from the CLI.
 *
 * Course-targeted, so it only reaches students actually enrolled on Personal
 * Branding & Social Media rather than the whole academy.
 *
 *   npx tsx scripts/announce-personal-branding-break.ts            # dry run
 *   npx tsx scripts/announce-personal-branding-break.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const COURSE_SLUG = "personal-branding";

const TITLE = "Personal Branding & Social Media — no new lesson this week";

const BODY = `There is no new Personal Branding & Social Media lesson this week. Module 1 is complete, and Module 2 begins next week.

This week is for revision and reflection:

1. Go back over your Module 1 lessons.
2. Check your Instagram profile is complete and correct — username, profile picture, bio, category, contact information and your pathway.
3. Complete your Captain's Log for the week.

Your Captain's Log opens on Friday. Submitting it is what unlocks Module 2 next week, so please do not skip it.

Use the time to tidy up your profile. Module 2 assumes your foundation is in place, and a profile that was rushed in week 1 will hold back everything you build on top of it.

See you next week.`;

async function main() {
  const course = await db.course.findUnique({
    where: { slug: COURSE_SLUG },
    select: { id: true, name: true },
  });
  if (!course) throw new Error(`course not found: ${COURSE_SLUG}`);

  const recipients = await db.user.findMany({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      enrollments: { some: { courseId: course.id, status: "ACCEPTED" } },
    },
    select: { id: true, email: true },
  });

  const existing = await db.announcement.findFirst({
    where: { title: TITLE, audience: "COURSE", courseId: course.id },
    select: { id: true, createdAt: true },
  });

  console.log(`Course     : ${course.name} (${course.id})`);
  console.log(`Title      : ${TITLE}`);
  console.log(`Audience   : COURSE (enrolled, ACCEPTED)`);
  console.log(`Recipients : ${recipients.length} students`);
  console.log(`Already    : ${existing ? `published ${existing.createdAt.toISOString()} (${existing.id})` : "not published"}`);

  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply.");
    return;
  }

  // Guard before writing. Without this a re-run published a second announcement
  // and another 112 notifications, since the lookup above only reported.
  if (existing) {
    console.log(`\nAlready published (${existing.id}) — nothing written.`);
    return;
  }

  const author = await db.user.findFirst({
    where: { role: { in: ["FOUNDER", "SUPER_ADMIN"] } },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!author) throw new Error("no FOUNDER/SUPER_ADMIN to attribute the announcement to");

  const announcement = await db.announcement.create({
    data: {
      title: TITLE,
      body: BODY,
      audience: "COURSE",
      courseId: course.id,
      authorId: author.id,
    },
    select: { id: true },
  });

  await db.notification.createMany({
    data: recipients.map((r) => ({
      userId: r.id,
      type: "ANNOUNCEMENT",
      title: TITLE,
      body: BODY.slice(0, 300),
    })),
  });

  await db.auditLog.create({
    data: {
      actorId: author.id,
      action: "ANNOUNCEMENT_PUBLISHED",
      targetType: "Announcement",
      targetId: announcement.id,
      metadata: JSON.stringify({
        audience: "COURSE",
        courseId: course.id,
        recipients: recipients.length,
        via: "scripts/announce-personal-branding-break.ts",
      }),
    },
  });

  console.log(`\nPublished ${announcement.id} — ${recipients.length} notifications created (author ${author.email}).`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
