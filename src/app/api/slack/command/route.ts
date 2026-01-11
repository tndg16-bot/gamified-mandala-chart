import crypto from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase_admin";
import { AiClient } from "@/lib/ai_client";
import { AppData, MandalaChart, SubTask } from "@/lib/types";

const SLACK_TOLERANCE_SECONDS = 60 * 5;

function verifySlackRequest(secret: string, body: string, timestamp: string, signature: string) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SLACK_TOLERANCE_SECONDS) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hash = `v0=${crypto.createHmac("sha256", secret).update(baseString).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

function findMatchingSubTask(chart: MandalaChart, title: string) {
  const query = title.toLowerCase();
  for (const section of chart.surroundingSections) {
    for (const cell of section.surroundingCells) {
      for (const subTask of cell.subTasks || []) {
        if (subTask.title.toLowerCase() === query) {
          return { section, cell, subTask };
        }
      }
    }
  }
  return null;
}

function ensureSubTasks(cell: { subTasks?: SubTask[] }) {
  if (!cell.subTasks) cell.subTasks = [];
}

function applyCompletion(data: AppData, sectionTitle: string) {
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];
  if (!data.xpHistory) data.xpHistory = [];
  let historyEntry = data.xpHistory.find((entry) => entry.date === todayKey);
  if (!historyEntry) {
    historyEntry = { date: todayKey, xp: 0 };
    data.xpHistory.push(historyEntry);
  }
  data.tiger.xp += 10;
  historyEntry.xp += 10;
  if (Math.floor(data.tiger.xp / 100) > data.tiger.level - 1) {
    data.tiger.level += 1;
  }

  const lastLogin = data.tiger.lastLogin ? new Date(data.tiger.lastLogin) : null;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (lastLogin) {
    const lastStart = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
    const diffDays = Math.round((todayStart.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      data.tiger.streakDays = (data.tiger.streakDays || 0) + 1;
    } else if (diffDays > 1) {
      data.tiger.streakDays = 1;
    }
  } else {
    data.tiger.streakDays = 1;
  }
  data.tiger.lastLogin = now.toISOString();

  if (!data.behaviorStats) {
    data.behaviorStats = { activityByHour: {}, categoryCompletions: {} };
  }
  const hourKey = String(now.getHours());
  data.behaviorStats.activityByHour[hourKey] = (data.behaviorStats.activityByHour[hourKey] || 0) + 1;
  const category = sectionTitle || "General";
  data.behaviorStats.categoryCompletions[category] = (data.behaviorStats.categoryCompletions[category] || 0) + 1;
  data.behaviorStats.lastActivityAt = now.toISOString();
}

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ text: "Missing SLACK_SIGNING_SECRET" }, { status: 500 });
  }

  const rawBody = await request.text();
  const headerList = headers();
  const timestamp = headerList.get("x-slack-request-timestamp") || "";
  const signature = headerList.get("x-slack-signature") || "";

  if (!verifySlackRequest(signingSecret, rawBody, timestamp, signature)) {
    return NextResponse.json({ text: "Invalid Slack signature" }, { status: 401 });
  }

  const payload = new URLSearchParams(rawBody);
  const command = payload.get("command") || "";
  const text = (payload.get("text") || "").trim();
  const slackUserId = payload.get("user_id") || "";

  const adminDb = getAdminDb();
  const usersRef = adminDb.collection("users");
  const snapshot = await usersRef.where("slackUserId", "==", slackUserId).limit(1).get();
  if (snapshot.empty) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Slack user is not linked. Set Slack User ID in Settings."
    });
  }
  const doc = snapshot.docs[0];
  const userData = doc.data() as AppData;

  if (command === "/done") {
    if (!text) {
      return NextResponse.json({ response_type: "ephemeral", text: "Usage: /done <task title>" });
    }

    const updatedData = JSON.parse(JSON.stringify(userData)) as AppData;
    const match = findMatchingSubTask(updatedData.mandala, text);
    if (match) {
      if (match.subTask.completed) {
        return NextResponse.json({ response_type: "ephemeral", text: "Task already completed." });
      }
      match.subTask.completed = true;
      applyCompletion(updatedData, match.section.centerCell.title);
      await doc.ref.set(updatedData, { merge: true });
      return NextResponse.json({ response_type: "ephemeral", text: `Completed: ${match.subTask.title}` });
    }

    const fallbackSection = updatedData.mandala.surroundingSections[0];
    const fallbackCell = fallbackSection.surroundingCells[0];
    ensureSubTasks(fallbackCell);
    fallbackCell.subTasks!.push({
      id: `sub-${Date.now()}`,
      title: text,
      completed: true,
      difficulty: "B",
      createdAt: new Date().toISOString()
    });
    applyCompletion(updatedData, fallbackSection.centerCell.title);
    await doc.ref.set(updatedData, { merge: true });
    return NextResponse.json({ response_type: "ephemeral", text: `Added and completed: ${text}` });
  }

  if (command === "/ask") {
    if (!text) {
      return NextResponse.json({ response_type: "ephemeral", text: "Usage: /ask <question>" });
    }
    const client = new AiClient(userData.aiConfig || undefined);
    const reply = await client.chat([{ role: "user", content: text }]);
    return NextResponse.json({ response_type: "ephemeral", text: reply });
  }

  return NextResponse.json({ response_type: "ephemeral", text: "Unsupported command." });
}
