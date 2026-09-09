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
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={archivoBlack.variable}>
      <body>{children}</body>
    </html>
  );
}
