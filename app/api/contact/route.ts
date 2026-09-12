import { NextRequest, NextResponse } from "next/server";
import { createContactMessage } from "@/lib/contact";
import { getClientIp } from "@/lib/requestIp";
import { getRedis } from "@/lib/redisClient";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;
const DAILY_LIMIT_PER_IP = 5; // 荒らし・スパム対策（通常の問い合わせ用途では十分な回数）
const LIMIT_TTL_SEC = 60 * 60 * 36;

async function isRateLimited(ip: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const key = `contact_limit_${ip}_${new Date().toISOString().slice(0, 10)}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, LIMIT_TTL_SEC);
  return current > DAILY_LIMIT_PER_IP;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const replyTo = typeof body?.replyTo === "string" ? body.replyTo.trim() : undefined;
    const accountCode = typeof body?.accountCode === "string" ? body.accountCode.trim() : undefined;

    if (!message) {
      return NextResponse.json({ success: false, message: "お問い合わせ内容を入力してください。" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ success: false, message: "文字数が多すぎます。" }, { status: 400 });
    }

    const ip = getClientIp(req);
    if (await isRateLimited(ip)) {
      return NextResponse.json({ success: false, message: "送信回数の上限に達しました。時間をおいて再度お試しください。" }, { status: 429 });
    }

    const record = await createContactMessage({ message, replyTo, accountCode });
    if (!record) {
      return NextResponse.json({ success: false, message: "送信に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact API ERROR]", error);
    return NextResponse.json({ success: false, message: "システムエラーが発生しました。" }, { status: 500 });
  }
}
