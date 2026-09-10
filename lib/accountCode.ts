// 履歴機能の「復元コード」まわりの純粋関数。
// クライアント（lib/clientUtils.ts）とサーバー（lib/history.ts、APIルート）の両方から使うため、
// ブラウザAPI・Redisへの依存を持たない。

// 0/O/1/I/L を除外し、手入力・読み上げ時の誤認識を防ぐ
export const ACCOUNT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ACCOUNT_CODE_LENGTH = 12;

export function generateAccountCode(): string {
  let code = "";
  for (let i = 0; i < ACCOUNT_CODE_LENGTH; i++) {
    code += ACCOUNT_CODE_ALPHABET[Math.floor(Math.random() * ACCOUNT_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeAccountCode(raw: string): string {
  return raw.toUpperCase().replace(new RegExp(`[^${ACCOUNT_CODE_ALPHABET}]`, "g"), "");
}

export function isValidAccountCode(code: string): boolean {
  return code.length === ACCOUNT_CODE_LENGTH && new RegExp(`^[${ACCOUNT_CODE_ALPHABET}]+$`).test(code);
}

// 表示専用（XXXX-XXXX-XXXX）。保存・送信にはこの形式を使わない。
export function formatAccountCodeForDisplay(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}
