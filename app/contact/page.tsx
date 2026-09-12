"use client";

import { useState } from "react";
import Link from "next/link";
import { getAccountCode } from "../../lib/clientUtils";

export default function ContactPage() {
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setError("お問い合わせ内容を入力してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          replyTo: replyTo.trim() || undefined,
          accountCode: getAccountCode(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "送信に失敗しました。");
        return;
      }
      setSent(true);
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="legal-root">
      <header>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }}>
          <svg className="brand-mark" viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M60,60 L130,110 L200,40 L270,110 L340,60 L400,190 L200,460 L0,190 Z"
              fill="white"
              stroke="black"
              strokeWidth="14"
              strokeLinejoin="round"
            />
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
        </Link>
        <div className="header-right">
          <span className="usage-badge">お問い合わせ</span>
        </div>
      </header>

      <div className="legal-body">
        <h1 className="legal-title">お問い合わせ</h1>
        <p style={{ marginBottom: 20, color: "var(--gray)", fontSize: 13 }}>
          不具合の報告やご要望などがあれば、以下のフォームからお送りください。
        </p>

        {sent ? (
          <div className="account-code-box" style={{ display: "block", padding: 20 }}>
            送信しました。ご連絡ありがとうございます。
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">お問い合わせ内容</label>
              <textarea
                className="field-input"
                style={{ minHeight: 140, resize: "vertical", fontFamily: "inherit" }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                placeholder="不具合の内容、ご要望など"
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label className="field-label">返信先メールアドレス（任意）</label>
              <input
                className="field-input"
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="返信が必要な場合のみ入力してください"
              />
            </div>
            {error && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 10 }}>{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "14px",
                background: "var(--black)",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "送信中..." : "送信する"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
