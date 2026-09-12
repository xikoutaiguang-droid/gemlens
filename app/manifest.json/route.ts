import { NextRequest, NextResponse } from "next/server";
import { isValidAccountCode, normalizeAccountCode } from "@/lib/accountCode";

export const runtime = "nodejs";

// 通常は静的ファイルで十分だが、「ホーム画面に追加して連携」ボタンから
// このURLに復元コードをクエリparamとして埋め込んで参照させることで、
// start_urlにコードを引き継ぐ。iOSは「ホーム画面に追加」実行時点で
// リンクされているマニフェストを読みに行くため、この時にコード入りの
// start_urlを返せば、追加後のスタンドアロン起動時にコードが自動的に
// 復元される（iOSはブラウザとホーム画面アプリでlocalStorageの保存領域が
// 分離されており、通常はコードを手動で控えて再入力する必要があった）。
export async function GET(req: NextRequest) {
  const rawCode = req.nextUrl.searchParams.get("code");
  const normalized = rawCode ? normalizeAccountCode(rawCode) : "";
  const startUrl = normalized && isValidAccountCode(normalized) ? `/?code=${normalized}` : "/";

  return NextResponse.json(
    {
      name: "GEMLENS | ブランドタグ判定",
      short_name: "GEMLENS",
      description: "ブランドタグを撮影するだけでAIがブランドを判定し、相場情報も確認できるツールです。",
      start_url: startUrl,
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        // ボタン押下直後にコード入りURLを読ませる必要があるため、
        // このレスポンス自体はキャッシュさせない。
        "Cache-Control": "no-store",
      },
    }
  );
}
