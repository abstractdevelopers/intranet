/**
 * Assignment submission lock — end-to-end checks.
 *
 * Runs against a live dev server with real session cookies, so the route, the
 * auth layer, the writes and the partial unique index all execute as they do
 * for a student. Fixtures are fabricated and removed afterwards.
 *
 *   npm run dev            (in another terminal)
 *   npx tsx scripts/test-submission-lock.ts
 *
 * Covers:
 *   1. a first submission is accepted
 *   2. a second submission while pending is refused
 *   3. simultaneous submissions create exactly one row
 *   4. a graded assignment cannot be resubmitted
 *   5. a reviewer request reopens it, and retires any stale live row
 *   6. the database itself rejects a second live row
 */
import { db } from "../src/lib/db";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

async function fixtures(suffix: string, weekNumber: number) {
  const course = await db.course.findFirst({ select: { id: true } });
  if (!course) throw new Error("no course for fixtures");
  const staff = await db.user.findFirst({ where: { role: "FOUNDER" }, select: { id: true } });
  const token = `test-${suffix}-${Date.now()}`;

  const user = await db.user.create({
    data: {
      email: `${token}@test.invalid`,
      username: token,
      passwordHash: "x",
      role: "STUDENT",
      status: "ACTIVE",
      onboardingCompletedAt: new Date(),
      profile: { create: { fullName: "Lock Test" } },
      sessions: { create: { token, expiresAt: new Date(Date.now() + 3600_000) } },
      enrollments: { create: { courseId: course.id, status: "ACCEPTED", enrollmentType: "COMPULSORY" } },
    },
    select: { id: true },
  });
  await db.session.create({
    data: { token: `${token}-staff`, userId: staff!.id, expiresAt: new Date(Date.now() + 3600_000) },
  });
  const mod = await db.module.create({
    data: {
      courseId: course.id,
      title: `${token} module`,
      weekNumber,
      order: weekNumber,
      status: "PUBLISHED",
      releaseAt: new Date(Date.now() - 86_400_000),
    },
    select: { id: true },
  });
  const assignment = await db.assignment.create({
    data: {
      moduleId: mod.id,
      title: `${token} assignment`,
      description: "test",
      allowedTypes: JSON.stringify(["URL"]),
      maxAttempts: 3,
      latePolicy: "ALLOW",
      maxScore: 100,
      releaseAt: new Date(Date.now() - 86_400_000),
    },
    select: { id: true },
  });

  const submit = async (url = "https://example.com/work") => {
    const f = new FormData();
    f.set("url", url);
    const res = await fetch(`${BASE}/api/student/assignments/${assignment.id}/submit`, {
      method: "POST",
      body: f,
      headers: { cookie: `uca_session=${token}` },
    });
    return res.status;
  };

  const rows = () =>
    db.assignmentSubmission.findMany({
      where: { assignmentId: assignment.id, userId: user.id },
      orderBy: { attempt: "asc" },
      select: { id: true, attempt: true, status: true },
    });

  const cleanup = async () => {
    await db.assignmentSubmission.deleteMany({ where: { assignmentId: assignment.id } });
    await db.feedback.deleteMany({ where: { submission: { assignmentId: assignment.id } } });
    await db.grade.deleteMany({ where: { submission: { assignmentId: assignment.id } } });
    await db.assignment.deleteMany({ where: { id: assignment.id } });
    await db.module.deleteMany({ where: { id: mod.id } });
    await db.session.deleteMany({ where: { token: { in: [token, `${token}-staff`] } } });
    await db.user.deleteMany({ where: { id: user.id } });
  };

  return { user, token, assignment, submit, rows, cleanup };
}

async function main() {
  const f = await fixtures("lock", 95);

  try {
    console.log("\n=== 1. first submission ===");
    check("accepted", (await f.submit()) === 200);
    const r1 = await f.rows();
    check("one row", r1.length === 1, `got ${r1.length}`);
    check("status SUBMITTED", r1[0]?.status === "SUBMITTED", `got ${r1[0]?.status}`);

    console.log("\n=== 2. second submission while pending ===");
    check("refused 409", (await f.submit("https://example.com/second")) === 409);
    check("still one row", (await f.rows()).length === 1);

    console.log("\n=== 3. simultaneous submissions ===");
    const codes = await Promise.all(Array.from({ length: 12 }, (_, i) => f.submit(`https://example.com/race-${i}`)));
    check("none accepted", codes.every((c) => c === 409), JSON.stringify(codes));
    check("still one row", (await f.rows()).length === 1);

    console.log("\n=== 4. graded ===");
    const row = (await f.rows())[0];
    const staff = await db.user.findFirst({ where: { role: "FOUNDER" }, select: { id: true } });
    await db.$transaction([
      db.grade.create({ data: { submissionId: row.id, score: 70, maxScore: 100, passed: true, gradedById: staff!.id } }),
      db.assignmentSubmission.update({ where: { id: row.id }, data: { status: "GRADED" } }),
    ]);
    check("graded refuses resubmission", (await f.submit()) === 409);

    console.log("\n=== 5. reviewer reopens, through the real route ===");
    const token = f.token;
    const review = await fetch(`${BASE}/api/admin/submissions/${row.id}/review`, {
      method: "POST",
      body: JSON.stringify({ score: 70, feedback: "Redo please", requestRevision: true }),
      headers: { "content-type": "application/json", cookie: `uca_session=${token}-staff` },
    });
    check("review route accepted", review.status === 200, `got ${review.status}`);
    check(
      "reviewed row is NEEDS_REVISION",
      (await f.rows()).some((r) => r.status === "NEEDS_REVISION"),
    );
    check("resubmission accepted", (await f.submit("https://example.com/redo")) === 200);
    const after = await f.rows();
    check("attempt numbering continues", after[after.length - 1]?.attempt === 2, `got ${after[after.length - 1]?.attempt}`);
    check("further submission blocked", (await f.submit()) === 409);

    console.log("\n=== 6. database rejects a second live row ===");
    let rejected = false;
    try {
      await db.assignmentSubmission.create({
        data: { assignmentId: f.assignment.id, userId: f.user.id, attempt: 99, status: "SUBMITTED" },
      });
    } catch (e) {
      rejected = (e as { code?: string }).code === "P2002";
    }
    check("partial unique index holds", rejected);
  } finally {
    await f.cleanup();
  }

  const leftover = await db.user.count({ where: { email: { endsWith: "@test.invalid" } } });
  check("no leftover fixtures", leftover === 0, `${leftover} left`);

  await db.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
