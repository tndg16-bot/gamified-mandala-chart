import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase_admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe secrets" }, { status: 500 });
  }

  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
  const body = await request.text();
  const signature = headers().get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const lessonId = session.metadata?.lessonId;
    const userId = session.metadata?.userId;
    if (lessonId && userId) {
      const adminDb = getAdminDb();
      const userRef = adminDb.collection("users").doc(userId);
      await userRef.set(
        { purchasedLessonIds: FieldValue.arrayUnion(lessonId) },
        { merge: true }
      );
    }
  }

  return NextResponse.json({ received: true });
}
