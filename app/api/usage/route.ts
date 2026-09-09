import { NextRequest, NextResponse } from "next/server";
import { peekUsage } from "@/lib/rateLimit";

export const runtime = "nodejs";

// ページ読み込み時に「本日の残り回数」を表示するための、消費なしの参照用エンドポイント
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId") ?? undefined;
  const devKey = req.nextUrl.searchParams.get("devKey") ?? undefined;
  const usage = await peekUsage(deviceId, devKey);
  return NextResponse.json({ usage });
}
