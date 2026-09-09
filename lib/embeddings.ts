import { google } from "googleapis";

// Vertex AI Multimodal Embeddings API（画像をベクトル化する）
// 既存のGoogleサービスアカウント（Sheets読み取り用）にcloud-platformスコープを
// 追加し、IAMでVertex AI Userロールを付与して認証を共用する。
const LOCATION = "us-central1";

function getServiceAccount(): { client_email: string; private_key: string } {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!rawJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY未設定");
  const parsed = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEYの形式が不正です");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

async function getAccessToken(): Promise<string> {
  const { client_email, private_key } = getServiceAccount();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const token = await auth.authorize();
  if (!token.access_token) throw new Error("Vertex AI用アクセストークンの取得に失敗しました");
  return token.access_token;
}

function stripDataUrlPrefix(base64Image: string): string {
  const commaIndex = base64Image.indexOf(",");
  return commaIndex !== -1 ? base64Image.substring(commaIndex + 1) : base64Image;
}

// 画像（base64）を1408次元のベクトルに変換する
export async function embedImage(base64Image: string): Promise<number[]> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT_ID未設定");

  const accessToken = await getAccessToken();
  const cleanBase64 = stripDataUrlPrefix(base64Image);

  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${LOCATION}/publishers/google/models/multimodalembedding@001:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ image: { bytesBase64Encoded: cleanBase64 } }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Vertex AI Embeddings HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    predictions?: Array<{ imageEmbedding?: number[] }>;
  };
  const embedding = json.predictions?.[0]?.imageEmbedding;
  if (!Array.isArray(embedding)) throw new Error("画像埋め込みの取得に失敗しました（レスポンス形式不正）");
  return embedding;
}
