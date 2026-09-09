export interface BrandEntry {
  brandName: string;
  kana: string;
  keywords: string[];
  rank: string;
  info: string;
  parentBrand: string;
}

export function norm(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str).toLowerCase().replace(/\s+/g, "").trim();
}

// 大文字小文字・空白・&/-/.等の記号ゆれを許容する強めの正規化
export function normLoose(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .toLowerCase()
    .replace(/[\s&\-.,'’]/g, "")
    .trim();
}

export function matchBrandName(rawName: string, brandEntries: BrandEntry[]): BrandEntry | null {
  const normRaw = normLoose(rawName);
  return brandEntries.find((e) => normLoose(e.brandName) === normRaw) ?? null;
}

// ブランド固有の誤読パターンではない、タグに一般的に登場する単語・定型句。
// これらがキーワード登録されていても照合には使わない（誤爆防止の安全網）。
const GENERIC_KEYWORD_BLOCKLIST = [
  "california", "usa", "japan", "italy", "france", "uk", "england", "belgium",
  "germany", "portugal", "spain",
  "newyork", "paris", "london", "tokyo", "osaka",
  "bologna", "parma", "milan", "milano", "florence", "firenze", "venice", "venezia",
  "turin", "torino", "rome", "roma", "naples", "antwerp", "brussels",
  "since", "established", "est",
  "cotton", "wool", "linen", "silk", "denim", "leather",
  "collection", "select", "selectshop", "flagship", "authentic", "original",
];

// 「MADE IN USA」「EST 1947」「SINCE 1976」のような定型句は、
// 国名・年号だけが変わる形でどのブランドのタグにも登場しうるため、
// パターンでまとめて除外する。
function isGenericKeyword(rawKw: string): boolean {
  const s = rawKw.trim().toLowerCase();
  if (!s) return true;
  if (GENERIC_KEYWORD_BLOCKLIST.includes(s.replace(/\s+/g, ""))) return true;
  if (/^est\.?\s*\d{3,4}$/.test(s)) return true;
  if (/^since\s*\d{3,4}$/.test(s)) return true;
  if (/^made\s*in\s+[a-z]+$/.test(s)) return true;
  return false;
}

export function matchByKeywords(rawText: string | null, brandEntries: BrandEntry[]): BrandEntry | null {
  if (!rawText) return null;

  const normText = norm(rawText);
  let best: BrandEntry | null = null;
  let bestLen = 0;

  for (const entry of brandEntries) {
    for (const kw of entry.keywords) {
      if (isGenericKeyword(kw)) continue;
      const normKw = norm(kw);
      if (normKw.length < 3) continue;
      if (normText.includes(normKw) && normKw.length > bestLen) {
        best = entry;
        bestLen = normKw.length;
      }
    }
  }

  return best;
}
