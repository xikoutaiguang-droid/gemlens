import { Redis } from "@upstash/redis";

// ------------------------------------------------------------
//  1日あたりの無料利用回数の上限（端末単位）
// ------------------------------------------------------------
const DAILY_FREE_LIMIT = 10;
const KEY_TTL_SEC = 60 * 60 * 36; // 36時間で自動失効（日またぎの余裕を持たせる）

export interface UsageResult {
  allowed: boolean;
  count: number;
  limit: number;
  isDeveloper: boolean;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // Redis.fromEnv()は未設定でも例外を投げず壊れたクライアントを返すため、事前に判定する
  return new Redis({ url, token });
}

function todayJst(): string {
  // YYYY-MM-DD (JST) をタイムゾーン依存なく取得。日付が変わる＝キーが変わる＝実質「毎日0時にリセット」
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).replace(/-/g, "");
}

function usageKey(deviceId: string | undefined): string {
  const id = deviceId || "anonymous";
  return `usage_${id}_${todayJst()}`;
}

// 開発者キー判定（Vercel環境変数 DEVELOPER_KEY と一致するかどうか）
export function isDeveloperKey(devKey: string | undefined): boolean {
  const secret = process.env.DEVELOPER_KEY;
  return !!secret && !!devKey && devKey === secret;
}

// 現在の利用回数を消費せずに確認する（画面表示の初期値取得用）
export async function peekUsage(deviceId: string | undefined, devKey: string | undefined): Promise<UsageResult> {
  const isDeveloper = isDeveloperKey(devKey);
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, count: 0, limit: DAILY_FREE_LIMIT, isDeveloper };
  }
  const current = (await redis.get<number>(usageKey(deviceId))) ?? 0;
  return { allowed: current < DAILY_FREE_LIMIT, count: current, limit: DAILY_FREE_LIMIT, isDeveloper };
}

export async function checkAndIncrementUsage(
  deviceId: string | undefined,
  devKey: string | undefined
): Promise<UsageResult> {
  const isDeveloper = isDeveloperKey(devKey);
  const key = usageKey(deviceId);

  const redis = getRedis();
  if (!redis) {
    // Redis未設定（ローカル開発など）の場合はレート制限をスキップする
    console.warn("[rateLimit] Redis未設定のためレート制限をスキップします");
    return { allowed: true, count: 1, limit: DAILY_FREE_LIMIT, isDeveloper };
  }

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, KEY_TTL_SEC);
  }

  if (current > DAILY_FREE_LIMIT) {
    if (isDeveloper) {
      // 開発者は上限に達したら自動的にカウントをリセットして使い続けられるようにする
      await redis.set(key, 1, { ex: KEY_TTL_SEC });
      return { allowed: true, count: 1, limit: DAILY_FREE_LIMIT, isDeveloper };
    }
    return { allowed: false, count: current, limit: DAILY_FREE_LIMIT, isDeveloper };
  }
  return { allowed: true, count: current, limit: DAILY_FREE_LIMIT, isDeveloper };
}
