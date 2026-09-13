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
// 広告視聴1回につき+1枚、1日あたりこの回数まで無料枠に上乗せできる。
export const DAILY_AD_BONUS_LIMIT = 3;
const KEY_TTL_SEC = 60 * 60 * 36; // 36時間で自動失効（日またぎの余裕を持たせる）

export interface UsageResult {
  allowed: boolean;
  count: number;
  limit: number; // 実質上限（無料枠 + 獲得済みの広告ボーナス）
  adBonus: number; // 本日すでに獲得済みの広告ボーナス回数
  adBonusLimit: number; // 広告ボーナスの1日の上限
  isDeveloper: boolean;
}

function todayJst(): string {
  // YYYY-MM-DD (JST) をタイムゾーン依存なく取得。日付が変わる＝キーが変わる＝実質「毎日0時にリセット」
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).replace(/-/g, "");
}

function usageKey(ip: string): string {
  return `usage_${ip}_${todayJst()}`;
}

function adBonusKey(ip: string): string {
  return `adbonus_${ip}_${todayJst()}`;
}

async function getAdBonus(ip: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  return (await redis.get<number>(adBonusKey(ip))) ?? 0;
}

// 広告視聴完了後に呼び出し、当日の無料枠を+1する。
// 1日の上限（DAILY_AD_BONUS_LIMIT）に達している場合は付与しない。
//
// 注意（既知の制約）: このAPIは「広告を実際に最後まで視聴したか」をサーバー側で
// 検証していない（クライアントが広告SDKの視聴完了イベントを受けてこのAPIを叩くだけ）。
// 本来はGoogle Ad ManagerのServer-Side Verification（SSV）コールバックで検証すべきだが、
// 広告アカウント自体が未開設のため現時点では実装できない。
// ただし1日3回という上限自体があるため、悪用されても影響は「1日+3枚」に限定される。
export async function grantAdBonus(ip: string): Promise<{ granted: boolean; adBonus: number; adBonusLimit: number }> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[rateLimit] Redis未設定のため広告ボーナスをスキップします");
    return { granted: false, adBonus: 0, adBonusLimit: DAILY_AD_BONUS_LIMIT };
  }

  const current = await getAdBonus(ip);
  if (current >= DAILY_AD_BONUS_LIMIT) {
    return { granted: false, adBonus: current, adBonusLimit: DAILY_AD_BONUS_LIMIT };
  }

  const key = adBonusKey(ip);
  const updated = await redis.incr(key);
  if (updated === 1) {
    await redis.expire(key, KEY_TTL_SEC);
  }
  return { granted: true, adBonus: updated, adBonusLimit: DAILY_AD_BONUS_LIMIT };
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
    return { allowed: true, count: 0, limit: DAILY_FREE_LIMIT, adBonus: 0, adBonusLimit: DAILY_AD_BONUS_LIMIT, isDeveloper };
  }
  const [current, adBonus] = await Promise.all([
    redis.get<number>(usageKey(ip)).then((v) => v ?? 0),
    getAdBonus(ip),
  ]);
  const limit = DAILY_FREE_LIMIT + adBonus;
  return { allowed: current < limit, count: current, limit, adBonus, adBonusLimit: DAILY_AD_BONUS_LIMIT, isDeveloper };
}

export async function checkAndIncrementUsage(ip: string, devKey: string | undefined): Promise<UsageResult> {
  const isDeveloper = isDeveloperKey(devKey);
  const key = usageKey(ip);

  const redis = getRedis();
  if (!redis) {
    // Redis未設定（ローカル開発など）の場合はレート制限をスキップする
    console.warn("[rateLimit] Redis未設定のためレート制限をスキップします");
    return { allowed: true, count: 1, limit: DAILY_FREE_LIMIT, adBonus: 0, adBonusLimit: DAILY_AD_BONUS_LIMIT, isDeveloper };
  }

  const adBonus = await getAdBonus(ip);
  const limit = DAILY_FREE_LIMIT + adBonus;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, KEY_TTL_SEC);
  }

  if (current > limit) {
    if (isDeveloper) {
      // 開発者は上限に達したら自動的にカウントをリセットして使い続けられるようにする
      await redis.set(key, 1, { ex: KEY_TTL_SEC });
      return { allowed: true, count: 1, limit, adBonus, adBonusLimit: DAILY_AD_BONUS_LIMIT, isDeveloper };
    }
    return { allowed: false, count: current, limit, adBonus, adBonusLimit: DAILY_AD_BONUS_LIMIT, isDeveloper };
  }
  return { allowed: true, count: current, limit, adBonus, adBonusLimit: DAILY_AD_BONUS_LIMIT, isDeveloper };
}
