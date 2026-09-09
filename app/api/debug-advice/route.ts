import { NextResponse } from "next/server";
import { callGeminiAdvice } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const result = await callGeminiAdvice("A BATHING APE");
  return NextResponse.json({ result });
}
