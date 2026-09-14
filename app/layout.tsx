import type { Metadata, Viewport } from "next";
import { Archivo_Black } from "next/font/google";
import "./globals.css";

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GEMLENS | ブランドタグ判定",
  description: "ブランドタグを撮影するだけでAIがブランドを判定し、相場情報も確認できるツールです。",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GEMLENS",
  },
  // appleWebApp.capableだけではapple-mobile-web-app-capableタグが
  // 出力されないケースがあったため、確実に出力されるよう明示的に指定する。
  // これが無いとホーム画面に追加してもスタンドアロン起動されず、
  // 通常のSafariタブ（URLバー・下部ツールバー付き）として開いてしまう。
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={archivoBlack.variable}>
      <head>
        {/* AdSenseのサイト所有権確認用（審査対象: gemlens-official.vercel.app）。
            next/scriptのbeforeInteractive戦略はJSでの実行時挿入になり、生のHTMLには
            リンクタグしか残らないため、AdSense側の確認クローラ（JSを実行しない）が
            検出できなかった。素のHTMLタグとしてサーバー描画時点の<head>に直接出力する。 */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9978665653036898"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
