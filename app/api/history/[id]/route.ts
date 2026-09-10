import { NextRequest, NextResponse } from "next/server";
import { isValidAccountCode, normalizeAccountCode } from "@/lib/accountCode";
import { deleteHistoryRecord, updateHistoryRecord } from "@/lib/history";

export const runtime = "nodejs";

interface UpdateHistoryRequest {
  accountCode?: string;
  purchasePrice?: number | null;
  salePrice?: number | null;
  memo?: string | null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as UpdateHistoryRequest | null;
  const accountCode = normalizeAccountCode(body?.accountCode ?? "");

  if (!isValidAccountCode(accountCode)) {
    return NextResponse.json({ success: false, message: "無効なコードです" }, { status: 400 });
  }

  const record = await updateHistoryRecord(accountCode, id, {
    purchasePrice: body?.purchasePrice,
    salePrice: body?.salePrice,
    memo: body?.memo,
  });

  if (!record) {
    return NextResponse.json({ success: false, message: "記録が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ success: true, record });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accountCode = normalizeAccountCode(req.nextUrl.searchParams.get("accountCode") ?? "");

  if (!isValidAccountCode(accountCode)) {
    return NextResponse.json({ success: false, message: "無効なコードです" }, { status: 400 });
  }

  const deleted = await deleteHistoryRecord(accountCode, id);
  if (!deleted) {
    return NextResponse.json({ success: false, message: "記録が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
