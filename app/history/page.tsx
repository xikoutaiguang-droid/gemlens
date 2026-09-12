"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  compressImageFile,
  getOrCreateAccountCode,
  getStaleThresholdDays,
  setAccountCode as persistAccountCode,
  setStaleThresholdDays,
} from "../../lib/clientUtils";
import { formatAccountCodeForDisplay, isValidAccountCode, normalizeAccountCode } from "../../lib/accountCode";
import ItemCategoryPicker from "../components/ItemCategoryPicker";
import AdSlot from "../components/AdSlot";

interface HistoryRecord {
  id: string;
  brandName: string;
  kana?: string;
  item?: string;
  photo?: string;
  purchasePrice?: number;
  salePrice?: number;
  purchasedAt?: string;
  soldAt?: string;
  createdAt: string;
  memo?: string;
}

type StatusFilter = "all" | "instock" | "sold";

// app/api/history/route.tsのMONTHLY_SAVE_LIMITSと一致させる（表示専用の複製）
const MONTHLY_SAVE_LIMITS: Record<"free" | "standard" | "premium", number> = {
  free: 20,
  standard: 50,
  premium: Infinity,
};

function yen(n: number): string {
  return "¥" + n.toLocaleString();
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// 過去（機能追加以前）の記録はsoldAtが完全なISO日時文字列の場合があるため、
// 先頭10文字（YYYY-MM-DD）だけを見て両形式に対応する。
function toDateOnly(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function formatDate(dateStr: string): string {
  return toDateOnly(dateStr).replace(/-/g, "/");
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(toDateOnly(fromDateStr) + "T00:00:00");
  const to = new Date(toDateOnly(toDateStr) + "T00:00:00");
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function HistoryPage() {
  const [accountCode, setAccountCodeState] = useState<string | null>(null);
  const [plan, setPlan] = useState<"free" | "standard" | "premium">("free");
  const [periodTab, setPeriodTab] = useState<"all" | "month">("all");
  const [selectedMonth, setSelectedMonth] = useState(todayDateString().slice(0, 7));
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<HistoryRecord | null>(null);
  const [editItem, setEditItem] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [editPurchase, setEditPurchase] = useState("");
  const [editSale, setEditSale] = useState("");
  const [editPurchasedAt, setEditPurchasedAt] = useState("");
  const [editSoldAt, setEditSoldAt] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [showLinkInstructions, setShowLinkInstructions] = useState(false);

  const [staleThreshold, setStaleThreshold] = useState(60);
  const [staleThresholdInput, setStaleThresholdInput] = useState("60");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const loadHistory = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/history?accountCode=" + encodeURIComponent(code));
      const data = (await res.json()) as { success: boolean; records?: HistoryRecord[] };
      setRecords(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const code = getOrCreateAccountCode();
    setAccountCodeState(code);
    loadHistory(code);
    const threshold = getStaleThresholdDays();
    setStaleThreshold(threshold);
    setStaleThresholdInput(String(threshold));

    // 既にホーム画面から起動している場合は「追加して連携」ボタンの意味が無いため隠す
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    fetch(`/api/usage?accountCode=${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then((data: { plan?: "free" | "standard" | "premium" }) => {
        if (data.plan) setPlan(data.plan);
      })
      .catch(() => {
        // プラン取得に失敗しても本体機能には影響させない
      });
  }, [loadHistory]);

  function handleStaleThresholdChange(value: string) {
    setStaleThresholdInput(value);
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n > 0) {
      setStaleThreshold(n);
      setStaleThresholdDays(n);
    }
  }

  function openEdit(record: HistoryRecord) {
    setEditTarget(record);
    setEditItem(record.item ?? "");
    setEditPhoto(record.photo ?? "");
    setEditPurchase(record.purchasePrice != null ? String(record.purchasePrice) : "");
    setEditSale(record.salePrice != null ? String(record.salePrice) : "");
    setEditPurchasedAt(toDateOnly(record.purchasedAt ?? record.createdAt));
    setEditSoldAt(record.soldAt ? toDateOnly(record.soldAt) : "");
    setEditMemo(record.memo ?? "");
    setEditError("");
  }

  async function submitEdit() {
    if (!editTarget || !accountCode) return;
    setEditSubmitting(true);
    setEditError("");
    try {
      const res = await fetch(`/api/history/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode,
          item: editItem.trim() ? editItem.trim() : null,
          photo: editPhoto || null,
          purchasePrice: editPurchase.trim() ? Number(editPurchase) : null,
          salePrice: editSale.trim() ? Number(editSale) : null,
          purchasedAt: editPurchasedAt.trim() ? editPurchasedAt.trim() : null,
          soldAt: editSoldAt.trim() ? editSoldAt.trim() : null,
          memo: editMemo.trim() ? editMemo.trim() : null,
        }),
      });
      const data = (await res.json()) as { success: boolean; record?: HistoryRecord; message?: string };
      if (!data.success || !data.record) {
        setEditError(data.message || "保存に失敗しました");
        return;
      }
      setRecords((prev) => prev.map((r) => (r.id === data.record!.id ? data.record! : r)));
      setEditTarget(null);
    } catch {
      setEditError("送信中にエラーが発生しました");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleEditPhotoChange(file: File) {
    const compressed = await compressImageFile(file, 400);
    setEditPhoto(compressed);
  }

  async function handleDelete() {
    if (!editTarget || !accountCode) return;
    if (!window.confirm("この記録を削除しますか？")) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(
        `/api/history/${editTarget.id}?accountCode=${encodeURIComponent(accountCode)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        setRecords((prev) => prev.filter((r) => r.id !== editTarget.id));
        setEditTarget(null);
      } else {
        setEditError("削除に失敗しました");
      }
    } catch {
      setEditError("送信中にエラーが発生しました");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function copyCode() {
    if (!accountCode) return;
    try {
      await navigator.clipboard.writeText(formatAccountCodeForDisplay(accountCode));
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // クリップボード権限が無い環境では何もしない
    }
  }

  // 「ホーム画面に追加」時にiOSが読みに行くマニフェストのURLに、このコードを
  // クエリparamとして埋め込む。iOSはブラウザとホーム画面アプリでlocalStorageの
  // 保存領域が分離されているため、通常はコードを手動で控えて再入力する必要が
  // あったが、この仕組みによりホーム画面アプリ起動時に自動で復元コードが
  // 引き継がれるようになる。
  function startLinkedInstall() {
    if (!accountCode) return;
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.href = `/manifest.json?code=${encodeURIComponent(accountCode)}`;
    }
    setShowLinkInstructions(true);
  }

  async function submitRestore() {
    const normalized = normalizeAccountCode(restoreInput);
    setRestoreError("");
    if (!isValidAccountCode(normalized)) {
      setRestoreError("コードの形式が正しくありません");
      return;
    }
    try {
      const res = await fetch("/api/history?accountCode=" + encodeURIComponent(normalized));
      const data = (await res.json()) as { success: boolean; records?: HistoryRecord[] };
      if (!data.success) {
        setRestoreError("復元に失敗しました");
        return;
      }
      persistAccountCode(normalized);
      setAccountCodeState(normalized);
      setRecords(data.records ?? []);
      setRestoreInput("");
    } catch {
      setRestoreError("送信中にエラーが発生しました");
    }
  }

  function toCsvField(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  function exportCsv() {
    const headers = [
      "ブランド名",
      "かな",
      "アイテム",
      "仕入れ日",
      "仕入れ値",
      "売却日",
      "売却値",
      "利益",
      "ステータス",
      "メモ",
    ];
    const rows = records.map((r) => {
      const sold = r.salePrice != null;
      const purchasedAt = formatDate(r.purchasedAt ?? r.createdAt);
      const profit = sold && r.purchasePrice != null ? r.salePrice! - r.purchasePrice : null;
      return [
        r.brandName,
        r.kana ?? "",
        r.item ?? "",
        purchasedAt,
        r.purchasePrice != null ? String(r.purchasePrice) : "",
        r.soldAt ? formatDate(r.soldAt) : "",
        r.salePrice != null ? String(r.salePrice) : "",
        profit != null ? String(profit) : "",
        sold ? "売却済" : "在庫",
        r.memo ?? "",
      ]
        .map(toCsvField)
        .join(",");
    });
    // ExcelでUTF-8を正しく認識させるためBOMを付与する
    const BOM = "﻿";
    const csv = BOM + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gemlens_history_${todayDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const soldRecords = records.filter((r) => r.salePrice != null);
  const inStockCount = records.length - soldRecords.length;
  const totalProfit = soldRecords.reduce((sum, r) => {
    if (r.purchasePrice == null || r.salePrice == null) return sum;
    return sum + (r.salePrice - r.purchasePrice);
  }, 0);

  const currentMonthPrefix = todayDateString().slice(0, 7); // "YYYY-MM"

  // 記録が存在する月の一覧（新しい月順）。当月にまだ記録が無くても選べるよう必ず含める。
  const monthOptions = Array.from(
    new Set([currentMonthPrefix, ...records.map((r) => toDateOnly(r.purchasedAt ?? r.createdAt).slice(0, 7))])
  ).sort((a, b) => b.localeCompare(a));

  function purchasedCountInMonth(monthPrefix: string): number {
    return records.filter((r) => toDateOnly(r.purchasedAt ?? r.createdAt).startsWith(monthPrefix)).length;
  }
  function profitInMonth(monthPrefix: string): number {
    return records.reduce((sum, r) => {
      if (!r.soldAt || !toDateOnly(r.soldAt).startsWith(monthPrefix)) return sum;
      if (r.purchasePrice == null || r.salePrice == null) return sum;
      return sum + (r.salePrice - r.purchasePrice);
    }, 0);
  }

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const matches = r.brandName.toLowerCase().includes(q) || (r.kana ?? "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    const sold = r.salePrice != null;
    if (filterStatus === "instock" && sold) return false;
    if (filterStatus === "sold" && !sold) return false;
    const purchasedAt = toDateOnly(r.purchasedAt ?? r.createdAt);
    if (filterDateFrom && purchasedAt < filterDateFrom) return false;
    if (filterDateTo && purchasedAt > filterDateTo) return false;
    return true;
  });
  const isFiltering =
    searchQuery.trim() !== "" || filterStatus !== "all" || filterDateFrom !== "" || filterDateTo !== "";

  return (
    <div id="app-root">
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
          <span className="usage-badge">マイページ</span>
        </div>
      </header>

      <div className="container">
        <div className="result-panel">
          <div className="mypage-overview">
            <div className="mypage-plan-row">
              <span>
                現在のプラン：
                <strong>{plan === "premium" ? "PREMIUM" : plan === "standard" ? "STANDARD" : "FREE"}</strong>
              </span>
              <Link href="/upgrade" className="mypage-plan-btn">
                {plan === "free" ? "プランを見る" : "管理・変更する"}
              </Link>
            </div>

            {!loading && records.length > 0 && (
              <>
                <div className="period-tabs">
                  <button
                    className={`period-tab${periodTab === "all" ? " active" : ""}`}
                    onClick={() => setPeriodTab("all")}
                  >
                    全期間
                  </button>
                  <select
                    className={`period-tab period-tab-select${periodTab === "month" ? " active" : ""}`}
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      setPeriodTab("month");
                    }}
                    onFocus={() => setPeriodTab("month")}
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {m.replace("-", "年")}月
                      </option>
                    ))}
                  </select>
                </div>

                {periodTab === "all" ? (
                  <div className="history-summary">
                    <div className="history-summary-item">
                      <div className="history-summary-label">合計</div>
                      <div className="history-summary-value">{records.length}件</div>
                    </div>
                    <div className="history-summary-item">
                      <div className="history-summary-label">在庫</div>
                      <div className="history-summary-value">{inStockCount}件</div>
                    </div>
                    <div className="history-summary-item">
                      <div className="history-summary-label">売却済</div>
                      <div className="history-summary-value">{soldRecords.length}件</div>
                    </div>
                    <div className="history-summary-item">
                      <div className="history-summary-label">合計利益</div>
                      <div className="history-summary-value profit">{yen(totalProfit)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="history-summary history-summary-secondary">
                    <div className="history-summary-item">
                      <div className="history-summary-label">仕入れ件数</div>
                      <div className="history-summary-value">
                        {purchasedCountInMonth(selectedMonth)}件
                        {selectedMonth === currentMonthPrefix && MONTHLY_SAVE_LIMITS[plan] !== Infinity && (
                          <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 400 }}>
                            {" "}
                            / {MONTHLY_SAVE_LIMITS[plan]}件
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="history-summary-item">
                      <div className="history-summary-label">利益</div>
                      <div className="history-summary-value profit">{yen(profitInMonth(selectedMonth))}</div>
                    </div>
                  </div>
                )}

                <div className="mypage-csv-row">
                  <button className="csv-export-link" onClick={exportCsv}>
                    CSVエクスポート
                  </button>
                </div>
              </>
            )}
          </div>

          <AdSlot plan={plan} />

          {loading ? (
            <div style={{ textAlign: "center", color: "var(--gray)", padding: 40 }}>読み込み中...</div>
          ) : records.length === 0 ? (
            <div className="history-empty">
              まだ記録がありません。
              <br />
              スキャン結果画面の「仕入れ記録に追加」から登録できます。
            </div>
          ) : (
            <>
              <div className="history-filters">
                <input
                  className="field-input"
                  type="text"
                  placeholder="ブランド名で検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="field-input"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                >
                  <option value="all">すべて（在庫・売却済）</option>
                  <option value="instock">在庫のみ</option>
                  <option value="sold">売却済のみ</option>
                </select>
                <div className="history-filter-dates">
                  <input
                    className="field-input"
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                  />
                  <span>〜</span>
                  <input
                    className="field-input"
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                  />
                </div>
                {isFiltering && (
                  <div className="history-filter-count">
                    {filteredRecords.length} / {records.length}件を表示中
                  </div>
                )}
              </div>

              {filteredRecords.length === 0 ? (
                <div className="history-empty">条件に一致する記録がありません。</div>
              ) : (
              <div>
                {filteredRecords.map((r) => {
                  const sold = r.salePrice != null;
                  const profit =
                    r.salePrice != null && r.purchasePrice != null ? r.salePrice - r.purchasePrice : null;
                  const purchasedAt = toDateOnly(r.purchasedAt ?? r.createdAt);
                  const days = daysBetween(purchasedAt, sold ? r.soldAt ?? todayDateString() : todayDateString());
                  const isStale = !sold && days >= staleThreshold;
                  return (
                    <div className={`candidate-row${isStale ? " history-row-stale" : ""}`} key={r.id}>
                      <div className="candidate-main" onClick={() => openEdit(r)}>
                        {r.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- 保存済みdata URLのサムネイルのためnext/imageは非対応
                          <img className="history-thumb" src={r.photo} alt="" />
                        ) : (
                          <div className="history-thumb history-thumb-empty" aria-hidden="true" />
                        )}
                        <div className="candidate-left">
                          <div className="candidate-brand">{r.brandName}</div>
                          <div className="candidate-kana">{r.kana || ""}</div>
                          {r.item && <div className="history-item">{r.item}</div>}
                          <div className="history-price">
                            仕入 {r.purchasePrice != null ? yen(r.purchasePrice) : "—"}（{formatDate(purchasedAt)}）
                          </div>
                          {sold && (
                            <div className="history-price">
                              売却 {yen(r.salePrice!)}
                              {r.soldAt && `（${formatDate(r.soldAt)}）`}
                            </div>
                          )}
                        </div>
                        <div className="candidate-right">
                          <span
                            className={`status-badge ${sold ? "status-sold" : isStale ? "status-stale" : "status-instock"}`}
                          >
                            {sold ? "売却済" : isStale ? "滞留" : "在庫"}
                          </span>
                          {profit != null && <div className="history-profit">+{yen(profit)}</div>}
                          <div className={`history-days${isStale ? " stale" : ""}`}>
                            {sold ? `${days}日で売却` : `仕入れて${days}日`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </>
          )}

          <details className="history-settings">
            <summary>設定・端末の引き継ぎ</summary>
            <div className="field">
              <label className="field-label">滞留アラートのしきい値（日数）</label>
              <input
                className="field-input"
                type="number"
                inputMode="numeric"
                min={1}
                value={staleThresholdInput}
                onChange={(e) => handleStaleThresholdChange(e.target.value)}
              />
              <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 4 }}>
                在庫が仕入れてからこの日数以上経過すると、一覧で「滞留」として目立たせます（デフォルト60日）。
              </div>
            </div>
            <div className="account-code-box" style={{ marginTop: 20 }}>
              <span className="account-code-value">
                {accountCode ? formatAccountCodeForDisplay(accountCode) : ""}
              </span>
              <button
                onClick={copyCode}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 12px",
                  border: "2px solid var(--black)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                {codeCopied ? "コピーしました" : "コピー"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 6, lineHeight: 1.6 }}>
              このコードを紛失すると記録に二度とアクセスできなくなります。メモ帳等に控えておくか、
              上部の「CSVエクスポート」で定期的にバックアップを取ることをおすすめします。
            </div>

            {!isStandalone && (
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={startLinkedInstall}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "var(--black)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 13,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ホーム画面に追加して連携
                </button>
                {showLinkInstructions && (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.7,
                      marginTop: 8,
                      padding: 10,
                      background: "#fafafa",
                      border: "2px solid var(--black)",
                    }}
                  >
                    このまま共有ボタン（
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: "-2px" }}>
                      <path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    ）をタップし、「ホーム画面に追加」を選んでください。この記録がホーム画面のアプリに自動的に引き継がれます。
                  </div>
                )}
              </div>
            )}
            <div className="field" style={{ marginTop: 12 }}>
              <label className="field-label">別の端末のコードを復元</label>
              <input
                className="field-input"
                value={restoreInput}
                onChange={(e) => setRestoreInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
              />
              {restoreError && <div style={{ color: "var(--red)", fontSize: 12 }}>{restoreError}</div>}
              <button className="btn btn-submit" onClick={submitRestore}>
                このコードを復元する
              </button>
            </div>
          </details>
        </div>
      </div>

      {editTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && !editSubmitting && setEditTarget(null)}
        >
          <div className="sheet-box">
            <div className="modal-header">
              <div className="modal-names">
                <div id="modal-brand">{editTarget.brandName}</div>
                <div id="modal-kana">{editTarget.kana || ""}</div>
              </div>
              <button className="modal-close" onClick={() => setEditTarget(null)} disabled={editSubmitting}>
                ×
              </button>
            </div>
            <div className="modal-divider" />
            <div className="field">
              <label className="field-label">写真</label>
              <div className="edit-photo-row">
                {editPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 保存済み/選択済みdata URLのプレビューのためnext/imageは非対応
                  <img className="edit-photo-preview" src={editPhoto} alt="" />
                ) : (
                  <div className="edit-photo-preview edit-photo-preview-empty" aria-hidden="true" />
                )}
                <div className="edit-photo-actions">
                  <label htmlFor="edit-photo-input" className="edit-photo-btn">
                    {editPhoto ? "写真を変更" : "写真を追加"}
                  </label>
                  <input
                    id="edit-photo-input"
                    type="file"
                    accept="image/*"
                    disabled={editSubmitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleEditPhotoChange(file);
                      e.target.value = "";
                    }}
                  />
                  {editPhoto && (
                    <button
                      type="button"
                      className="edit-photo-btn edit-photo-remove"
                      onClick={() => setEditPhoto("")}
                      disabled={editSubmitting}
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="field">
              <label className="field-label">アイテム</label>
              <ItemCategoryPicker initialValue={editTarget.item} onChange={setEditItem} disabled={editSubmitting} />
            </div>
            <div className="field">
              <label className="field-label">仕入れ日</label>
              <input
                className="field-input"
                type="date"
                value={editPurchasedAt}
                onChange={(e) => setEditPurchasedAt(e.target.value)}
                disabled={editSubmitting}
              />
            </div>
            <div className="field">
              <label className="field-label">仕入れ値（円）</label>
              <input
                className="field-input"
                type="number"
                inputMode="numeric"
                value={editPurchase}
                onChange={(e) => setEditPurchase(e.target.value)}
                disabled={editSubmitting}
              />
            </div>
            <div className="field">
              <label className="field-label">売却日</label>
              <input
                className="field-input"
                type="date"
                value={editSoldAt}
                onChange={(e) => setEditSoldAt(e.target.value)}
                disabled={editSubmitting}
              />
            </div>
            <div className="field">
              <label className="field-label">売却値（円）</label>
              <input
                className="field-input"
                type="number"
                inputMode="numeric"
                value={editSale}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditSale(value);
                  // 売却値を初めて入力した際、売却日が空欄なら今日の日付を自動で補う
                  if (value.trim() && !editSoldAt) {
                    setEditSoldAt(todayDateString());
                  }
                }}
                disabled={editSubmitting}
              />
            </div>
            <div className="field">
              <label className="field-label">メモ</label>
              <textarea
                className="field-textarea"
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                disabled={editSubmitting}
              />
            </div>
            {editError && <div style={{ color: "var(--red)", fontSize: 12 }}>{editError}</div>}
            <div className="btn-panel">
              <button className="btn btn-delete" onClick={handleDelete} disabled={editSubmitting}>
                削除
              </button>
              <button className="btn btn-submit" onClick={submitEdit} disabled={editSubmitting}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
