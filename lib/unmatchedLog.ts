import { getRedis } from "./redisClient";

// 判定できなかったタグの読み取り結果を記録する。
// 「DBに無いブランド」は無限にあるが、実際にユーザーが遭遇したものには偏りがある。
// 出現回数の多い順に並べれば、DBへ優先的に追加すべきブランドがそのまま分かる。
const KEY = "unmatched_reads";
const MAX_LEN = 80;

export async function recordUnmatchedRead(text: string | undefined): Promise<void> {
  const redis = getRedis();
  if (!redis || !text) return;

  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  if (cleaned.length < 2) return;

  try {
    await redis.zincrby(KEY, 1, cleaned);
  } catch (e) {
    // 記録は補助的な機能なので、失敗してもスキャン自体は成功させる
    console.error("[unmatchedLog] failed", e);
  }
}

export async function listUnmatchedReads(limit = 50): Promise<{ text: string; count: number }[]> {
  const redis = getRedis();
  if (!redis) return [];
  const rows = await redis.zrange<(string | number)[]>(KEY, 0, limit - 1, { rev: true, withScores: true });
  const out: { text: string; count: number }[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    out.push({ text: String(rows[i]), count: Number(rows[i + 1]) });
  }
  return out;
}
