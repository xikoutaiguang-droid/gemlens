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

export const metadata: Metadata = {
  title: "GEMLENS 公式サイト",
  description: "ブランドタグを撮影するだけでAIが判定するGEMLENSの公式サイトです。",
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
        <Link href="/mypage" className="official-nav-btn">
          マイページ
        </Link>
      </header>
      {children}
    </div>
  );
}
