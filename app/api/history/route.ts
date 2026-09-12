import { NextRequest, NextResponse } from "next/server";
import { isValidAccountCode, normalizeAccountCode } from "@/lib/accountCode";
import { createHistoryRecord, listHistory } from "@/lib/history";
import { getProStatus } from "@/lib/pro";

export const runtime = "nodejs";

// 月間の仕入れ記録保存件数の上限（プランごと）。スキャン自体は制限しない。
const MONTHLY_SAVE_LIMITS: Record<"free" | "standard" | "premium", number> = {
  free: 20,
  standard: 50,
  premium: Infinity,
};

export async function GET(req: NextRequest) {
  const accountCode = normalizeAccountCode(req.nextUrl.searchParams.get("accountCode") ?? "");
  if (!isValidAccountCode(accountCode)) {
    return NextResponse.json({ success: false, message: "無効なコードです" }, { status: 400 });
  }

  const records = await listHistory(accountCode);
  return NextResponse.json({ success: true, records });
}

interface CreateHistoryRequest {
  accountCode?: string;
  brandName?: string;
  kana?: string;
  item?: string;
  photo?: string;
  purchasePrice?: number;
  memo?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CreateHistoryRequest | null;
  const accountCode = normalizeAccountCode(body?.accountCode ?? "");
  const brandName = body?.brandName?.trim();

  if (!isValidAccountCode(accountCode) || !brandName) {
    return NextResponse.json({ success: false, message: "コードとブランド名が必要です" }, { status: 400 });
  }

  const proStatus = await getProStatus(accountCode);
  const limit = MONTHLY_SAVE_LIMITS[proStatus.plan];
  if (limit !== Infinity) {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const existing = await listHistory(accountCode);
    const countThisMonth = existing.filter((r) => (r.purchasedAt ?? r.createdAt).slice(0, 7) === monthPrefix).length;
    if (countThisMonth >= limit) {
      return NextResponse.json({
        success: false,
        limitReached: true,
        message: `今月の仕入れ記録の保存上限（${limit}件）に達しました。来月まで待つか、プランのアップグレードをご検討ください。`,
      });
    }
  }

  const record = await createHistoryRecord(accountCode, {
    brandName,
    kana: body?.kana,
    item: body?.item,
    photo: body?.photo,
    purchasePrice: body?.purchasePrice,
    memo: body?.memo,
  });

  if (!record) {
    return NextResponse.json({ success: false, message: "保存に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ success: true, record });
}
