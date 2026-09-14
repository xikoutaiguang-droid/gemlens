import type { MetadataRoute } from "next";

// 公式サイト（マーケティング向けページ）と、アプリ本体の規約・お問い合わせページのみを対象とする。
// カメラ撮影が前提のスキャン画面・履歴画面は検索結果として有用ではないため含めない。
export default function sitemap(): MetadataRoute.Sitemap {
  const officialBase = "https://gemlens-official.vercel.app";
  const appBase = "https://gemlens-tawny.vercel.app";

  return [
    { url: `${officialBase}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${officialBase}/mypage`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${appBase}/legal`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appBase}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
