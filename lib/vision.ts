export interface VisionResult {
  text: string | null;
  logos: string[];
  webNames: string[];
  pageTitles: string[];
}

interface VisionApiResponseBody {
  error?: unknown;
  responses?: Array<{
    error?: unknown;
    fullTextAnnotation?: { text: string };
    textAnnotations?: Array<{ description?: string }>;
    logoAnnotations?: Array<{ description?: string }>;
    webDetection?: {
      bestGuessLabels?: Array<{ label?: string }>;
      webEntities?: Array<{ description?: string; score?: number }>;
      pagesWithMatchingImages?: Array<{ pageTitle?: string; url?: string }>;
    };
  }>;
}

// Vision API（TEXT / LOGO / WEB の3種検出）
export async function callVisionApi(base64Data: string): Promise<VisionResult> {
  const commaIndex = base64Data.indexOf(",");
  const cleanBase64 = commaIndex !== -1 ? base64Data.substring(commaIndex + 1) : base64Data;

  const apiKey = process.env.VISION_API_KEY;
  if (!apiKey) throw new Error("VISION_API_KEY未設定");

  const payload = {
    requests: [
      {
        image: { content: cleanBase64 },
        features: [
          { type: "DOCUMENT_TEXT_DETECTION" },
          { type: "LOGO_DETECTION", maxResults: 5 },
          { type: "WEB_DETECTION", maxResults: 10 },
        ],
      },
    ],
  };

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Vision API HTTP ${response.status}`);

  const json = (await response.json()) as VisionApiResponseBody;
  if (json.error) throw new Error(`Vision APIエラー: ${JSON.stringify(json.error)}`);

  const res = json.responses?.[0];
  if (!res) throw new Error("Vision API: 空のレスポンス");
  if (res.error) throw new Error(`Vision API 画像エラー: ${JSON.stringify(res.error)}`);

  let text: string | null = null;
  if (res.fullTextAnnotation) {
    text = res.fullTextAnnotation.text;
  } else if (res.textAnnotations?.[0]) {
    text = res.textAnnotations[0].description ?? null;
  }

  const logos: string[] = [];
  if (res.logoAnnotations) {
    for (const l of res.logoAnnotations) {
      if (l.description) logos.push(l.description.trim());
    }
  }

  const webNames: string[] = [];
  if (res.webDetection) {
    if (res.webDetection.bestGuessLabels) {
      for (const l of res.webDetection.bestGuessLabels) {
        if (l.label) webNames.push(l.label.trim());
      }
    }
    if (res.webDetection.webEntities) {
      for (const e of res.webDetection.webEntities) {
        // 汎用ラベル（stitchなど）だけでは判定に役立たないため、閾値をやや緩めて拾う
        if (e.description && (e.score ?? 0) >= 0.3) webNames.push(e.description.trim());
      }
    }
  }

  // 「Googleレンズ」で実際に使われている、同一・類似画像が掲載されたページのタイトル。
  // 実売ページのタイトルにブランド名がそのまま書かれていることが多く、
  // 抽象的なラベル（bestGuessLabels/webEntities）よりブランド特定に直結しやすい。
  const pageTitles: string[] = [];
  if (res.webDetection?.pagesWithMatchingImages) {
    for (const p of res.webDetection.pagesWithMatchingImages) {
      if (p.pageTitle && p.pageTitle.trim()) pageTitles.push(p.pageTitle.trim());
    }
  }

  return { text, logos, webNames, pageTitles: Array.from(new Set(pageTitles)).slice(0, 8) };
}
