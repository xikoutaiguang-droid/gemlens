import { NextRequest, NextResponse } from "next/server";
import { peekUsage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";

export const runtime = "nodejs";

// ページ読み込み時に「本日の残り回数」を表示するための、消費なしの参照用エンドポイント
export async function GET(req: NextRequest) {
  const devKey = req.nextUrl.searchParams.get("devKey") ?? undefined;
  const usage = await peekUsage(getClientIp(req), devKey);
  return NextResponse.json({ usage });
}
