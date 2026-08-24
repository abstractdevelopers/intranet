import { db } from "./db";
import { sendEmail } from "./email";

// Notification types that also go out by email (the rest stay in-app).
const EMAIL_TYPES = new Set([
  "ENROLLMENT_ACCEPTED",
  "ENROLLMENT_REJECTED",
  "ASSIGNMENT_GRADED",
  "FEEDBACK",
  "ANNOUNCEMENT",
  "PAYMENT_RECEIVED",
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

  // Key events also go out by email; in-app delivery never depends on it.
  if (EMAIL_TYPES.has(input.type)) {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (user) {
      await sendEmail({
        to: user.email,
        subject: input.title,
        body: input.body ?? input.title,
      });
    }
  }
}
