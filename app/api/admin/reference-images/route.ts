import { NextRequest, NextResponse } from "next/server";
import { isDeveloperKey } from "../../../../lib/rateLimit";
import { embedImage } from "../../../../lib/embeddings";
import { upsertReferenceImage } from "../../../../lib/vectorStore";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReferenceImageRequest {
  devKey?: string;
  brandName?: string;
  images?: string[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ReferenceImageRequest;

  if (!isDeveloperKey(body.devKey)) {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }

  const brandName = body.brandName?.trim();
  const images = body.images ?? [];
  if (!brandName || images.length === 0) {
    return NextResponse.json({ success: false, message: "ブランド名と画像が必要です" }, { status: 400 });
  }

  let saved = 0;
  const errors: string[] = [];

  for (const [i, image] of images.entries()) {
    try {
      const vector = await embedImage(image);
      await upsertReferenceImage(`${brandName}__manual__${Date.now()}__${i}`, vector, {
        brandName,
        sourceUrl: "manual-upload",
      });
      saved++;
    } catch (e) {
      console.error("[admin/reference-images] failed", e);
      errors.push(`画像${i + 1}: ${e instanceof Error ? e.message : "不明なエラー"}`);
    }
  }

  return NextResponse.json({ success: saved > 0, saved, total: images.length, errors });
}
