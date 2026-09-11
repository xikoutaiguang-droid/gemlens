import { getRedis } from "./redisClient";

export interface HistoryRecord {
  id: string;
  brandName: string;
  kana?: string;
  item?: string;
  photo?: string; // 圧縮済みサムネイル（data URL）
  purchasePrice?: number;
  salePrice?: number;
  purchasedAt?: string; // YYYY-MM-DD、編集可能
  soldAt?: string; // YYYY-MM-DD、編集可能
  createdAt: string; // ISO日時、記録作成時刻（並び替え用、表示はしない）
  memo?: string;
}

function historyKey(accountCode: string): string {
  return `history_${accountCode}`;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listHistory(accountCode: string): Promise<HistoryRecord[]> {
  const redis = getRedis();
  if (!redis) return [];
  const records = (await redis.get<HistoryRecord[]>(historyKey(accountCode))) ?? [];
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface CreateHistoryInput {
  brandName: string;
  kana?: string;
  item?: string;
  photo?: string;
  purchasePrice?: number;
  memo?: string;
}

// 同一アカウントから複数リクエストがほぼ同時に来た場合、Read-Modify-Writeのため
// 後勝ちで片方の更新が失われる可能性がある。個人利用（実質1端末ずつの操作）が前提のため許容する。
export async function createHistoryRecord(
  accountCode: string,
  input: CreateHistoryInput
): Promise<HistoryRecord | null> {
  const redis = getRedis();
  if (!redis) return null;

  const key = historyKey(accountCode);
  const records = (await redis.get<HistoryRecord[]>(key)) ?? [];
  const record: HistoryRecord = {
    id: crypto.randomUUID(),
    brandName: input.brandName,
    kana: input.kana,
    item: input.item,
    photo: input.photo,
    purchasePrice: input.purchasePrice,
    purchasedAt: todayDateString(),
    createdAt: new Date().toISOString(),
    memo: input.memo,
  };
  records.push(record);
  await redis.set(key, records);
  return record;
}

export interface UpdateHistoryInput {
  item?: string | null;
  photo?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  purchasedAt?: string | null;
  soldAt?: string | null;
  memo?: string | null;
}

// undefinedのフィールドは「変更しない」、nullは「クリアする」という3値の区別を持つ。
// 仕入れ日・売却日はユーザーが直接編集できる項目のため、指定があればそれを優先する。
// ただし売却値だけが新たに設定され売却日が指定されなかった場合は、月次集計等が
// 売却日を基準に計算するため、今日の日付を既定値として補う。
export async function updateHistoryRecord(
  accountCode: string,
  id: string,
  patch: UpdateHistoryInput
): Promise<HistoryRecord | null> {
  const redis = getRedis();
  if (!redis) return null;

  const key = historyKey(accountCode);
  const records = (await redis.get<HistoryRecord[]>(key)) ?? [];
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = records[index];
  const wasSold = current.salePrice != null;

  if (patch.item !== undefined) current.item = patch.item ?? undefined;
  if (patch.photo !== undefined) current.photo = patch.photo ?? undefined;
  if (patch.purchasePrice !== undefined) current.purchasePrice = patch.purchasePrice ?? undefined;
  if (patch.purchasedAt !== undefined) current.purchasedAt = patch.purchasedAt ?? undefined;
  if (patch.memo !== undefined) current.memo = patch.memo ?? undefined;

  if (patch.salePrice !== undefined) current.salePrice = patch.salePrice ?? undefined;
  if (patch.soldAt !== undefined) {
    current.soldAt = patch.soldAt ?? undefined;
  } else if (!wasSold && current.salePrice != null) {
    current.soldAt = todayDateString();
  }

  records[index] = current;
  await redis.set(key, records);
  return current;
}

export async function deleteHistoryRecord(accountCode: string, id: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const key = historyKey(accountCode);
  const records = (await redis.get<HistoryRecord[]>(key)) ?? [];
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length === records.length) return false;
  await redis.set(key, filtered);
  return true;
}
