"use client";

import { useEffect } from "react";
import AdSlot from "../components/AdSlot";

const APP_URL = "https://gemlens-tawny.vercel.app";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="official-eyebrow">{children}</div>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="official-section-head">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="official-h2">{title}</h2>
    </div>
  );
}

export default function OfficialSitePage() {
  // body側は#app-root画面（撮影・履歴）用にoverflow:hiddenが既定のため、
  // このページ滞在中だけ通常のページスクロールに戻す（/legal等と同じ対応）。
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="official-page">
      <div className="official-container">
        <section className="official-hero">
          <Eyebrow>Tag it. Know it.</Eyebrow>
          <h1 className="official-h1">
            ブランドタグを
            <br />
            撮るだけで判定
          </h1>
          <p className="official-lead">
            GEMLENSは、アパレル製品のタグを撮影するだけでAIがブランド名を判定し、
            古着買取・販売の相場情報も確認できるツールです。会員登録は不要で、
            ブラウザからすぐにお使いいただけます。
          </p>

          <div className="official-highlights">
            <div className="official-highlight">
              <svg className="official-highlight-icon" viewBox="0 0 24 24" width="22" height="22">
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <line x1="19" y1="9" x2="23" y2="15" />
                <line x1="23" y1="9" x2="19" y2="15" />
              </svg>
              <div>
                <div className="official-highlight-t">無音で撮影できる</div>
                <div className="official-highlight-d">シャッター音が鳴らない独自カメラだから、周囲を気にせず撮影できます。</div>
              </div>
            </div>
            <div className="official-highlight">
              <svg className="official-highlight-icon" viewBox="0 0 24 24" width="22" height="22">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <div>
                <div className="official-highlight-t">膨大なブランドタグに対応</div>
                <div className="official-highlight-d">国内外の古着市場で流通する数多くのブランドに対応。データベースは順次拡充中です。</div>
              </div>
            </div>
            <div className="official-highlight">
              <svg className="official-highlight-icon" viewBox="0 0 24 24" width="22" height="22">
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
              </svg>
              <div>
                <div className="official-highlight-t">記号だけのタグも判定</div>
                <div className="official-highlight-d">文字が読めないロゴ・記号のみのタグも、複数枚撮影すればAIが判定します。</div>
              </div>
            </div>
          </div>

          <div className="official-demo">
            <img
              src="/official/demo.gif"
              alt="GEMLENSでタグを撮影し、AIがブランドと相場情報を判定するまでの操作画面"
              width={680}
              height={1352}
            />
          </div>

          <a href={APP_URL} className="official-cta">
            アプリを開く
          </a>
        </section>

        <section className="official-section">
          <SectionHeading eyebrow="How it works" title="使い方" />
          <ol className="official-steps">
            {[
              { n: "01", t: "タグを撮影する", d: "服のブランドタグを1〜3枚撮影します。文字が読みにくい記号だけのタグは複数枚がおすすめです。" },
              { n: "02", t: "AIが自動で判定", d: "刺繍や印字の文字をAIが読み取り、登録済みのブランドデータベースと照合します。" },
              { n: "03", t: "相場情報を確認", d: "判定結果と合わせて、買取・販売の目安相場や人気アイテムの情報も表示されます。" },
            ].map((step) => (
              <li key={step.n} className="official-step">
                <div className="official-step-n">{step.n}</div>
                <div>
                  <div className="official-step-t">{step.t}</div>
                  <div className="official-step-d">{step.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="official-section">
          <SectionHeading eyebrow="Who it's for" title="こんな方におすすめ" />
          <ul className="official-list">
            <li>古着の買取・販売を行っている個人事業主・小規模店舗の方</li>
            <li>フリマアプリやオークションで仕入れ・出品をしている方</li>
            <li>タグの文字が読みにくく、ブランドの見分けに時間がかかっている方</li>
          </ul>
        </section>

        <section className="official-section">
          <SectionHeading eyebrow="FAQ" title="よくある質問" />
          <div className="official-faq">
            {[
              { q: "会員登録は必要ですか？", a: "不要です。ブラウザからそのままお使いいただけます。仕入れ記録を残したい場合のみ、端末間の引き継ぎ用に自動発行される「IDコード」を使います。" },
              { q: "無料で使えますか？", a: "1日10回までのスキャンと、月20件までの仕入れ記録の保存は無料です。回数無制限やより高精度な判定は有料プランでご利用いただけます。" },
              { q: "対応しているブランドは？", a: "国内外の古着市場で流通する主要ブランドに対応しています。データベースは順次拡充しています。" },
            ].map((item) => (
              <div key={item.q} className="official-faq-item">
                <div className="official-faq-q">Q. {item.q}</div>
                <div className="official-faq-a">A. {item.a}</div>
              </div>
            ))}
          </div>
        </section>

        <AdSlot />

        <footer className="official-footer">
          <a href={`${APP_URL}/legal`}>利用規約・プライバシーポリシー</a>
        </footer>
      </div>
    </div>
  );
}
