import { NextRequest, NextResponse } from "next/server";
import { grantAdBonus, peekUsage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";

export const runtime = "nodejs";

// リワード広告の視聴完了後にクライアントから呼ばれ、当日の無料枠を+1する。
// 事前に決めた「1日3回まで」という上限自体がgrantAdBonus側で守られるため、
// このエンドポイント単体が呼ばれ続けても影響は1日+3枚に限定される。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const devKey: string | undefined = typeof body?.devKey === "string" ? body.devKey : undefined;

  const ip = getClientIp(req);
  const { granted, adBonus, adBonusLimit } = await grantAdBonus(ip);
  const usage = await peekUsage(ip, devKey);

  return NextResponse.json({ granted, adBonus, adBonusLimit, usage });
}
