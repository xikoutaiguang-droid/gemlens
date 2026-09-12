import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, STRIPE_PRICE_PREMIUM } from "@/lib/stripeClient";
import { setProState } from "@/lib/pro";

export const runtime = "nodejs";

// Stripeからのイベントは非同期に届くため、必ず署名検証を行った上で処理する。
// req.json()ではなく生のボディ文字列が必要（署名はボディのバイト列そのものに対して計算されるため）。
async function verifyEvent(req: NextRequest): Promise<Stripe.Event | null> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return null;

  const rawBody = await req.text();
  try {
    return getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error("[stripe webhook] 署名検証失敗", e);
    return null;
  }
}

function planFromPriceId(priceId: string | undefined): "standard" | "premium" {
  return priceId && priceId === STRIPE_PRICE_PREMIUM ? "premium" : "standard";
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const accountCode = subscription.metadata?.accountCode;
  if (!accountCode) {
    console.error("[stripe webhook] subscriptionにaccountCodeが無い", subscription.id);
    return;
  }
  const priceId = subscription.items.data[0]?.price?.id;
  // 使用中のStripe APIバージョンでは、current_period_endはSubscriptionではなく
  // 各SubscriptionItem側に移動している（複数アイテムでの異なる請求サイクルに対応するため）。
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  await setProState(accountCode, {
    plan: planFromPriceId(priceId),
    status: subscription.status,
    customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    subscriptionId: subscription.id,
    currentPeriodEnd,
  });
}

export async function POST(req: NextRequest) {
  const event = await verifyEvent(req);
  if (!event) {
    return NextResponse.json({ success: false, message: "署名検証に失敗しました。" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && typeof session.subscription === "string") {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription);
          await syncSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe webhook ERROR]", error);
    return NextResponse.json({ success: false, message: "処理中にエラーが発生しました。" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export const dynamic = "force-dynamic";
