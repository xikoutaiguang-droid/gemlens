import { NextRequest, NextResponse } from "next/server";
import { isValidAccountCode, normalizeAccountCode } from "@/lib/accountCode";
import { createHistoryRecord, listHistory } from "@/lib/history";

export const runtime = "nodejs";

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
