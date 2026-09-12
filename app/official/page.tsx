"use client";

import { useEffect, useState } from "react";
import { normalizeAccountCode, isValidAccountCode, formatAccountCodeForDisplay } from "../../lib/accountCode";
import AdSlot from "../components/AdSlot";

interface AccountInfo {
  plan: "free" | "standard" | "premium";
  firstSeenAt?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

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

function PhoneChrome({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="official-phone">
      <div className="official-phone-header">
        <svg className="brand-mark" viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" width="20" height="24">
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
        <span className="logo-text">GemLens</span>
      </div>
      <div className="official-phone-body">{children}</div>
      {footer}
    </div>
  );
}

// 実際のアプリ本体（app/page.tsx）の待機画面・撮影ボタンと同じクラス（globals.css）を
// 再利用したスクリーンプレビュー。実物と食い違うスクリーンショットにならないよう、
// 静止画ではなくアプリ本体と共通のCSSクラスでそのまま再現する。
function AppPreview() {
  return (
    <PhoneChrome
      footer={
        <div className="official-phone-buttons">
          <div className="btn-panel">
            <button type="button" className="btn btn-camera">
              <svg className="btn-icon" viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>撮影する</span>
            </button>
            <button type="button" className="btn btn-gallery">
              <svg className="btn-icon" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>写真を選ぶ</span>
            </button>
          </div>
        </div>
      }
    >
      <div id="idle-msg">
        <svg className="idle-arrow" viewBox="0 0 24 34" width="24" height="34" aria-hidden="true">
          <line x1="12" y1="0" x2="12" y2="22" stroke="var(--red)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          <polyline points="4,18 12,26 20,18" stroke="var(--red)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="idle-text">Scan a tag to identify the brand</div>
      </div>
    </PhoneChrome>
  );
}

// 判定結果画面（app/page.tsx の #result-single）と同じクラスをそのまま再利用した
// サンプルプレビュー。表示しているブランド・相場は実データではなくサンプルのため、
// 誤解のないよう見出しで明示する。
function ResultPreview() {
  return (
    <PhoneChrome footer={<div className="official-phone-footer">サンプル表示</div>}>
      <div id="result-single" className="official-result-sample">
        <div className="single-header">
          <div className="single-names">
            <div id="disp-brand">STUSSY</div>
            <div id="disp-kana">ステューシー</div>
          </div>
        </div>
        <div className="market-section">
          <div className="market-header">AI 相場情報</div>
          <div className="market-block">
            <div className="market-block-label">人気アイテム・定番モデル</div>
            <div className="market-list">
              <div className="market-list-item">
                <span className="bullet-mark" />
                <span>8ボールロゴTシャツ</span>
              </div>
              <div className="market-list-item">
                <span className="bullet-mark" />
                <span>ワークシャツ</span>
              </div>
            </div>
          </div>
          <div className="market-block">
            <div className="market-block-label">中古相場（直近）</div>
            <div className="price-item">
              <div className="price-item-name">Tシャツ</div>
              <div className="price-tiers">
                <div className="price-tier">
                  <span className="price-tier-label">安め</span>
                  <span className="price-tier-value">2,000円</span>
                </div>
                <div className="price-tier price-tier-avg">
                  <span className="price-tier-label">平均</span>
                  <span className="price-tier-value">4,500円</span>
                </div>
                <div className="price-tier">
                  <span className="price-tier-label">高値</span>
                  <span className="price-tier-value">8,000円</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="section-divider" />
        <div className="info-section">
          <div className="info-label">備考</div>
          <div className="info-value">
            1980年カリフォルニア発、サーフ・スケートカルチャーを起源に持つストリートブランドの草分け。象徴的な手書きロゴが特徴。
          </div>
        </div>
      </div>
    </PhoneChrome>
  );
}

export default function OfficialSitePage() {
  const [codeInput, setCodeInput] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("code") ?? "";
  });
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [lookedUpCode, setLookedUpCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // body側は#app-root画面（撮影・履歴）用にoverflow:hiddenが既定のため、
  // このページ滞在中だけ通常のページスクロールに戻す（/legal等と同じ対応）。
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function lookup(code: string) {
    const normalized = normalizeAccountCode(code);
    setError("");
    if (!isValidAccountCode(normalized)) {
      setError("コードの形式が正しくありません");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/usage?accountCode=${encodeURIComponent(normalized)}`);
      const data = await res.json();
      setInfo({ plan: data.plan ?? "free", firstSeenAt: data.firstSeenAt });
      setLookedUpCode(normalized);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  // URLに?codeが付いていれば自動で照会する
  useEffect(() => {
    if (codeInput && isValidAccountCode(normalizeAccountCode(codeInput))) {
      lookup(codeInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="official-page">
      <header className="official-header">
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
      </header>

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

          <div className="official-phone-row">
            <AppPreview />
            <ResultPreview />
          </div>
          <div className="official-sample-caption">左：待機画面／右：判定結果画面（サンプル表示）</div>

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
          <SectionHeading eyebrow="Check your account" title="マイページ（簡易確認）" />
          <div className="official-card">
            {!lookedUpCode ? (
              <>
                <p className="official-card-note">復元コードを入力すると、現在のプランと登録日を確認できます。</p>
                <input
                  className="official-input"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                />
                {error && <div className="official-error">{error}</div>}
                <button className="official-btn" onClick={() => lookup(codeInput)} disabled={loading || !codeInput.trim()}>
                  {loading ? "確認中..." : "確認する"}
                </button>
              </>
            ) : (
              <div className="official-account-info">
                <div>
                  復元コード：<strong>{formatAccountCodeForDisplay(lookedUpCode)}</strong>
                </div>
                <div>
                  現在のプラン：
                  <strong>{info?.plan === "premium" ? "PREMIUM" : info?.plan === "standard" ? "STANDARD" : "FREE"}</strong>
                </div>
                {info?.firstSeenAt && <div>登録日：{formatDate(info.firstSeenAt)}</div>}
                <a href={`${APP_URL}/history`} className="official-btn official-btn-ghost">
                  アプリのマイページを開く
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="official-section">
          <SectionHeading eyebrow="FAQ" title="よくある質問" />
          <div className="official-faq">
            {[
              { q: "会員登録は必要ですか？", a: "不要です。ブラウザからそのままお使いいただけます。仕入れ記録を残したい場合のみ、端末間の引き継ぎ用に自動発行される「復元コード」を使います。" },
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
