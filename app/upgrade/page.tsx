"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateAccountCode } from "../../lib/clientUtils";

type PlanLevel = "free" | "standard" | "premium";

const PLANS: { id: "standard" | "premium"; name: string; price: string; trial?: string; features: string[] }[] = [
  {
    id: "standard",
    name: "STANDARD",
    price: "¥500 / 月",
    features: ["1日のスキャン回数上限を撤廃"],
  },
  {
    id: "premium",
    name: "PREMIUM",
    price: "¥980 / 月",
    trial: "7日間無料でお試しいただけます",
    features: ["1日のスキャン回数上限を撤廃", "Google検索連携による高精度ブランド判定", "画像類似検索フォールバック（ロゴのみのタグに強い）"],
  },
];

export default function UpgradePage() {
  const [currentPlan, setCurrentPlan] = useState<PlanLevel | null>(null);
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [managingPortal, setManagingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) setNotice("お申し込みありがとうございます。反映まで数秒かかる場合があります。");
    if (params.get("canceled")) setNotice("お手続きをキャンセルしました。");

    const accountCode = getOrCreateAccountCode();
    fetch(`/api/usage?accountCode=${encodeURIComponent(accountCode)}`)
      .then((res) => res.json())
      .then((data: { plan?: PlanLevel }) => setCurrentPlan(data.plan ?? "free"))
      .catch(() => setCurrentPlan("free"));
  }, []);

  async function handleSubscribe(plan: "standard" | "premium") {
    setSubmittingPlan(plan);
    setError(null);
    try {
      const accountCode = getOrCreateAccountCode();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode, plan }),
      });
      const data = await res.json();
      if (!data.success || !data.url) {
        setError(data.message || "決済ページの作成に失敗しました。");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSubmittingPlan(null);
    }
  }

  async function handleManage() {
    setManagingPortal(true);
    setError(null);
    try {
      const accountCode = getOrCreateAccountCode();
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountCode }),
      });
      const data = await res.json();
      if (!data.success || !data.url) {
        setError(data.message || "管理ページの作成に失敗しました。");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setManagingPortal(false);
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
          <span className="usage-badge">プラン</span>
        </div>
      </header>

      <div className="legal-body">
        <h1 className="legal-title">プランを選択</h1>
        {notice && (
          <div style={{ background: "#fafafa", border: "2px solid var(--black)", padding: 12, marginBottom: 16, fontSize: 13 }}>
            {notice}
          </div>
        )}
        {error && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {currentPlan && currentPlan !== "free" && (
          <div style={{ marginBottom: 24, padding: 16, border: "2px solid var(--black)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              現在のプラン：{currentPlan === "premium" ? "PREMIUM" : "STANDARD"}
            </div>
            <button
              onClick={handleManage}
              disabled={managingPortal}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 14px",
                border: "2px solid var(--black)",
                background: "white",
                cursor: managingPortal ? "default" : "pointer",
              }}
            >
              {managingPortal ? "読み込み中..." : "サブスクを管理・解約"}
            </button>
          </div>
        )}

        {PLANS.map((plan) => (
          <div
            key={plan.id}
            style={{
              border: plan.id === "premium" ? "2px solid var(--red)" : "2px solid var(--black)",
              padding: 20,
              marginBottom: 20,
              opacity: currentPlan === plan.id ? 0.6 : 1,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 4,
                color: plan.id === "premium" ? "var(--red)" : "inherit",
              }}
            >
              {plan.name}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{plan.price}</div>
            {plan.trial && <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, marginBottom: 10 }}>{plan.trial}</div>}
            <ul style={{ paddingLeft: 18, marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={submittingPlan !== null || currentPlan === plan.id}
              style={{
                width: "100%",
                padding: "12px",
                background: currentPlan === plan.id ? "#ccc" : "var(--black)",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: submittingPlan !== null || currentPlan === plan.id ? "default" : "pointer",
              }}
            >
              {currentPlan === plan.id ? "現在のプラン" : submittingPlan === plan.id ? "読み込み中..." : "申し込む"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
