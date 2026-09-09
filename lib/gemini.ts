import type { BrandEntry } from "./matching";
import type { VisionResult } from "./vision";

const GEMINI_MODEL = "gemini-2.5-flash";

function geminiUrl(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY未設定");
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
}

interface ImagePart {
  inline_data: { mime_type: string; data: string };
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

function extractText(json: GeminiApiResponse): string | undefined {
  return json.candidates?.[0]?.content?.parts?.[0]?.text;
}

export function imagesToParts(base64Images: string[]): ImagePart[] {
  return base64Images.map((img) => {
    const commaIndex = img.indexOf(",");
    const cleanBase64 = commaIndex !== -1 ? img.substring(commaIndex + 1) : img;
    const mimeType = img.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    return { inline_data: { mime_type: mimeType, data: cleanBase64 } };
  });
}

// Step1: タグに書かれているブランド名をそのまま読み取る
// （登録リストは見せない＝背景知識で寄せさせない）
export async function readBrandTextFromImage(
  base64Images: string[],
  visionResult: VisionResult
): Promise<string | null> {
  try {
    const imageParts = imagesToParts(base64Images);
    const multiNote =
      base64Images.length > 1
        ? `同じタグを複数の角度・部位から撮影した写真が${base64Images.length}枚あります。すべてを見比べて、最も確実に読み取れる箇所から判断してください。\n`
        : "";

    const visionInfo = visionResult.text ? "テキスト検出: " + visionResult.text : "";

    const prompt = [
      "この画像はアパレルの品質表示タグ・ブランドタグの写真です。",
      multiNote,
      "タグに印字・刺繍・プリントされているブランド名を、そのまま正確に読み取ってください。",
      "",
      "【Vision APIの補助情報】",
      visionInfo || "（なし）",
      "",
      "【厳守事項】",
      "・製造元、OEM元、コラボ元、系列店など背景知識による推測は一切禁止です。",
      "・タグに実際に印字されている文字をそのまま読むことだけが仕事です。",
      "・例えば「Ron Herman」と書かれたタグを見て、「Ron Hermanの別注品はFRANK&EILEEN社製だ」のような知識を使って",
      "　別のブランド名を答えることは絶対にしないでください。書かれている通り「Ron Herman」と答えてください。",
      "・ブランド名らしき文字が画像に全く見当たらない場合のみ「不明」と答えてください。",
      "",
      "【回答形式】厳守",
      "読み取れたブランド名の英字・カナ表記のみを1行で返す（読み仮名の補足、説明、記号、括弧は一切不要）",
      "読み取れない場合は「不明」とだけ返す",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      contents: [{ parts: [...imageParts, { text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
    };

    const response = await fetch(geminiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as GeminiApiResponse;
    const content = extractText(json);
    if (!content) return null;

    const result = content.trim();
    return result === "" || result === "不明" ? null : result;
  } catch {
    return null;
  }
}

export interface LogoGuessResult {
  brandName: string | null;
  guessedBrand?: string;
  visualDescription?: string;
  error?: string;
}

// Step3: 文字が全く読めない、または登録ブランドと一致しない場合に、
// ロゴ・デザイン・Web検索から登録リスト内のブランドを推測する。
// useGrounding が true のときのみGoogle検索連携（コストが発生する）を使う。
export async function guessBrandFromLogo(
  base64Images: string[],
  visionResult: VisionResult,
  brandEntries: BrandEntry[],
  perceivedHint: string | undefined,
  useGrounding: boolean
): Promise<LogoGuessResult> {
  try {
    const imageParts = imagesToParts(base64Images);

    const brandList = brandEntries.map((e, i) => `${i + 1}. ${e.brandName}`).join("\n");

    const visionInfo = [
      perceivedHint ? "OCR読み取り文字（登録ブランドと不一致・誤読の可能性あり）: " + perceivedHint : "",
      visionResult.logos.length ? "ロゴ検出: " + visionResult.logos.join(", ") : "",
      visionResult.webNames.length
        ? "Web画像検索による推定（Googleレンズ相当）: " + visionResult.webNames.join(", ")
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = [
      perceivedHint
        ? `この画像はブランドタグの写真です。文字は「${perceivedHint}」と読み取れましたが、登録ブランドリストの中に完全一致するものがありませんでした（誤読・タグデザインの違いの可能性があります）。`
        : "この画像はブランドタグの写真ですが、文字情報は読み取れませんでした（ロゴ・エンブレムのみのタグである可能性があります）。",
      "",
      "【補助情報】",
      visionInfo || "（なし）",
      "",
      "【登録ブランドリスト】",
      brandList,
      "",
      "ファミリーブランド（例：BEAMS / BEAMS F / BEAMS PLUSなど）は特に注意して区別してください。",
      "",
      "【手順】",
      "1. まず画像に写っているロゴ・エンブレム・刺繍・型押しなどの視覚的特徴（例：鍵が3本交差している、動物のシルエット、",
      "   幾何学模様、頭文字のモノグラムなど）を具体的に言語化してください。文字がうっすら読めた場合はそれも含めてください。",
      "2. その特徴やOCR読み取り文字（スタイライズされたフォントによる誤読の可能性を考慮）をもとに、",
      "   必要であればあなた自身のGoogle検索能力も使って、実際のブランドを特定してください。",
      "   特にOCR読み取り文字が登録ブランド名と1〜2文字だけ違う場合（誤読の可能性が高い）は、その登録ブランドを優先的に検討してください。",
      "3. 登録ブランドリストの中に高い確信度で一致するものがあるか判断してください。",
      "",
      "【重要・厳守】",
      "・「似ている」「それっぽい」程度の確信度では、絶対にmatchedBrandを埋めないでください。",
      "・登録リストと完全に一致すると確信できる場合のみ matchedBrand を埋めてください。",
      "・確信が持てない場合は matchedBrand を空文字のままにし、代わりに（登録リストの有無に関わらず）",
      "　最も可能性が高いと思われるブランド名を guessedBrand に入れてください。分からなければ空文字にしてください。",
      "・確信が持てないのに無理に登録リストから選んで誤って別のブランドと断定することが、最も避けるべき失敗です。",
      "",
      "【回答形式】厳守。以下のJSON形式のみで返してください。説明文やMarkdownのコードブロックは不要です。",
      "{",
      '  "visualDescription": "画像から視認できるロゴ・エンブレム・文字などの特徴（1〜2文で簡潔に）",',
      '  "matchedBrand": "登録ブランドリストの中に高い確信度で完全一致するものがあれば、そのブランド名を完全に同じ表記で（なければ空文字）",',
      '  "guessedBrand": "登録リストになくても、ロゴやWeb検索から特定できたブランド名（分からなければ空文字）"',
      "}",
    ].join("\n");

    const payload: Record<string, unknown> = {
      contents: [{ parts: [...imageParts, { text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: -1 } },
    };
    if (useGrounding) {
      payload.tools = [{ google_search: {} }];
    }

    const response = await fetch(geminiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return { brandName: null, error: await response.text() };

    const json = (await response.json()) as GeminiApiResponse;
    const content = extractText(json);
    if (!content) return { brandName: null };

    const trimmed = content.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      // 旧形式（プレーンテキスト）へのフォールバック
      return { brandName: trimmed && trimmed !== "不明" ? trimmed : null };
    }

    let parsed: { matchedBrand?: string; guessedBrand?: string; visualDescription?: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return { brandName: null };
    }

    const matchedBrand = String(parsed.matchedBrand || "").trim();
    const guessedBrand = String(parsed.guessedBrand || "").trim();
    const visualDescription = String(parsed.visualDescription || "").trim() || undefined;

    if (matchedBrand) return { brandName: matchedBrand, visualDescription };
    if (guessedBrand) return { brandName: null, guessedBrand, visualDescription };
    return { brandName: null, visualDescription };
  } catch (e) {
    return { brandName: null, error: String(e) };
  }
}

export interface MarketAdvice {
  popularItems?: string;
  marketValue?: string;
  listingCount?: string;
}

// ブランド確定後に呼び出し、古着市場の相場を返す。エラー時はnull。
export async function callGeminiAdvice(brandName: string): Promise<MarketAdvice | null> {
  // まずGoogle検索グラウンディング付きで試す
  const grounded = await callGeminiAdviceInternal(brandName, true);
  if (grounded) return grounded;
  // 失敗したら、グラウンディング無しで再試行する
  return callGeminiAdviceInternal(brandName, false);
}

async function callGeminiAdviceInternal(brandName: string, useGrounding: boolean): Promise<MarketAdvice | null> {
  try {
    const prompt = [
      "あなたは古着・ブランド品の査定専門家です。",
      useGrounding
        ? `Google検索で「${brandName}」の中古品の直近の実売相場を調べた上で、`
        : `「${brandName}」について、`,
      "古着店スタッフ向けに以下をJSON形式のみで返してください。",
      useGrounding ? "検索結果の裏付けが無い場合は、一般的な相場感として推定してください。" : "",
      "余分な説明やMarkdownのコードブロックは不要です。JSONのみ返してください。",
      "",
      "{",
      '  "popularItems": "人気アイテム・定番モデル（改行区切りで3〜5個）",',
      '  "marketValue": "アイテム別に以下の形式で記載：\\nアイテム名：安め〇〇〇円／平均〇〇〇円／高値〇〇〇円",',
      '  "listingCount": "アイテム別に以下の形式で記載：\\nアイテム名：出品数 目安〇〇件（メルカリ）"',
      "}",
      "",
      "・これは古着店スタッフが査定時に使う買取相場です（販売価格ではない）",
      "・買取相場は販売価格の30〜50%程度が目安です",
      "・状態が普通の場合の買取価格を想定してください",
      "・メルカリ・ラクマ・ヤフオク・Googleショッピング(中古価格のみ)の実売価格を参考に、そこから買取換算した金額で",
      "・高値は状態良好・希少モデルの場合、安めは状態やや難・定番品の場合",
      "・listingCountは現在メルカリで「ブランド名＋アイテム名」を検索した場合の出品件数の概算（正確な数値でなくてよい、大まかな概数で可）",
      "・出品件数が多いほど市場での取引が活発＝売れやすい傾向があることの参考値として使う",
      "・不明な場合は「情報なし」とする",
    ]
      .filter(Boolean)
      .join("\n");

    const payload: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
    };
    if (useGrounding) {
      payload.tools = [{ google_search: {} }];
    }

    const response = await fetch(geminiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[callGeminiAdvice${useGrounding ? "/grounded" : "/fallback"}] HTTP ${response.status}: ${await response.text()}`);
      return null;
    }

    const json = (await response.json()) as GeminiApiResponse;
    const content = extractText(json);
    if (!content) {
      console.error(`[callGeminiAdvice${useGrounding ? "/grounded" : "/fallback"}] 応答にテキストが含まれていません: ${JSON.stringify(json)}`);
      return null;
    }

    const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[callGeminiAdvice${useGrounding ? "/grounded" : "/fallback"}] JSON形式でない応答: ${content}`);
      return null;
    }

    return JSON.parse(jsonMatch[0]) as MarketAdvice;
  } catch (e) {
    console.error(`[callGeminiAdvice${useGrounding ? "/grounded" : "/fallback"}] 例外:`, e);
    return null;
  }
}
