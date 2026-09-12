import { getRedis } from "./redisClient";

export interface ContactMessage {
  id: string;
  message: string;
  replyTo?: string;
  accountCode?: string;
  createdAt: string; // ISO日時
}

const CONTACT_KEY = "contact_messages";
const MAX_MESSAGES = 500; // 無制限に溜め続けないよう上限を設ける（古いものから捨てる）

export async function createContactMessage(input: {
  message: string;
  replyTo?: string;
  accountCode?: string;
}): Promise<ContactMessage | null> {
  const redis = getRedis();
  if (!redis) return null;

  const record: ContactMessage = {
    id: crypto.randomUUID(),
    message: input.message,
    replyTo: input.replyTo,
    accountCode: input.accountCode,
    createdAt: new Date().toISOString(),
  };

  const records = (await redis.get<ContactMessage[]>(CONTACT_KEY)) ?? [];
  records.push(record);
  // 古いものから捨てて上限を維持する
  const trimmed = records.length > MAX_MESSAGES ? records.slice(records.length - MAX_MESSAGES) : records;
  await redis.set(CONTACT_KEY, trimmed);
  return record;
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const redis = getRedis();
  if (!redis) return [];
  const records = (await redis.get<ContactMessage[]>(CONTACT_KEY)) ?? [];
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteContactMessage(id: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const records = (await redis.get<ContactMessage[]>(CONTACT_KEY)) ?? [];
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length === records.length) return false;
  await redis.set(CONTACT_KEY, filtered);
  return true;
}
