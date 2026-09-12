"use client";

import { useEffect, useState } from "react";
import {
  normalizeAccountCode,
  isValidAccountCode,
  formatAccountCodeForDisplay,
  generateAccountCode,
} from "../../../lib/accountCode";

interface AccountInfo {
  plan: "free" | "standard" | "premium";
  firstSeenAt?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const APP_URL = "https://gemlens-tawny.vercel.app";

export default function MyPagePage() {
  const [codeInput, setCodeInput] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("code") ?? "";
  });
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [lookedUpCode, setLookedUpCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

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

  // IDコードを持っていない新規ユーザー向けに、ここでその場でコードを発行する。
  // このコードを ?code= 付きで本体アプリに渡すと、アプリ側で自動的に保存される
  // （app/history/page.tsx 側の対応ロジックを参照）。
  function startNewCode() {
    setNewCode(generateAccountCode());
  }

  return (
    <div className="official-page">
      <div className="official-container">
        <section className="official-hero" style={{ paddingTop: 36 }}>
          <div className="official-eyebrow">Check your account</div>
          <h1 className="official-h1">マイページ</h1>
          <p className="official-lead">IDコードで現在のプランや登録日を確認したり、新しいIDコードを発行したりできます。</p>

          <div className="official-card">
            {newCode ? (
              <div className="official-account-info">
                <p className="official-card-note">
                  新しいIDコードを発行しました。端末を切り替える際にも使うコードなので、控えておいてください。
                </p>
                <div>
                  IDコード：<strong>{formatAccountCodeForDisplay(newCode)}</strong>
                </div>
                <a href={`${APP_URL}/history?code=${encodeURIComponent(newCode)}`} className="official-btn">
                  このコードでアプリを開く
                </a>
              </div>
            ) : !lookedUpCode ? (
              <>
                <p className="official-card-note">IDコードを入力すると、現在のプランと登録日を確認できます。</p>
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
                <p className="official-card-note" style={{ marginTop: 20, marginBottom: 8 }}>
                  IDコードをお持ちでない方（はじめての方）はこちら
                </p>
                <button type="button" className="official-btn official-btn-ghost" onClick={startNewCode}>
                  新しくIDコードを発行する
                </button>
              </>
            ) : (
              <div className="official-account-info">
                <div>
                  IDコード：<strong>{formatAccountCodeForDisplay(lookedUpCode)}</strong>
                </div>
                <div>
                  現在のプラン：
                  <strong>{info?.plan === "premium" ? "PREMIUM" : info?.plan === "standard" ? "STANDARD" : "FREE"}</strong>
                </div>
                {info?.firstSeenAt && <div>登録日：{formatDate(info.firstSeenAt)}</div>}
                <a href={`${APP_URL}/history?code=${encodeURIComponent(lookedUpCode)}`} className="official-btn official-btn-ghost">
                  アプリのマイページを開く
                </a>
              </div>
            )}
          </div>
        </section>

        <footer className="official-footer">
          <a href={`${APP_URL}/legal`}>利用規約・プライバシーポリシー</a>
        </footer>
      </div>
    </div>
  );
}
