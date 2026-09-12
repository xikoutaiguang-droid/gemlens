import { getRedis } from "./redisClient";

// ------------------------------------------------------------
//  1日あたりの無料利用回数の上限（IPアドレス単位）
// ------------------------------------------------------------
// キーをクライアント側のdeviceId（localStorage）にすると、シークレットモード・
// iOSの「ホーム画面に追加」・サイトデータ削除などで簡単にリセットされてしまい、
// 無料枠制限が実効性を持たない（実際に指摘を受けた）。
// サーバー側で観測するIPアドレスは上記の操作では変わらないため、これを主キーにする。
// 同一Wi-Fi/回線を共有する複数ユーザーが枠を共有してしまう副作用はあるが、
// ログイン不要の匿名利用を維持したまま悪用を防ぐための現実的な妥協点として採用する。
export const DAILY_FREE_LIMIT = 10;
const KEY_TTL_SEC = 60 * 60 * 36; // 36時間で自動失効（日またぎの余裕を持たせる）

export interface UsageResult {
  allowed: boolean;
  count: number;
  limit: number;
  isDeveloper: boolean;
}

function todayJst(): string {
  // YYYY-MM-DD (JST) をタイムゾーン依存なく取得。日付が変わる＝キーが変わる＝実質「毎日0時にリセット」
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).replace(/-/g, "");
}

function usageKey(ip: string): string {
  return `usage_${ip}_${todayJst()}`;
}

// 開発者キー判定（Vercel環境変数 DEVELOPER_KEY と一致するかどうか）
export function isDeveloperKey(devKey: string | undefined): boolean {
  const secret = process.env.DEVELOPER_KEY;
  return !!secret && !!devKey && devKey === secret;
}

// 現在の利用回数を消費せずに確認する（画面表示の初期値取得用）
export async function peekUsage(ip: string, devKey: string | undefined): Promise<UsageResult> {
  const isDeveloper = isDeveloperKey(devKey);
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, count: 0, limit: DAILY_FREE_LIMIT, isDeveloper };
  }
  const current = (await redis.get<number>(usageKey(ip))) ?? 0;
  return { allowed: current < DAILY_FREE_LIMIT, count: current, limit: DAILY_FREE_LIMIT, isDeveloper };
}

export async function checkAndIncrementUsage(ip: string, devKey: string | undefined): Promise<UsageResult> {
  const isDeveloper = isDeveloperKey(devKey);
  const key = usageKey(ip);

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
