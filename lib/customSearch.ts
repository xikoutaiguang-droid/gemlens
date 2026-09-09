// Google Custom Search JSON API（画像検索）
// フリマ・オークションサイトへの直接スクレイピングはToS上のリスクがあるため、
// 公式APIのみを使ってブランドタグの参照画像候補を収集する。
export interface ImageSearchResult {
  imageUrl: string;
  contextUrl: string;
  title: string;
}

export async function searchBrandTagImages(brandName: string, maxResults = 10): Promise<ImageSearchResult[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) throw new Error("Google Custom Searchの環境変数が未設定です");

  const query = `${brandName} ブランドタグ`;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", String(Math.min(Math.max(maxResults, 1), 10)));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Custom Search API HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    items?: Array<{ link?: string; title?: string; image?: { contextLink?: string } }>;
  };

  const items = json.items ?? [];
  return items
    .filter((it): it is { link: string; title?: string; image?: { contextLink?: string } } => !!it.link)
    .map((it) => ({
      imageUrl: it.link,
      contextUrl: it.image?.contextLink ?? "",
      title: it.title ?? "",
    }));
}
