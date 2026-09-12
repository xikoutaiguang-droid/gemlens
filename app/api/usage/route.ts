import { NextRequest, NextResponse } from "next/server";
import { peekUsage, isDeveloperKey, DAILY_FREE_LIMIT } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";
import { getProStatus, hasUnlimitedScans } from "@/lib/pro";
import { getOrSetFirstSeenAt } from "@/lib/accountMeta";

export const runtime = "nodejs";

// ページ読み込み時に「本日の残り回数」を表示するための、消費なしの参照用エンドポイント
export async function GET(req: NextRequest) {
  const devKey = req.nextUrl.searchParams.get("devKey") ?? undefined;
  const accountCode = req.nextUrl.searchParams.get("accountCode") ?? undefined;

  const proStatus = await getProStatus(accountCode);
  const isDeveloper = isDeveloperKey(devKey);
  const firstSeenAt = accountCode ? await getOrSetFirstSeenAt(accountCode) : undefined;

  if (hasUnlimitedScans(proStatus) || isDeveloper) {
    return NextResponse.json({
      usage: { allowed: true, count: 0, limit: DAILY_FREE_LIMIT, isDeveloper },
      plan: proStatus.plan,
      firstSeenAt,
    });
  }

  const usage = await peekUsage(getClientIp(req), devKey);
  return NextResponse.json({ usage, plan: "free", firstSeenAt });
}
