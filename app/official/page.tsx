"use client";

import { useEffect, useState } from "react";
import { normalizeAccountCode, isValidAccountCode, formatAccountCodeForDisplay } from "../../lib/accountCode";

interface AccountInfo {
  plan: "free" | "standard" | "premium";
  firstSeenAt?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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

  const APP_URL = "https://gemlens-tawny.vercel.app";

  return (
    <div style={{ fontFamily: "-apple-system,'Helvetica Neue',sans-serif", background: "#f2f2f2", minHeight: "100vh" }}>
      <header style={{ background: "#0a0a0a", color: "white", padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontStyle: "italic" }}>GEMLENS</div>
        <div style={{ fontSize: 12, color: "#ccc", marginTop: 4 }}>公式サイト</div>
      </header>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 20px 60px" }}>
        <section style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 18, marginBottom: 10 }}>ブランドタグを撮るだけで判定</h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#333" }}>
            GEMLENSは、アパレル製品のタグを撮影するだけでAIがブランド名を判定し、
            古着買取・販売の相場情報も確認できる無料ツールです。会員登録は不要で、
            すぐにお使いいただけます。
          </p>
          <a
            href={APP_URL}
            style={{
              display: "block",
              marginTop: 16,
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

        <section style={{ border: "2px solid #0a0a0a", padding: 20, background: "white" }}>
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
      </div>
    </div>
  );
}
