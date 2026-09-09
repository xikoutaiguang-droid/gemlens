import { NextRequest, NextResponse } from "next/server";
import { callGeminiAdvice } from "@/lib/gemini";
import { loadBrandEntries } from "@/lib/brands";
import { norm } from "@/lib/matching";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") || "A BATHING APE";
  const t0 = Date.now();

  const brandEntries = await loadBrandEntries();
  const t1 = Date.now();

  const normGemini = norm(brand);
  const matched = brandEntries.filter((e) => norm(e.brandName) === normGemini);
  const entry = matched[0];

  const marketInfo = entry ? await callGeminiAdvice(entry.brandName) : null;
  const t2 = Date.now();

  return NextResponse.json({
    brand,
    matchedEntry: entry ? { brandName: entry.brandName, kana: entry.kana } : null,
    marketInfo,
    timingMs: { loadBrandEntries: t1 - t0, callGeminiAdvice: t2 - t1, total: t2 - t0 },
  });
}
