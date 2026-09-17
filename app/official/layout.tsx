import type { Metadata } from "next";
import { Anton } from "next/font/google";
import Link from "next/link";

// 公式サイト専用の見出し書体。アプリ本体（Archivo Black）には影響させないよう、
// ここだけでフォントを読み込み、.official-page配下だけに適用する。
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const OFFICIAL_URL = "https://gemlens-official.vercel.app";
const APP_URL = "https://gemlens-tawny.vercel.app";
const OG_DESCRIPTION =
  "GEMLENSは、アパレル製品のタグを撮影するだけでAIがブランド名を判定し、古着買取・販売の相場情報も確認できる無料ツールです。会員登録は不要で、文字の読めない記号・ロゴのみのタグにも対応しています。";

export const metadata: Metadata = {
  title: "GEMLENS 公式サイト",
  description: OG_DESCRIPTION,
  keywords: ["GEMLENS", "ブランドタグ", "AI判定", "古着", "買取", "せどり", "ブランド鑑定", "相場"],
  alternates: { canonical: OFFICIAL_URL },
  verification: { google: "F28c8je94zr6ebnB5jIPenE-VNSVGMP0yQQ5vjmGvXc" },
  openGraph: {
    title: "GEMLENS | ブランドタグを撮るだけで判定",
    description: OG_DESCRIPTION,
    url: OFFICIAL_URL,
    siteName: "GEMLENS",
    locale: "ja_JP",
    type: "website",
    images: [{ url: `${OFFICIAL_URL}/icon-512.png`, width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "GEMLENS | ブランドタグを撮るだけで判定",
    description: OG_DESCRIPTION,
    images: [`${OFFICIAL_URL}/icon-512.png`],
  },
};

export default function OfficialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={anton.variable}>
      <header className="official-header">
        <Link href="/" className="official-header-logo">
          <svg className="brand-mark" viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" width="22" height="26">
            <path d="M60,60 L130,110 L200,40 L270,110 L340,60 L400,190 L200,460 L0,190 Z" fill="white" stroke="black" strokeWidth="14" strokeLinejoin="round" />
            <circle cx="200" cy="230" r="95" fill="black" />
            <circle cx="200" cy="230" r="76" fill="white" />
            <g fill="black">
              <path d="M200,230 L200,160 A70,70 0 0,1 260,195 Z" />
              <path d="M200,230 L260,195 A70,70 0 0,1 260,265 Z" />
              <path d="M200,230 L260,265 A70,70 0 0,1 200,300 Z" />
              <path d="M200,230 L200,300 A70,70 0 0,1 140,265 Z" />
              <path d="M200,230 L140,265 A70,70 0 0,1 140,195 Z" />
              <path d="M200,230 L140,195 A70,70 0 0,1 200,160 Z" />
            </g>
            <circle cx="200" cy="230" r="76" fill="none" stroke="black" strokeWidth="10" />
          </svg>
          <div className="logo-text" style={{ fontSize: 20 }}>
            GemLens
          </div>
        </Link>
        <div className="official-header-nav">
          <Link href="/mypage" className="official-nav-btn">
            マイページ
          </Link>
          <a href={APP_URL} className="official-nav-btn official-nav-btn-primary">
            アプリ
          </a>
        </div>
      </header>
      {children}
    </div>
  );
}
