import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { lessonId, title, priceCents, currency } = body as {
    lessonId?: string;
    title?: string;
    priceCents?: number;
    currency?: string;
  };

  if (!lessonId || !title || !priceCents || priceCents <= 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }

  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/?checkout=success&lessonId=${encodeURIComponent(lessonId)}`;
  const cancelUrl = `${origin}/?checkout=cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (currency || "usd").toLowerCase(),
            unit_amount: priceCents,
            product_data: {
              name: title,
              metadata: { lessonId }
            }
          }
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
