// クライアント側（ブラウザ）専用の共通ユーティリティ。
// メイン画面（app/page.tsx）と管理画面（app/admin/reference-images/page.tsx）の両方から使用する。

import { generateAccountCode, normalizeAccountCode } from "./accountCode";

const DEV_KEY_STORAGE = "gemlens_dev_key";
const ACCOUNT_CODE_STORAGE = "gemlens_account_code";

// 仕入れ記録の「アイテム」欄で選択候補として表示するカテゴリ一覧。
// セカンドストリート等の大手リユースストアの実際のカテゴリ構成
// （メンズウェア/レディースウェア/バッグ/シューズ/服飾雑貨/キッズ/スポーツ/
// 楽器/家電/カメラ/ホビー/家具 等）を参考に、ジュエリー系の細かい分類は
// 維持しつつ、それ以外の商材も幅広くカバーできるようにしている。
// 「その他」を選ぶと自由入力欄が出る（<select>のカスタム入力代替）。
export const ITEM_CATEGORIES = [
  "メンズウェア",
  "レディースウェア",
  "キッズ・ベビー",
  "バッグ",
  "財布",
  "シューズ",
  "腕時計",
  "リング",
  "ネックレス",
  "ブレスレット",
  "アクセサリー",
  "帽子",
  "スポーツ・アウトドア",
  "楽器",
  "カメラ",
  "家電",
  "ホビー",
  "家具・インテリア",
  "その他",
];

export function activateDeveloperKeyFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const dev = params.get("dev");
    if (dev) {
      localStorage.setItem(DEV_KEY_STORAGE, dev);
      params.delete("dev");
      const cleanUrl =
        window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  } catch {
    // ignore
  }
}

export function getDeveloperKey(): string | undefined {
  try {
    return localStorage.getItem(DEV_KEY_STORAGE) || undefined;
  } catch {
    return undefined;
  }
}

export function resizeAndCompress(source: CanvasImageSource, srcW: number, srcH: number): string {
  const canvas = document.createElement("canvas");
  const MAX = 1200;
  let w = srcW;
  let h = srcH;
  if (w > h) {
    if (w > MAX) {
      h = Math.round((h * MAX) / w);
      w = MAX;
    }
  } else if (h > MAX) {
    w = Math.round((w * MAX) / h);
    h = MAX;
  }
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// ------------------------------------------------------------
//  履歴機能の復元コード（メール等の認証を使わず、端末間の引き継ぎ用に
//  ランダムなコードをlocalStorageに保存する。初回使用時に自動生成される）
// ------------------------------------------------------------
export function getAccountCode(): string | undefined {
  try {
    return localStorage.getItem(ACCOUNT_CODE_STORAGE) || undefined;
  } catch {
    return undefined;
  }
}

export function getOrCreateAccountCode(): string {
  const existing = getAccountCode();
  if (existing) return existing;

  const code = generateAccountCode();
  try {
    localStorage.setItem(ACCOUNT_CODE_STORAGE, code);
  } catch {
    // 保存できなくても、この場では一時的なコードとして使い続ける
  }
  return code;
}

export function setAccountCode(code: string): string {
  const normalized = normalizeAccountCode(code);
  try {
    localStorage.setItem(ACCOUNT_CODE_STORAGE, normalized);
  } catch {
    // ignore
  }
  return normalized;
}

export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(resizeAndCompress(img, img.width, img.height));
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
