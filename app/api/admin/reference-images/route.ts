import { NextRequest, NextResponse } from "next/server";
import { isDeveloperKey } from "../../../../lib/rateLimit";
import { embedImage } from "../../../../lib/embeddings";
import { upsertReferenceImage } from "../../../../lib/vectorStore";
import { verifyBrandTagImage } from "../../../../lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReferenceImageRequest {
  devKey?: string;
  brandName?: string;
  images?: string[];
  imageUrls?: string[];
}

type DownloadResult = { ok: true; base64: string } | { ok: false; reason: string };

async function downloadAsBase64(url: string): Promise<DownloadResult> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return { ok: false, reason: `画像形式ではありません（${contentType || "不明"}）` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) return { ok: false, reason: "ファイルサイズが小さすぎます" };
    if (buf.byteLength > 8 * 1024 * 1024) return { ok: false, reason: "ファイルサイズが大きすぎます" };
    return { ok: true, base64: Buffer.from(buf).toString("base64") };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "不明なエラー" };
  }
}

async function saveImage(brandName: string, base64Image: string, sourceUrl: string, index: number): Promise<void> {
  const vector = await embedImage(base64Image);
  await upsertReferenceImage(`${brandName}__manual__${Date.now()}__${index}`, vector, { brandName, sourceUrl });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ReferenceImageRequest;

  if (!isDeveloperKey(body.devKey)) {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }

  const brandName = body.brandName?.trim();
  const images = body.images ?? [];
  const imageUrls = (body.imageUrls ?? []).map((u) => u.trim()).filter(Boolean);
  if (!brandName || (images.length === 0 && imageUrls.length === 0)) {
    return NextResponse.json({ success: false, message: "ブランド名と画像が必要です" }, { status: 400 });
  }

  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];
  const total = images.length + imageUrls.length;
  let index = 0;

  for (const image of images) {
    try {
      await saveImage(brandName, image, "manual-upload", index);
      saved++;
    } catch (e) {
      errors.push(`画像${index + 1}: ${e instanceof Error ? e.message : "不明なエラー"}`);
    }
    index++;
  }

  for (const url of imageUrls) {
    try {
      const downloaded = await downloadAsBase64(url);
      if (!downloaded.ok) {
        errors.push(`${url}: ${downloaded.reason}`);
        index++;
        continue;
      }
      const base64 = downloaded.base64;
      const verified = await verifyBrandTagImage(brandName, base64);
      if (!verified) {
        skipped++;
        index++;
        continue;
      }
      await saveImage(brandName, base64, url, index);
      saved++;
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : "不明なエラー"}`);
    }
    index++;
  }

  return NextResponse.json({ success: saved > 0, saved, skipped, total, errors });
}
