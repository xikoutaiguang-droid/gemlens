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

// 実際のアプリ本体（app/page.tsx）の待機画面と同じクラス（globals.css）を再利用した
// スクリーンプレビュー。実物と食い違うスクリーンショットにならないよう、
// 静止画ではなくアプリ本体と共通のCSSクラスでそのまま再現する。
function AppPreview() {
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
      <div className="official-phone-body">
        <div id="idle-msg">
          <svg className="idle-arrow" viewBox="0 0 24 34" width="24" height="34" aria-hidden="true">
            <line x1="12" y1="0" x2="12" y2="22" stroke="var(--red)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
            <polyline points="4,18 12,26 20,18" stroke="var(--red)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="idle-text">Scan a tag to identify the brand</div>
        </div>
      </div>
      <div className="official-phone-footer">撮影する</div>
    </div>
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
      <header style={{ background: "#0a0a0a", color: "white", padding: "20px", textAlign: "center" }}>
        <div className="logo-text" style={{ fontSize: 22 }}>
          GemLens
        </div>
        <div style={{ fontSize: 11, color: "#999", marginTop: 6, letterSpacing: 1 }}>公式サイト</div>
      </header>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 60px" }}>
        <section style={{ marginBottom: 36, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, marginBottom: 10, lineHeight: 1.5 }}>ブランドタグを撮るだけで、その場で判定</h1>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#333", marginBottom: 20, textAlign: "left" }}>
            GEMLENSは、アパレル製品のタグを撮影するだけでAIがブランド名を判定し、
            古着買取・販売の相場情報も確認できるツールです。会員登録は不要で、
            ブラウザからすぐにお使いいただけます。
          </p>
          <AppPreview />
          <a
            href={APP_URL}
            style={{
              display: "block",
              marginTop: 24,
              padding: "14px",
              background: "#0a0a0a",
              color: "white",
              textAlign: "center",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            アプリを開く
          </a>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, marginBottom: 14, borderBottom: "2px solid #0a0a0a", paddingBottom: 8 }}>
            使い方
          </h2>
          <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { n: "1", t: "タグを撮影する", d: "服のブランドタグを1〜3枚撮影します。文字が読みにくい記号だけのタグは複数枚がおすすめです。" },
              { n: "2", t: "AIが自動で判定", d: "刺繍や印字の文字をAIが読み取り、登録済みのブランドデータベースと照合します。" },
              { n: "3", t: "相場情報を確認", d: "判定結果と合わせて、買取・販売の目安相場や人気アイテムの情報も表示されます。" },
            ].map((step) => (
              <li key={step.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#0a0a0a",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{step.t}</div>
                  <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>{step.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, marginBottom: 14, borderBottom: "2px solid #0a0a0a", paddingBottom: 8 }}>
            こんな方におすすめ
          </h2>
          <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 2, color: "#333" }}>
            <li>古着の買取・販売を行っている個人事業主・小規模店舗の方</li>
            <li>フリマアプリやオークションで仕入れ・出品をしている方</li>
            <li>タグの文字が読みにくく、ブランドの見分けに時間がかかっている方</li>
          </ul>
        </section>

        <section style={{ border: "2px solid #0a0a0a", padding: 20, background: "white", marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>マイページ（簡易確認）</h2>

          {!lookedUpCode ? (
            <>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 10, lineHeight: 1.6 }}>
                復元コードを入力すると、現在のプランと登録日を確認できます。
              </p>
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                style={{
                  width: "100%",
                  padding: 12,
                  fontSize: 16,
                  border: "2px solid #0a0a0a",
                  boxSizing: "border-box",
                  marginBottom: 8,
                }}
              />
              {error && <div style={{ color: "#E31E24", fontSize: 12, marginBottom: 8 }}>{error}</div>}
              <button
                onClick={() => lookup(codeInput)}
                disabled={loading || !codeInput.trim()}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#0a0a0a",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {loading ? "確認中..." : "確認する"}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <div>
                復元コード：<strong>{formatAccountCodeForDisplay(lookedUpCode)}</strong>
              </div>
              <div>
                現在のプラン：
                <strong>{info?.plan === "premium" ? "PREMIUM" : info?.plan === "standard" ? "STANDARD" : "FREE"}</strong>
              </div>
              {info?.firstSeenAt && <div>登録日：{formatDate(info.firstSeenAt)}</div>}
              <a
                href={`${APP_URL}/history`}
                style={{
                  display: "block",
                  marginTop: 14,
                  padding: "10px",
                  background: "white",
                  color: "#0a0a0a",
                  border: "2px solid #0a0a0a",
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                アプリのマイページを開く
              </a>
            </div>
          )}
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15, marginBottom: 14, borderBottom: "2px solid #0a0a0a", paddingBottom: 8 }}>
            よくある質問
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { q: "会員登録は必要ですか？", a: "不要です。ブラウザからそのままお使いいただけます。仕入れ記録を残したい場合のみ、端末間の引き継ぎ用に自動発行される「復元コード」を使います。" },
              { q: "無料で使えますか？", a: "1日10回までのスキャンと、月20件までの仕入れ記録の保存は無料です。回数無制限やより高精度な判定は有料プランでご利用いただけます。" },
              { q: "対応しているブランドは？", a: "国内外の古着市場で流通する主要ブランドに対応しています。データベースは順次拡充しています。" },
            ].map((item) => (
              <div key={item.q}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Q. {item.q}</div>
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.8 }}>A. {item.a}</div>
              </div>
            ))}
          </div>
        </section>

        <AdSlot />

        <footer style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #ddd", textAlign: "center" }}>
          <a href={`${APP_URL}/legal`} style={{ fontSize: 11, color: "#888", textDecoration: "underline" }}>
            利用規約・プライバシーポリシー
          </a>
        </footer>
      </div>
    </div>
  );
}
