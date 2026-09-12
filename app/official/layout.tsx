import type { Metadata } from "next";
import { Anton } from "next/font/google";

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
  return <div className={anton.variable}>{children}</div>;
}
