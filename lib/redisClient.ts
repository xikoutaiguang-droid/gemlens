import { Redis } from "@upstash/redis";

// Redis.fromEnv()は未設定でも例外を投げず壊れたクライアントを返すため、事前に判定する。
// VercelのUpstash連携は`KV_REST_API_URL`/`KV_REST_API_TOKEN`という名前で環境変数を作成するため、
// 従来のUpstashネイティブな命名（UPSTASH_REDIS_REST_*）と両方に対応する。
export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}
