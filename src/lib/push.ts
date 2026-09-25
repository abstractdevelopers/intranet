/**
 * Web-push delivery.
 *
 * Sends to every subscribed device for a set of students. Delivery is
 * best-effort: a subscription the push service reports as gone (404/410) is
 * pruned so the table stays clean. Anything else is counted as a failure and
 * left in place for a later send.
 *
 * When VAPID keys aren't configured, sending is skipped and logged, mirroring
 * how email behaves without SENDBYTE_API_KEY.
 */
import webpush from "web-push";
import { db } from "./db";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  /** Collapses repeated notifications on the device, e.g. one per campaign. */
  tag?: string;
};

function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:no-reply@launchverse.site";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export type PushResult = {
  sent: number;
  failed: number;
  /** Subscriptions removed because the browser says they no longer exist. */
  pruned: number;
  /** True when push isn't configured, so nothing was attempted. */
  skipped: boolean;
};

/**
 * Push to every device belonging to `userIds`. Runs in bounded parallel
 * slices so a large audience doesn't open thousands of sockets at once.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<PushResult> {
  if (userIds.length === 0) return { sent: 0, failed: 0, pruned: 0, skipped: false };
  if (!configure()) {
    console.info(`[push:skipped] ${payload.title} → ${userIds.length} user(s)`);
    return { sent: 0, failed: 0, pruned: 0, skipped: true };
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  const seen: string[] = [];

  const CONCURRENCY = 20;
  for (let i = 0; i < subscriptions.length; i += CONCURRENCY) {
    const slice = subscriptions.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
          sent += 1;
          seen.push(sub.id);
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404/410 mean the subscription is permanently gone.
          if (statusCode === 404 || statusCode === 410) gone.push(sub.id);
          else failed += 1;
        }
      })
    );
  }

  const writes: Promise<unknown>[] = [];
  if (seen.length) {
    writes.push(
      db.pushSubscription.updateMany({
        where: { id: { in: seen } },
        data: { lastSeenAt: new Date() },
      })
    );
  }
  if (gone.length) {
    writes.push(db.pushSubscription.deleteMany({ where: { id: { in: gone } } }));
  }
  await Promise.all(writes);

  return { sent, failed, pruned: gone.length, skipped: false };
}

/**
 * Fan a portal notification out to a student's devices. Convenience wrapper
 * used by notify() so in-app and push delivery stay in sync.
 */
export async function pushToUser(userId: string, payload: PushPayload) {
  return sendPushToUsers([userId], payload);
}
