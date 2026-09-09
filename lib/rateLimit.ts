import { Redis } from "@upstash/redis";

// ------------------------------------------------------------
//  1日あたりの無料利用回数の上限（端末単位）
// ------------------------------------------------------------
const DAILY_FREE_LIMIT = 10;

export interface UsageResult {
  allowed: boolean;
  count: number;
  limit: number;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // Redis.fromEnv()は未設定でも例外を投げず壊れたクライアントを返すため、事前に判定する
  return new Redis({ url, token });
}

function todayJst(): string {
  // YYYY-MM-DD (JST) をタイムゾーン依存なく取得
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).replace(/-/g, "");
}

export async function checkAndIncrementUsage(deviceId: string | undefined): Promise<UsageResult> {
  const id = deviceId || "anonymous";
  const key = `usage_${id}_${todayJst()}`;

  const redis = getRedis();
  if (!redis) {
    // Redis未設定（ローカル開発など）の場合はレート制限をスキップする
    console.warn("[rateLimit] Redis未設定のためレート制限をスキップします");
    return { allowed: true, count: 1, limit: DAILY_FREE_LIMIT };
  }

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 60 * 60 * 36); // 36時間で自動失効（日またぎの余裕を持たせる）
  }

  if (current > DAILY_FREE_LIMIT) {
    return { allowed: false, count: current, limit: DAILY_FREE_LIMIT };
  }
  return { allowed: true, count: current, limit: DAILY_FREE_LIMIT };
}
