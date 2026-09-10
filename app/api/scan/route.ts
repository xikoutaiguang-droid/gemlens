import { NextRequest, NextResponse } from "next/server";
import { callVisionApi, type VisionResult } from "@/lib/vision";
import { loadBrandEntries } from "@/lib/brands";
import { readBrandTextFromImage, guessBrandFromLogo, callGeminiAdvice, type LogoGuessResult, type MarketAdvice } from "@/lib/gemini";
import { matchBrandName, matchByKeywords, norm, type BrandEntry } from "@/lib/matching";
import { isProUser } from "@/lib/pro";
import { checkAndIncrementUsage, type UsageResult } from "@/lib/rateLimit";
import { embedImage } from "@/lib/embeddings";
import { queryReferenceImages } from "@/lib/vectorStore";

// 画像類似検索フォールバックの採用しきい値（コサイン類似度）。
// 手動登録した参照画像が少ないうちは厳しめにし、誤検出よりも「判定不可」を優先する。
const VECTOR_MATCH_THRESHOLD = 0.85;

export const runtime = "nodejs";
export const maxDuration = 60;

interface GeminiVisionResult extends LogoGuessResult {
  perceivedText?: string;
  matchSource?: string;
}

// 「タグの文字を読む」と「リストと照合する」を完全に分離する。
// 背景知識（製造元・別注元など）による誤った類推を防ぐため、
// 文字が読めた場合はコード側の厳密な文字列一致のみで判定し、
// Gemini自身にはリストからの「選択」をさせない。
// 文字が全く読めない場合のみ、ロゴ・デザインからの推測を許可する。
async function callGeminiVision(
  base64Images: string[],
  visionResult: VisionResult,
  brandEntries: BrandEntry[],
  deviceId: string | undefined
): Promise<GeminiVisionResult> {
  const useGrounding = isProUser(deviceId);
  const perceived = await readBrandTextFromImage(base64Images, visionResult);

  if (perceived) {
    const matched = matchBrandName(perceived, brandEntries);
    if (matched) {
      return { brandName: matched.brandName, perceivedText: perceived, matchSource: "gemini-text" };
    }

    // ブランド名（正式表記）とは一致しなかったが、タグデザインが多様で
    // スタイライズされたフォントの誤読パターンが読み取りキーワードとして
    // 登録されている場合がある（例：SAINT MICHAELの「SA1NT M1CH43L」等）。
    // AIにロゴ推測をさせる前に、まずこの決定的な照合を試みる。
    const kwMatchFromPerceived = matchByKeywords(perceived, brandEntries);
    if (kwMatchFromPerceived) {
      return { brandName: kwMatchFromPerceived.brandName, perceivedText: perceived, matchSource: "keyword-retry" };
    }

    // それでも一致しない場合のみ、ロゴ形状・Google画像検索相当のWeb推定情報を手がかりに再挑戦する
    const logoResult = await guessBrandFromLogo(base64Images, visionResult, brandEntries, perceived, useGrounding);
    return {
      ...logoResult,
      perceivedText: perceived,
      matchSource: logoResult.brandName ? "gemini-logo-retry" : "unregistered",
    };
  }

  const logoResult = await guessBrandFromLogo(base64Images, visionResult, brandEntries, undefined, useGrounding);
  return { ...logoResult, matchSource: "gemini-logo" };
}

interface CandidateResult {
  brandName: string;
  kana: string;
  rank: string;
  info: string;
  scorePercent: number;
  marketInfo?: MarketAdvice | null;
}

interface ScanResult {
  success: boolean;
  single?: boolean;
  brandName?: string;
  kana?: string;
  rank?: string;
  info?: string;
  confirmReason?: string;
  candidates?: CandidateResult[];
  familyAlert?: boolean;
  guessedBrand?: string;
  message?: string;
  debugText?: string;
  limitReached?: boolean;
  marketInfo?: MarketAdvice | null;
  usage?: UsageResult;
}

// 最終結果の組み立て
function buildResult(geminiResult: GeminiVisionResult, brandEntries: BrandEntry[], debugText: string): ScanResult {
  const geminiName = geminiResult.brandName;

  if (!geminiName) {
    if (geminiResult.guessedBrand) {
      return {
        success: false,
        guessedBrand: geminiResult.guessedBrand,
        message: `データベースには未登録のブランドですが、AIは「${geminiResult.guessedBrand}」の可能性が高いと判定しました。データベースへの追加をご検討ください。`,
        debugText,
      };
    }
    return {
      success: false,
      message: "ブランドを特定できませんでした。タグをより鮮明に撮影して再試行してください。",
      debugText,
    };
  }

  const normGemini = norm(geminiName);
  const matched = brandEntries.filter((e) => norm(e.brandName) === normGemini);

  if (matched.length === 0) {
    return {
      success: false,
      message: `「${geminiName}」はデータベースに登録されていません。`,
      debugText,
    };
  }

  const entry = matched[0];

  // ファミリーブランドの場合は兄弟ブランドも候補表示
  if (entry.parentBrand) {
    const siblings = brandEntries.filter(
      (e) => e.parentBrand === entry.parentBrand || norm(e.brandName) === norm(entry.parentBrand)
    );
    const candidates = [entry];
    for (const s of siblings) {
      if (norm(s.brandName) !== normGemini) candidates.push(s);
    }
    if (candidates.length >= 2) {
      const top: CandidateResult[] = candidates.slice(0, 3).map((c, i) => ({
        brandName: c.brandName,
        kana: c.kana,
        rank: c.rank,
        info: c.info,
        scorePercent: i === 0 ? 100 : 60,
      }));
      return { success: true, single: false, candidates: top, familyAlert: true, debugText };
    }
  }

  return {
    success: true,
    single: true,
    brandName: entry.brandName,
    kana: entry.kana,
    rank: entry.rank,
    info: entry.info,
    confirmReason: "AI判定",
    debugText,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const rawImages = body?.images;
    const deviceId: string | undefined = typeof body?.deviceId === "string" ? body.deviceId : undefined;
    const devKey: string | undefined = typeof body?.devKey === "string" ? body.devKey : undefined;

    if (!Array.isArray(rawImages) || !rawImages.length) {
      return NextResponse.json({ success: false, message: "画像がありません。" }, { status: 400 });
    }
    const base64Images: string[] = rawImages.slice(0, 3);

    const usage = await checkAndIncrementUsage(deviceId, devKey);
    if (!usage.allowed) {
      return NextResponse.json({
        success: false,
        limitReached: true,
        message: `本日の無料利用回数（${usage.limit}回）に達しました。また明日お試しください。`,
        usage,
      });
    }

    const visionResult = await callVisionApi(base64Images[0]);

    const debugLines: string[] = [];
    if (visionResult.text) debugLines.push("[TEXT] " + visionResult.text);
    if (visionResult.logos.length) debugLines.push("[LOGO] " + visionResult.logos.join(", "));
    if (visionResult.webNames.length) debugLines.push("[WEB] " + visionResult.webNames.join(", "));
    if (visionResult.pageTitles.length) debugLines.push("[PAGES] " + visionResult.pageTitles.join(" / "));

    const brandEntries = await loadBrandEntries();
    let geminiResult = await callGeminiVision(base64Images, visionResult, brandEntries, deviceId);

    if (geminiResult.perceivedText) {
      debugLines.push("[READ] " + geminiResult.perceivedText);
    }
    if (geminiResult.visualDescription) {
      debugLines.push("[VISUAL] " + geminiResult.visualDescription);
    }

    // フォールバック: 画像判定が「不明」の場合のみ、キーワードとの辞書照合を試みる
    let matchSource = geminiResult.matchSource || "gemini";
    if (!geminiResult.brandName) {
      const kwMatch = matchByKeywords(visionResult.text, brandEntries);
      if (kwMatch) {
        geminiResult = { brandName: kwMatch.brandName };
        matchSource = "keyword";
      }
    }

    // 最終フォールバック（PRO限定）: 手動登録した参照画像との類似検索
    // ロゴ・エンブレムのみで文字情報がほぼ無いタグ向け。参照画像が未登録のブランドには効果がない。
    if (!geminiResult.brandName && isProUser(deviceId)) {
      try {
        const vector = await embedImage(base64Images[0]);
        const matches = await queryReferenceImages(vector, 3);
        const best = matches[0];
        if (best) {
          debugLines.push(`[VECTOR] ${best.brandName} (score=${best.score.toFixed(3)})`);
          if (best.score >= VECTOR_MATCH_THRESHOLD) {
            const vecMatch = brandEntries.find((e) => norm(e.brandName) === norm(best.brandName));
            if (vecMatch) {
              geminiResult = { brandName: vecMatch.brandName };
              matchSource = "vector-similarity";
            }
          }
        }
      } catch (e) {
        console.error("[scan] vector search failed", e);
      }
    }

    debugLines.push(`[MATCH] ${geminiResult.brandName || "判定不可"}（${matchSource}）`);

    const debugText = debugLines.join("\n");
    const result = buildResult(geminiResult, brandEntries, debugText);

    // ブランド確定後に相場情報を取得
    if (result.success && result.single && result.brandName) {
      result.marketInfo = await callGeminiAdvice(result.brandName);
    } else if (result.success && result.candidates) {
      result.candidates = await Promise.all(
        result.candidates.map(async (c) => ({ ...c, marketInfo: await callGeminiAdvice(c.brandName) }))
      );
    }

    result.usage = usage;
    return NextResponse.json(result);
  } catch (error) {
    console.error("[scan API ERROR]", error);
    return NextResponse.json(
      { success: false, message: "システムエラーが発生しました。", debugText: String(error) },
      { status: 500 }
    );
  }
}
