import { getRedis } from "./redisClient";

// 復元コード自体はクライアント側でランダム生成されるだけで、サーバー側には
// 「いつ発行されたか」を記録する仕組みが無かった。公式サイトの簡易マイページで
// 登録日を表示するために、初めて観測した日時をここで記録する。
function metaKey(accountCode: string): string {
  return `account_meta_${accountCode}`;
}

export async function getOrSetFirstSeenAt(accountCode: string): Promise<string> {
  const redis = getRedis();
  const now = new Date().toISOString();
  if (!redis) return now;

  const existing = await redis.get<string>(metaKey(accountCode));
  if (existing) return existing;

  // 同時アクセスで多少ズレて上書きされても実害が無いため、単純なnot-existsチェックで十分
  await redis.set(metaKey(accountCode), now);
  return now;
}
