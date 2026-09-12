import { NextRequest, NextResponse } from "next/server";
import { isDeveloperKey } from "@/lib/rateLimit";
import { deleteContactMessage, listContactMessages } from "@/lib/contact";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const devKey = req.nextUrl.searchParams.get("devKey") ?? undefined;
  if (!isDeveloperKey(devKey)) {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }
  const messages = await listContactMessages();
  return NextResponse.json({ success: true, messages });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isDeveloperKey(body?.devKey)) {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }
  const id = typeof body?.id === "string" ? body.id : undefined;
  if (!id) {
    return NextResponse.json({ success: false, message: "idが必要です" }, { status: 400 });
  }
  const deleted = await deleteContactMessage(id);
  return NextResponse.json({ success: deleted });
}
