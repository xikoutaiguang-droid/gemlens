import { NextRequest, NextResponse } from "next/server";

// 公式サイト用の別ドメイン（Vercelの無料の追加エイリアス）でアクセスされた場合のみ、
// 同じNext.jsアプリ内の/officialページを表示する。
// スタンドアロンアプリ（ホーム画面に追加したアプリ）から見て別オリジンにするのが目的で、
// iOSは同一オリジンへのリンクはアプリ内に留まるが、別オリジンへのリンクは
// Safari/Chromeに正しく脱出する。アプリ本体（gemlens-tawny.vercel.app）は
// このミドルウェアの対象外で、これまで通りの通常のルーティングのまま。
const OFFICIAL_SITE_HOSTS = ["gemlens-official.vercel.app"];

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const isOfficialHost = OFFICIAL_SITE_HOSTS.some((h) => host === h || host.startsWith(`${h}:`));

  if (isOfficialHost && !req.nextUrl.pathname.startsWith("/official")) {
    const url = req.nextUrl.clone();
    url.pathname = `/official${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-|apple-icon|manifest.json).*)"],
};
