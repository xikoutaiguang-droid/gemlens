import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") || "A BATHING APE";
  const key = process.env.GEMINI_API_KEY;

  const prompt = `「${brand}」について、古着店スタッフ向けに以下をJSON形式のみで返してください。{"popularItems":"人気アイテム3個","marketValue":"アイテム名：安め1000円／平均2000円／高値3000円"}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
    tools: [{ google_search: {} }],
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return NextResponse.json({
      keyPresent: !!key,
      keyLength: key?.length ?? 0,
      httpStatus: res.status,
      httpOk: res.ok,
      bodyPreview: text.slice(0, 1500),
    });
  } catch (e) {
    return NextResponse.json({
      keyPresent: !!key,
      keyLength: key?.length ?? 0,
      threw: true,
      error: String(e),
    });
  }
}
