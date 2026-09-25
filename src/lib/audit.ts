import { db } from "./db";
import { sendEmail } from "./email";
import { notificationEmail } from "./email-templates";
import { pushToUser } from "./push";

// Notification types that also go out by email (the rest stay in-app).
const EMAIL_TYPES = new Set([
  "ENROLLMENT_ACCEPTED",
  "ENROLLMENT_REJECTED",
  "ASSIGNMENT_GRADED",
  "FEEDBACK",
  "ANNOUNCEMENT",
  "PAYMENT_RECEIVED",
]);

// Types that also fire a browser push. Deliberately narrower than the in-app
// set — high-volume social events (e.g. a new follower) stay in the portal so
// devices aren't spammed.
const PUSH_TYPES = new Set([
  "ENROLLMENT_ACCEPTED",
  "ENROLLMENT_REJECTED",
  "ASSIGNMENT_GRADED",
  "FEEDBACK",
  "ANNOUNCEMENT",
  "PAYMENT_RECEIVED",
  "COURSE_COMPLETED",
]);

export async function auditLog(input: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });
}

export async function notify(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  });

  // Push and email are best-effort: neither is allowed to break the request
  // that triggered the notification, and in-app delivery already succeeded.
  if (PUSH_TYPES.has(input.type)) {
    await pushToUser(input.userId, {
      title: input.title,
      body: input.body ?? input.title,
      url: "/student/notifications",
    }).catch((err) => console.error("[push:failed]", err));
  }

  if (EMAIL_TYPES.has(input.type)) {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (user) {
      const { subject, html, text } = notificationEmail({
        title: input.title,
        body: input.body ?? input.title,
      });
      await sendEmail({ to: user.email, subject, body: text, html });
    }
  }
}
