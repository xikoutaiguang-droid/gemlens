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

// 大文字小文字・空白・&/-/.等の記号ゆれを許容する強めの正規化。
// アクセント記号も落とす（「agnès b.」と「agnes b.」、「ADAM ET ROPÉ」と「ADAM ET ROPE」は
// タグの印字や出品タイトルで両方の表記が使われるため、別ブランド扱いにしてはならない）。
// NFDで分解したあとラテン文字の結合記号だけを除き、NFCで再結合する。
// 仮名の濁点（U+3099）はこの範囲に含まれないので「が」が「か」に潰れることはない。
export function normLoose(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
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
  // 生産国はタグに必ず載る。「MADE IN」が付かず国名だけ登録されている行があり、
  // 監査で「MADE IN NEW ZEALAND」が国名経由で別ブランドに一致することを確認した。
  "newzealand", "australia", "canada", "mexico", "brazil", "peru", "turkey",
  "china", "korea", "southkorea", "vietnam", "thailand", "indonesia", "india",
  "cambodia", "myanmar", "bangladesh", "philippines", "malaysia", "taiwan",
  "srilanka", "pakistan", "morocco", "tunisia", "egypt", "romania", "bulgaria",
  "poland", "hungary", "austria", "switzerland", "netherlands", "denmark",
  "sweden", "norway", "finland", "ireland", "scotland", "wales",
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
  // 複数ブランドに登録されているが、どのブランドの名称でもない語（実データの監査で判明）。
  // 素材・製法・産地・法人格・品目を指すだけで、ブランドの特定には使えない。
  "goretex", "goodyearwelted", "savilerow", "northampton", "napoli", "sartoria",
  "timewornclothing", "eyewear", "shirt", "shirts", "ma1",
  "ltd", "inc", "corp", "gmbh", "spa", "srl", "co",
  // ライン名・産地・素材を指す語。単独ではブランドを特定できない。
  "homme", "femme", "uomo", "donna", "como", "hanpu", "帆布", "brown",
  // タグの項目名。「COLOR」はKolorの誤読パターン（K↔C）として登録されていたが、
  // 品質表示タグのほぼ全てに印字される語であり、そのままでは大量に誤爆する。
  "color", "colour", "size", "name", "item", "lot", "fabric", "lining", "material",
  // 全キーワード監査で「複数ブランドが取り合っている一般語」として確認されたもの。
  // 品目・素材・製法・部材メーカー・キャラクター名であって、ブランドの特定には使えない。
  "golf", "jeans", "coat", "coats", "vibram", "seaislandcotton", "cordovan",
  "コードバン", "シェルコードバン", "アニリン", "antwerpsix", "snoopy", "arc",
  // 複数の無関係なブランドが同じライン名を使っている（THE NORTH FACE PURPLE LABEL と
  // Ralph Lauren Purple Label、BLACK LABEL CRESTBRIDGE と Ralph Lauren Black Label）。
  // ライン名だけではどちらか決められない。
  "purplelabel", "blacklabel", "bluelabel", "redlabel",
  "パープルレーベル", "ブラックレーベル", "ブルーレーベル", "レッドレーベル",
  // CHANEL と CHEANEY の双方が誤読パターンとして登録しており、判別できない。
  "channel",
];

// 「MADE IN USA」「EST 1947」「SINCE 1976」のような定型句は、
// 国名・年号だけが変わる形でどのブランドのタグにも登場しうるため、
// パターンでまとめて除外する。
export function isGenericKeyword(rawKw: string): boolean {
  const s = rawKw.trim().toLowerCase();
  if (!s) return true;
  // ブロックリストとの突き合わせは、実際の照合で使うのと同じ正規化で行う。
  // （「EDITION.」「EDIT ION」のような記号・空白の変種も同じ一般語として弾くため）
  if (GENERIC_KEYWORD_BLOCKLIST.includes(tokenize(s).join(""))) return true;
  if (/^est\.?\s*\d{3,4}$/.test(s)) return true;
  if (/^since\s*\d{3,4}$/.test(s)) return true;
  // 国名が複数語のものがある（MADE IN NEW ZEALAND / MADE IN SOUTH KOREA など）。
  if (/^(hand)?made\s*in\s+[a-z]+(\s+[a-z]+)*$/.test(s)) return true;
  return false;
}

// キーワード照合は、単語の途中で部分一致させてはならない。
// 例：S'YTEの誤読パターンとして登録された「SENT」は、洗濯表示に頻出する
// 「esSENTial」の内部にも含まれるため、素朴な部分文字列検索では大量に誤爆する
// （同様に ARMEN⊂gARMENt、LIMIT⊂LIMITed、PROD⊂PRODuct）。
// そこで空白・記号を区切りとしたトークン列に分解し、
// キーワードが「トークンの連続した並びとして現れる」場合のみ一致とみなす。
// トークン分割は1回の照合で5万回以上呼ばれ、同じ文字列（ブランド名・キーワード）を
// 何度も分割し直している。結果は入力に対して一意なので記憶しておく。
// 上限を設けるのは、利用者が送ってくるタグ本文が毎回異なり、無制限だと増え続けるため。
const TOKENIZE_CACHE = new Map<string, string[]>();
const TOKENIZE_CACHE_MAX = 200000;

export function tokenize(str: unknown): string[] {
  if (str === null || str === undefined) return [];
  const raw = String(str);
  const hit = TOKENIZE_CACHE.get(raw);
  if (hit) return hit;
  const result = tokenizeUncached(raw);
  if (TOKENIZE_CACHE.size < TOKENIZE_CACHE_MAX) TOKENIZE_CACHE.set(raw, result);
  return result;
}

function tokenizeUncached(str: unknown): string[] {
  if (str === null || str === undefined) return [];
  return String(str)
    .toLowerCase()
    // アクセント付きラテン文字をアクセント無しに畳む。これをしないと、続く文字種の
    // 絞り込みでアクセント文字が区切り扱いになり、ブランド名が断片に割れる
    // （実測：Hermès→["herm","s"]、COMME des GARÇONS→["comme","des","gar","ons"]）。
    // 仮名の濁点（U+3099）はこの範囲外なので、NFCで元に戻る。
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
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
  let bestIsOwnName = false;

  for (const entry of brandEntries) {
    const entryNameKey = tokenize(entry.brandName).join(" ");
    // カナ表記も「そのブランド自身の名前」として扱う。系列ブランドが揃って
    // 親のカナ（例：「ビームス」）を登録しているため、名前側を優先しないと
    // カナだけ読み取れたタグが常に同じ系列ブランドに吸われてしまう。
    const entryKanaKey = tokenize(entry.kana).join(" ");
    // ブランド名とカナ表記は、キーワード欄への登録漏れがあっても常に照合対象にする。
    // 実データでは名称の登録漏れが33件、カナの登録漏れが378件あり、
    // 「タグにブランド名がそのまま印字されているのに見つからない」状態になっていた
    // （例：MIKI HOUSE はキーワードが「MIKIHOUSE」のみで、空白入りの印字に当たらない）。
    for (const kw of [entry.brandName, entry.kana, ...entry.keywords]) {
      if (isGenericKeyword(kw)) continue;
      const kwTokens = tokenize(kw);
      if (kwTokens.length === 0) continue;

      const joined = kwTokens.join("");
      if (joined.length < 3) continue;

      // 同じ語が複数のブランドに登録されていることがある（実データで416件確認）。
      // 例：「BURBERRY」はBURBERRY自身の名称であると同時に、
      // BLACK LABEL CRESTBRIDGEの読み取りキーワードにも登録されている。
      // 長さが同じで競合した場合は、その語を正式名称として持つブランドを優先しないと、
      // タグにブランド名がそのまま書かれているのに別ブランドと判定されてしまう。
      const kwKey = kwTokens.join(" ");
      const isOwnName = kwKey === entryNameKey || (entryKanaKey !== "" && kwKey === entryKanaKey);
      if (joined.length < bestLen) continue;
      if (joined.length === bestLen && !(isOwnName && !bestIsOwnName)) continue;

      // (a) トークンの並びとして一致（例：「SAINT M1CH43L」）
      // (b) 空白ごと繋がって読み取られた場合に備え、1トークンと完全一致（例：「BEAMSPLUS」）
      if (tokensContainSequence(textTokens, kwTokens) || textTokenSet.has(joined)) {
        best = entry;
        bestLen = joined.length;
        bestIsOwnName = isOwnName;
      }
    }
  }

  return best;
}

// GeminiがOCRで読み取ったブランド名が、Vision APIのOCR結果にも同じ文字列として
// 現れているかを確認する。互いに独立した2つのエンジンが同じ文字を読んでいる場合、
// その読み取りは「誤読かもしれない候補」ではなく確定した事実として扱ってよい。
export function isReadingCorroborated(perceived: string, ocrText: string | null | undefined): boolean {
  if (!ocrText) return false;
  const kwTokens = tokenize(perceived);
  if (kwTokens.length === 0) return false;
  const textTokens = tokenize(ocrText);
  if (tokensContainSequence(textTokens, kwTokens)) return true;
  return new Set(textTokens).has(kwTokens.join(""));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// OCRで最も頻繁に起きる誤りは、字形の似た数字への置換（O→0、I→1、E→3、S→5 など）である。
// 誤読の許容範囲を測る前にこの置換を元に戻しておくことで、
// 「N33DL35 → NEEDLES」のような正当な誤読を距離計算で弾かずに済む。
// 逆方向（文字→数字）には変換しないため、綴りの異なる別ブランド同士が
// 偶然一致してしまうことはない。
const OCR_DIGIT_FOLD: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t", "8": "b",
};

function foldOcrDigits(s: string): string {
  return s.replace(/[01345678]/g, (d) => OCR_DIGIT_FOLD[d] ?? d);
}

// タグの文字が読めているのに登録リストに無い場合、AIに「リストの中から選ばせる」と
// 読み取り結果とかけ離れた有名ブランドを自信を持って返してくることがある
// （実例：タグに「STEFANEL」と明記されているのに「CELINE」を返した）。
// 誤読は本来1〜数文字の置換・欠落として現れるため、読み取った文字から
// 誤読として説明できる範囲にある候補だけを採用する。
export function isPlausibleMisreadOf(candidate: string, perceived: string): boolean {
  const a = foldOcrDigits(normLoose(candidate));
  const b = foldOcrDigits(normLoose(perceived));
  if (!a || !b) return false;
  if (a === b) return true;

  // 一方が他方を語として含む場合（例：「BEAMS」と「BEAMS BOY」）は誤読ではなく
  // 表記の粒度の違いなので許容する。
  const at = tokenize(candidate);
  const bt = tokenize(perceived);
  if (tokensContainSequence(bt, at) || tokensContainSequence(at, bt)) return true;

  const allowed = Math.max(2, Math.floor(Math.max(a.length, b.length) * 0.34));
  return levenshtein(a, b) <= allowed;
}

// 与えられた文章を語に分け、連続する語のまとまり（最大で候補ブランド名の語数まで）を
// 正規化して列挙する。ブランド名が「語の並びとして」登場する場合だけを一致とみなすための集合。
// 単純な部分文字列一致だと、より長い語の内部に短いブランド名が偶然含まれて誤爆する
// （実測：Web検出の「BEAMS FLAGSHIP STORE」が子ブランド「BEAMS F」に一致した）。
export function buildPhraseSet(text: string, candidateNames: string[]): Set<string> {
  const words = text.split(/\s+/).filter(Boolean);
  const maxWords = Math.max(1, ...candidateNames.map((n) => n.split(/\s+/).filter(Boolean).length));
  const phrases = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= maxWords && i + n <= words.length; n++) {
      phrases.add(normPlusVariant(words.slice(i, i + n).join(" ")));
    }
  }
  return phrases;
}

// タグの文字は読めたが、完全一致にも登録済みの誤読パターンにも当たらない場合の最後の手段。
// 実測では、OCRが1文字誤るだけで正解率が100%から27%に落ち、67%が「判定不可」になっていた。
// 誤読は本来わずかな文字の違いとして現れるので、綴りの近さで拾い直す。
//
// ただし近いだけで断定してはならない（ONEILLとONEILのように1文字違いの別ブランドが実在する）。
// 最短距離の候補がただ1つに絞れる場合のみ採用し、同点の候補が複数あるときは諦める。
// 判定不可のままにする方が、別ブランドを断定するより害が小さい。
export const FUZZY_MIN_LEN = Number(process.env.FUZZY_MIN_LEN || 8);

export function matchByFuzzyNameImpl(rawText: string, brandEntries: BrandEntry[], minLen: number): BrandEntry | null {
  const text = foldOcrDigits(normLoose(rawText));
  // 短い名前は1文字の差がそのまま別ブランドになる（AMIRI/AMERI、EDWIN/BEDWIN、VANS/VAN など実在する）。
  if (text.length < minLen) return null;

  const allowed = Math.max(1, Math.floor(text.length * 0.2));
  let best: BrandEntry | null = null;
  let bestDist = Infinity;
  let tie = false;

  for (const e of brandEntries) {
    for (const label of [e.brandName, e.kana]) {
      if (!label) continue;
      const cand = foldOcrDigits(normLoose(label));
      if (!cand || Math.abs(cand.length - text.length) > allowed) continue;
      const d = levenshtein(text, cand);
      if (d > allowed) continue;
      if (d < bestDist) { bestDist = d; best = e; tie = false; }
      else if (d === bestDist && best && best.brandName !== e.brandName) tie = true;
    }
  }
  return tie ? null : best;
}

export function matchByFuzzyName(rawText: string, brandEntries: BrandEntry[]): BrandEntry | null {
  return matchByFuzzyNameImpl(rawText, brandEntries, FUZZY_MIN_LEN);
}
