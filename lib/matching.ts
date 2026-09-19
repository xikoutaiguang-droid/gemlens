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

// "+"は「PLUS」の略記として使われることがある（例：タグ表記「BEAMS+」⇔ DB表記「BEAMS PLUS」）。
// OCRがどちらの表記で読み取っても同一ブランドとして解決できるよう、
// 完全一致に失敗した場合のみ「+」→「plus」変換した上でも比較する。
// 全角「＋」（U+FF0B）で読み取られるケースも吸収する。
export function normPlusVariant(s: string): string {
  return normLoose(s).replace(/[+＋]/g, "plus");
}

export function matchBrandName(rawName: string, brandEntries: BrandEntry[]): BrandEntry | null {
  const normRaw = normLoose(rawName);
  const exact = brandEntries.find((e) => normLoose(e.brandName) === normRaw) ?? null;
  if (exact) return exact;

  const normRawPlus = normPlusVariant(rawName);
  return brandEntries.find((e) => normPlusVariant(e.brandName) === normRawPlus) ?? null;
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
  // 素材表示（組成ラベルに必ず載る）
  "rayon", "polyester", "acrylic", "nylon", "spandex", "elastane", "viscose", "cashmere",
  // 色名
  "black", "white", "blue", "green", "red", "gold", "silver", "navy", "beige", "khaki",
  // 品質・製法・販売形態を表す一般語
  "handmade", "vintage", "exclusive", "limited", "edition", "company",
  "sport", "sports", "style", "simple", "studio", "world", "quality", "premium",
  "classic", "standard", "natural", "basic", "product", "products", "garment",
];

// 「MADE IN USA」「EST 1947」「SINCE 1976」のような定型句は、
// 国名・年号だけが変わる形でどのブランドのタグにも登場しうるため、
// パターンでまとめて除外する。
function isGenericKeyword(rawKw: string): boolean {
  const s = rawKw.trim().toLowerCase();
  if (!s) return true;
  // ブロックリストとの突き合わせは、実際の照合で使うのと同じ正規化で行う。
  // （「EDITION.」「EDIT ION」のような記号・空白の変種も同じ一般語として弾くため）
  if (GENERIC_KEYWORD_BLOCKLIST.includes(tokenize(s).join(""))) return true;
  if (/^est\.?\s*\d{3,4}$/.test(s)) return true;
  if (/^since\s*\d{3,4}$/.test(s)) return true;
  if (/^made\s*in\s+[a-z]+$/.test(s)) return true;
  return false;
}

// キーワード照合は、単語の途中で部分一致させてはならない。
// 例：S'YTEの誤読パターンとして登録された「SENT」は、洗濯表示に頻出する
// 「esSENTial」の内部にも含まれるため、素朴な部分文字列検索では大量に誤爆する
// （同様に ARMEN⊂gARMENt、LIMIT⊂LIMITed、PROD⊂PRODuct）。
// そこで空白・記号を区切りとしたトークン列に分解し、
// キーワードが「トークンの連続した並びとして現れる」場合のみ一致とみなす。
export function tokenize(str: unknown): string[] {
  if (str === null || str === undefined) return [];
  return String(str)
    .toLowerCase()
    .replace(/['’.,]/g, "") // 「S'YTE」「S.Y.T.E」は語中の記号なので詰めて1語にする
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g, " ") // それ以外の記号・空白は区切り
    .split(/\s+/)
    .filter(Boolean);
}

function tokensContainSequence(textTokens: string[], kwTokens: string[]): boolean {
  if (kwTokens.length === 0 || kwTokens.length > textTokens.length) return false;
  for (let i = 0; i + kwTokens.length <= textTokens.length; i++) {
    let matched = true;
    for (let j = 0; j < kwTokens.length; j++) {
      if (textTokens[i + j] !== kwTokens[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

// 系列ブランド（例：BEAMS → BEAMS PLUS）は、親ブランド名が子ブランド名の
// 先頭または末尾に「単語として」現れる場合にのみ成立するとみなす。
// 綴りの一部が一致するだけで判定すると、AMI→AMIRI、BAL→BALENCIAGA、
// On→CHAMPION/HOUSTON のように、まったく無関係なブランドを系列扱いしてしまう
// （実データで誤検出80件を確認）。
export function isFamilyNameVariant(childName: string, parentName: string): boolean {
  const childTokens = tokenize(childName);
  const parentTokens = tokenize(parentName);
  if (parentTokens.length === 0 || childTokens.length <= parentTokens.length) return false;

  const startsWithParent = parentTokens.every((t, i) => childTokens[i] === t);
  const endsWithParent = parentTokens.every(
    (t, i) => childTokens[childTokens.length - parentTokens.length + i] === t
  );
  return startsWithParent || endsWithParent;
}

export function matchByKeywords(rawText: string | null, brandEntries: BrandEntry[]): BrandEntry | null {
  if (!rawText) return null;

  const textTokens = tokenize(rawText);
  if (textTokens.length === 0) return null;
  const textTokenSet = new Set(textTokens);

  let best: BrandEntry | null = null;
  let bestLen = 0;

  for (const entry of brandEntries) {
    for (const kw of entry.keywords) {
      if (isGenericKeyword(kw)) continue;
      const kwTokens = tokenize(kw);
      if (kwTokens.length === 0) continue;

      const joined = kwTokens.join("");
      if (joined.length < 3 || joined.length <= bestLen) continue;

      // (a) トークンの並びとして一致（例：「SAINT M1CH43L」）
      // (b) 空白ごと繋がって読み取られた場合に備え、1トークンと完全一致（例：「BEAMSPLUS」）
      if (tokensContainSequence(textTokens, kwTokens) || textTokenSet.has(joined)) {
        best = entry;
        bestLen = joined.length;
      }
    }
  }

  return best;
}
