import { NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase_admin";
import { AppData, NotificationConfig } from "@/lib/types";

function shouldSendToday(config: NotificationConfig, now: Date) {
  const day = now.getDay();
  if (config.frequency === "weekdays") return day >= 1 && day <= 5;
  if (config.frequency === "weekly") return day === (config.weeklyDay ?? 1);
  return true;
}

function isTimeMatch(config: NotificationConfig, now: Date) {
  if (!config.time) return false;
  const [hour, minute] = config.time.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return false;
  return now.getHours() === hour && now.getMinutes() === minute;
}

export async function POST(request: Request) {
  const cronSecret = process.env.NOTIFICATION_CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Missing NOTIFICATION_CRON_SECRET" }, { status: 500 });
  }
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];
  const adminDb = getAdminDb();
  const messaging = getAdminMessaging();

  const snapshot = await adminDb.collection("users").get();
  let sentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const doc of snapshot.docs) {
    const userData = doc.data() as AppData;
    const config = userData.notifications;
    if (!config?.enabled || !config.pushEnabled) {
      skippedCount += 1;
      continue;
    }
    if (!userData.pushTokens?.length) {
      skippedCount += 1;
      continue;
    }
    if (!shouldSendToday(config, now) || !isTimeMatch(config, now)) {
      skippedCount += 1;
      continue;
    }
    const lastSentAt = config.lastSentAt;
    if (lastSentAt && lastSentAt.startsWith(todayKey)) {
      skippedCount += 1;
      continue;
    }

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: userData.pushTokens,
        notification: {
          title: "Daily Mandala Check-in",
          body: "Review your goals and complete one small action today."
        },
        data: {
          kind: "daily-reminder",
          date: todayKey
        }
      });

      const validTokens: string[] = [];
      response.responses.forEach((resp, index) => {
        if (resp.success) {
          validTokens.push(userData.pushTokens![index]);
          return;
        }
        const code = resp.error?.code || "";
        const isInvalid =
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token");
        if (!isInvalid) {
          validTokens.push(userData.pushTokens![index]);
        }
      });

      await doc.ref.update({
        pushTokens: validTokens,
        "notifications.lastSentAt": now.toISOString()
      });

      sentCount += 1;
    } catch (error) {
      console.error("Failed to send notification", error);
      errorCount += 1;
    }
  }

  return NextResponse.json({
    status: "ok",
    sent: sentCount,
    skipped: skippedCount,
    errors: errorCount
  });
}
