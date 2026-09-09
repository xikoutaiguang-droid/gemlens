// ブランドタグの参照画像をWebから自動収集し、Gemini検証を通過したものを
// ベクトル化してUpstash Vectorに保存する管理者向けCLIツール。
//
// 使い方: npx tsx scripts/collect-reference-images.ts "SAINT MICHAEL"
//
// GAS版のBrandDraftGenerator.gs（下書き生成→人の目で確認→データベースへ反映）と
// 同じ思想で、収集自体は自動化しつつ、Gemini検証で明らかに無関係な画像を除外する。
import "dotenv/config";
import { searchBrandTagImages } from "../lib/customSearch";
import { embedImage } from "../lib/embeddings";
import { upsertReferenceImage } from "../lib/vectorStore";

const GEMINI_MODEL = "gemini-2.5-flash";

async function verifyImage(brandName: string, base64Image: string): Promise<boolean> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY未設定");

  const prompt = [
    `この画像は「${brandName}」というアパレルブランドのタグ・ラベル・ロゴ・エンブレムが`,
    "はっきり写っている写真ですか？",
    "人物のスナップ写真、風景、他ブランドの商品、通販サイトのバナー・広告画像、",
    "無関係なイラストなどの場合は「いいえ」と答えてください。",
    "「はい」か「いいえ」のみで、余計な説明なしに答えてください。",
  ].join("");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inline_data: { mime_type: "image/jpeg", data: base64Image } }, { text: prompt }],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );

  if (!res.ok) return false;
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text.includes("はい");
}

async function downloadAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000 || buf.byteLength > 8 * 1024 * 1024) return null; // 極端に小さい/大きい画像は除外
    return Buffer.from(buf).toString("base64");
  } catch {
    return null;
  }
}

async function main() {
  const brandName = process.argv[2];
  if (!brandName) {
    console.error('使い方: npx tsx scripts/collect-reference-images.ts "ブランド名"');
    process.exit(1);
  }

  console.log(`[${brandName}] 画像検索中...`);
  const results = await searchBrandTagImages(brandName, 10);
  console.log(`[${brandName}] ${results.length}件の候補画像を取得`);

  let saved = 0;
  for (const [i, item] of results.entries()) {
    console.log(`  (${i + 1}/${results.length}) ${item.imageUrl}`);

    const base64 = await downloadAsBase64(item.imageUrl);
    if (!base64) {
      console.log("    -> ダウンロード失敗またはサイズ不適、スキップ");
      continue;
    }

    const verified = await verifyImage(brandName, base64);
    if (!verified) {
      console.log("    -> Gemini検証NG（無関係な画像と判定）、スキップ");
      continue;
    }

    const vector = await embedImage(base64);
    await upsertReferenceImage(`${brandName}__${i}__${Date.now()}`, vector, {
      brandName,
      sourceUrl: item.imageUrl,
    });
    saved++;
    console.log("    -> 保存完了");
  }

  console.log(`[${brandName}] 完了。${saved}/${results.length}件を参照画像として保存しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
