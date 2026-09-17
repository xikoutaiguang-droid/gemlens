import type { MetadataRoute } from "next";

// 公式サイト（マーケティング向けページ）のみを対象とする。
// Search Consoleはgemlens-official.vercel.appのプロパティとして登録しているため、
// 別ドメイン（アプリ本体 gemlens-tawny.vercel.app）のURLを含めると
// 「このプロパティに属さないURL」として検証エラーになる。
// カメラ撮影が前提のスキャン画面・履歴画面も検索結果として有用ではないため含めない。
export default function sitemap(): MetadataRoute.Sitemap {
  const officialBase = "https://gemlens-official.vercel.app";

  return [
    { url: `${officialBase}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${officialBase}/mypage`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
