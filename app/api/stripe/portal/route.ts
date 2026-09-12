import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripeClient";
import { getProStateByAccountCode } from "@/lib/pro";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const accountCode: string | undefined = typeof body?.accountCode === "string" ? body.accountCode : undefined;
    if (!accountCode) {
      return NextResponse.json({ success: false, message: "復元コードが必要です。" }, { status: 400 });
    }

    const state = await getProStateByAccountCode(accountCode);
    if (!state) {
      return NextResponse.json({ success: false, message: "契約情報が見つかりません。" }, { status: 404 });
    }

    const origin = req.nextUrl.origin;
    const session = await getStripe().billingPortal.sessions.create({
      customer: state.customerId,
      return_url: `${origin}/upgrade`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("[stripe portal ERROR]", error);
    return NextResponse.json({ success: false, message: "システムエラーが発生しました。" }, { status: 500 });
  }
}
