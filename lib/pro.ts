import { getRedis } from "./redisClient";

// ------------------------------------------------------------
//  PROプラン判定
//  復元コード（accountCode）単位でStripeのサブスク状態をRedisに保存し、判定する。
//  スタンダード（¥500）: 1日のスキャン回数上限を撤廃するのみ
//  プレミアム（¥980）: 上記に加えてGoogle検索連携・画像類似検索など、
//  コストが発生する高精度判定機能を有効にする
// ------------------------------------------------------------

export type PlanLevel = "free" | "standard" | "premium";

export interface StoredProState {
  plan: "standard" | "premium";
  status: string; // Stripeのsubscription.statusをそのまま保存（active, trialing, past_due, canceled等）
  customerId: string;
  subscriptionId: string;
  currentPeriodEnd?: number; // unix seconds
}

export interface ProStatus {
  plan: PlanLevel;
  active: boolean;
  subscriptionStatus?: string;
  currentPeriodEnd?: number;
}

// 支払いが継続していると見なせるステータス（trialingも無料お試し中として機能フル解放する）
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function proKey(accountCode: string): string {
  return `pro_${accountCode}`;
}

export async function getProStatus(accountCode: string | undefined): Promise<ProStatus> {
  if (!accountCode) return { plan: "free", active: false };
  const redis = getRedis();
  if (!redis) return { plan: "free", active: false };

  const state = await redis.get<StoredProState>(proKey(accountCode));
  if (!state) return { plan: "free", active: false };

  const active = ACTIVE_STATUSES.has(state.status);
  return {
    plan: active ? state.plan : "free",
    active,
    subscriptionStatus: state.status,
    currentPeriodEnd: state.currentPeriodEnd,
  };
}

export async function setProState(accountCode: string, state: StoredProState): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(proKey(accountCode), state);
}

export async function getProStateByAccountCode(accountCode: string): Promise<StoredProState | null> {
  const redis = getRedis();
  if (!redis) return null;
  return (await redis.get<StoredProState>(proKey(accountCode))) ?? null;
}

export function hasUnlimitedScans(status: ProStatus): boolean {
  return status.active;
}

export function hasAdvancedMatching(status: ProStatus): boolean {
  return status.active && status.plan === "premium";
}
