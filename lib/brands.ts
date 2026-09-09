import { google } from "googleapis";
import type { BrandEntry } from "./matching";

const SHEET_NAME = "データベース";
const RANGE = `${SHEET_NAME}!A2:F`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分キャッシュ（サーバーレスのウォームインスタンス間で有効）

let cache: { data: BrandEntry[]; fetchedAt: number } | null = null;

function getAuth() {
  // 優先: ダウンロードしたサービスアカウントJSONの中身をまるごと1つの環境変数に貼る方式
  // （Vercelの環境変数UIに改行込みで貼り付けるだけで済み、設定ミスが起きにくい）
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (rawJson) {
    const parsed = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEYの形式が不正です");
    }
    return new google.auth.JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }

  // フォールバック: email/private_keyを個別の環境変数として設定する方式
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) {
    throw new Error("Googleサービスアカウントの環境変数が未設定です");
  }
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// スプレッドシート「データベース」からブランドエントリー一覧を読み込む
export async function loadBrandEntries(): Promise<BrandEntry[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID未設定");

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: RANGE });
  const rows = res.data.values ?? [];

  const brandEntries: BrandEntry[] = [];
  for (const row of rows) {
    const brandName = (row[0] ?? "").toString().trim();
    const kana = (row[1] ?? "").toString().trim();
    const keywordsRaw = (row[2] ?? "").toString().trim();
    const rank = (row[3] ?? "").toString().trim();
    const info = (row[4] ?? "").toString().trim();
    const parentBrand = (row[5] ?? "").toString().trim();

    const keywords = keywordsRaw
      ? keywordsRaw.split(",").map((k: string) => k.trim()).filter(Boolean)
      : [];

    if (brandName) brandEntries.push({ brandName, kana, keywords, rank, info, parentBrand });
  }

  cache = { data: brandEntries, fetchedAt: Date.now() };
  return brandEntries;
}
