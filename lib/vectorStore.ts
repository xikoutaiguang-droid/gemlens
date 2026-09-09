import { Index } from "@upstash/vector";

interface ReferenceMetadata extends Record<string, unknown> {
  brandName: string;
  sourceUrl?: string;
}

function getIndex(): Index<ReferenceMetadata> | null {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) return null;
  return new Index<ReferenceMetadata>({ url, token });
}

export async function upsertReferenceImage(
  id: string,
  vector: number[],
  metadata: ReferenceMetadata
): Promise<void> {
  const index = getIndex();
  if (!index) throw new Error("Upstash Vectorの環境変数が未設定です");
  await index.upsert({ id, vector, metadata });
}

export interface VectorMatch {
  brandName: string;
  score: number;
  sourceUrl?: string;
}

// 画像ベクトルから類似度の高い参照画像（＝ブランド候補）を検索する
export async function queryReferenceImages(vector: number[], topK = 5): Promise<VectorMatch[]> {
  const index = getIndex();
  if (!index) return []; // 未設定時はこの機能自体をスキップする（本体機能に影響させない）

  const results = await index.query({ vector, topK, includeMetadata: true });
  return results
    .filter((r) => r.metadata?.brandName)
    .map((r) => ({
      brandName: String(r.metadata!.brandName),
      score: r.score,
      sourceUrl: r.metadata?.sourceUrl,
    }));
}
