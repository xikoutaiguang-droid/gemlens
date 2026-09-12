import { NextRequest, NextResponse } from "next/server";
import { getStripe, STRIPE_PRICE_STANDARD, STRIPE_PRICE_PREMIUM } from "@/lib/stripeClient";
import { isValidAccountCode } from "@/lib/accountCode";

export const runtime = "nodejs";

// プレミアムプランのみ、機能を実際に体験してから継続判断できるよう無料トライアルを付ける。
// スタンダードプランは日次上限の撤廃のみとコストが低いため、トライアル無しとする。
const PREMIUM_TRIAL_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const accountCode: string | undefined = typeof body?.accountCode === "string" ? body.accountCode : undefined;
    const plan: string | undefined = typeof body?.plan === "string" ? body.plan : undefined;

    if (!accountCode || !isValidAccountCode(accountCode)) {
      return NextResponse.json({ success: false, message: "IDコードが不正です。" }, { status: 400 });
    }
    if (plan !== "standard" && plan !== "premium") {
      return NextResponse.json({ success: false, message: "プランが不正です。" }, { status: 400 });
    }

    const priceId = plan === "premium" ? STRIPE_PRICE_PREMIUM : STRIPE_PRICE_STANDARD;
    if (!priceId) {
      return NextResponse.json({ success: false, message: "料金プランが未設定です。" }, { status: 500 });
    }

    const stripe = getStripe();
    const origin = req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: accountCode,
      subscription_data: {
        metadata: { accountCode, plan },
        ...(plan === "premium" ? { trial_period_days: PREMIUM_TRIAL_DAYS } : {}),
      },
      success_url: `${origin}/upgrade?success=1`,
      cancel_url: `${origin}/upgrade?canceled=1`,
      // Stripeアカウントの既定機能「Managed Payments」は、商品に税区分コード（tax_code）が
      // 設定されていることを要求する。国内向けのシンプルな課金のみを想定しており
      // Stripe Taxは使わない方針のため、このセッションでは無効化する。
      managed_payments: { enabled: false },
    });

    if (!session.url) {
      return NextResponse.json({ success: false, message: "決済ページの作成に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("[stripe checkout ERROR]", error);
    return NextResponse.json({ success: false, message: "システムエラーが発生しました。" }, { status: 500 });
  }
}
