import crypto from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase_admin";
import { AiClient } from "@/lib/ai_client";
import { AppData, MandalaChart, SubTask } from "@/lib/types";

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

function verifyLineSignature(secret: string, body: string, signature: string) {
  const hash = crypto.createHmac("sha256", secret).update(body).digest("base64");
  if (!signature) return false;
  const hashBuffer = Buffer.from(hash);
  const signatureBuffer = Buffer.from(signature);
  if (hashBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
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

async function replyLine(replyToken: string, text: string, accessToken: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }]
    })
  });
}

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelSecret || !accessToken) {
    return NextResponse.json({ error: "Missing LINE secrets" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = headers().get("x-line-signature") || "";
  if (!verifyLineSignature(channelSecret, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as { events?: LineEvent[] };
  const event = payload.events?.[0];
  if (!event || event.type !== "message" || event.message?.type !== "text") {
    return NextResponse.json({ status: "ignored" });
  }

  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  const text = (event.message.text || "").trim();
  if (!lineUserId || !replyToken || !text) {
    return NextResponse.json({ status: "ignored" });
  }

  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("users").where("lineUserId", "==", lineUserId).limit(1).get();
  if (snapshot.empty) {
    await replyLine(replyToken, "LINE user is not linked. Set LINE User ID in Settings.", accessToken);
    return NextResponse.json({ status: "linked-missing" });
  }

  const doc = snapshot.docs[0];
  const userData = doc.data() as AppData;
  const lower = text.toLowerCase();
  if (lower.startsWith("done ")) {
    const taskTitle = text.slice(5).trim();
    if (!taskTitle) {
      await replyLine(replyToken, "Usage: done <task title>", accessToken);
      return NextResponse.json({ status: "invalid" });
    }
    const updatedData = JSON.parse(JSON.stringify(userData)) as AppData;
    const match = findMatchingSubTask(updatedData.mandala, taskTitle);
    if (match) {
      if (match.subTask.completed) {
        await replyLine(replyToken, "Task already completed.", accessToken);
        return NextResponse.json({ status: "already" });
      }
      match.subTask.completed = true;
      applyCompletion(updatedData, match.section.centerCell.title);
      await doc.ref.set(updatedData, { merge: true });
      await replyLine(replyToken, `Completed: ${match.subTask.title}`, accessToken);
      return NextResponse.json({ status: "completed" });
    }

    const fallbackSection = updatedData.mandala.surroundingSections[0];
    const fallbackCell = fallbackSection.surroundingCells[0];
    ensureSubTasks(fallbackCell);
    fallbackCell.subTasks!.push({
      id: `sub-${Date.now()}`,
      title: taskTitle,
      completed: true,
      difficulty: "B",
      createdAt: new Date().toISOString()
    });
    applyCompletion(updatedData, fallbackSection.centerCell.title);
    await doc.ref.set(updatedData, { merge: true });
    await replyLine(replyToken, `Added and completed: ${taskTitle}`, accessToken);
    return NextResponse.json({ status: "completed" });
  }

  if (lower.startsWith("ask ")) {
    const question = text.slice(4).trim();
    if (!question) {
      await replyLine(replyToken, "Usage: ask <question>", accessToken);
      return NextResponse.json({ status: "invalid" });
    }
    const client = new AiClient(userData.aiConfig || undefined);
    const reply = await client.chat([{ role: "user", content: question }]);
    await replyLine(replyToken, reply, accessToken);
    return NextResponse.json({ status: "answered" });
  }

  await replyLine(replyToken, "Send 'done <task>' or 'ask <question>'.", accessToken);
  return NextResponse.json({ status: "ok" });
}
