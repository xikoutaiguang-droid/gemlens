// ------------------------------------------------------------
//  PROプラン判定（簡易スタブ）
//  本番リリース時、コストが発生するAI機能（Google検索連携など）を
//  PRO会員限定にするための入口。現時点では決済・会員基盤が無いため、
//  PRO_TIER_ENABLED = false の間は全ユーザーにフル機能を提供する。
// ------------------------------------------------------------
export const PRO_TIER_ENABLED = false; // 本番リリース準備ができたら true に切替

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 本番実装時にPRO判定へ差し替える想定のスタブ引数
export function isProUser(_deviceId: string | undefined): boolean {
  if (!PRO_TIER_ENABLED) return true; // テスト段階：全員フル機能
  // TODO: 本番実装時、実際の会員・決済ステータスをここで判定する
  return false;
}
