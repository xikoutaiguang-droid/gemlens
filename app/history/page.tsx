"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getOrCreateAccountCode,
  getStaleThresholdDays,
  ITEM_CATEGORIES,
  setAccountCode as persistAccountCode,
  setStaleThresholdDays,
} from "../../lib/clientUtils";
import { formatAccountCodeForDisplay, isValidAccountCode, normalizeAccountCode } from "../../lib/accountCode";

interface HistoryRecord {
  id: string;
  brandName: string;
  kana?: string;
  item?: string;
  purchasePrice?: number;
  salePrice?: number;
  purchasedAt?: string;
  soldAt?: string;
  createdAt: string;
  memo?: string;
}

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
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<HistoryRecord | null>(null);
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemCustom, setEditItemCustom] = useState("");
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

  const [staleThreshold, setStaleThreshold] = useState(60);
  const [staleThresholdInput, setStaleThresholdInput] = useState("60");

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
    const item = record.item ?? "";
    if (item && ITEM_CATEGORIES.includes(item) && item !== "その他") {
      setEditItemCategory(item);
      setEditItemCustom("");
    } else if (item) {
      setEditItemCategory("その他");
      setEditItemCustom(item);
    } else {
      setEditItemCategory("");
      setEditItemCustom("");
    }
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
      const item = editItemCategory === "その他" ? editItemCustom.trim() : editItemCategory;
      const res = await fetch(`/api/history/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode,
          item: item ? item : null,
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
          <span className="usage-badge">履歴</span>
        </div>
      </header>

      <div className="container">
        <div className="result-panel">
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
              <button className="csv-export-btn" onClick={exportCsv}>
                CSVエクスポート
              </button>
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
              <div>
                {records.map((r) => {
                  const sold = r.salePrice != null;
                  const profit =
                    r.salePrice != null && r.purchasePrice != null ? r.salePrice - r.purchasePrice : null;
                  const purchasedAt = toDateOnly(r.purchasedAt ?? r.createdAt);
                  const days = daysBetween(purchasedAt, sold ? r.soldAt ?? todayDateString() : todayDateString());
                  const isStale = !sold && days >= staleThreshold;
                  return (
                    <div className={`candidate-row${isStale ? " history-row-stale" : ""}`} key={r.id}>
                      <div className="candidate-main" onClick={() => openEdit(r)}>
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
              <label className="field-label">アイテム</label>
              <select
                className="field-input"
                value={editItemCategory}
                onChange={(e) => setEditItemCategory(e.target.value)}
                disabled={editSubmitting}
              >
                <option value="">選択してください</option>
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {editItemCategory === "その他" && (
                <input
                  className="field-input"
                  type="text"
                  placeholder="アイテム名を入力"
                  value={editItemCustom}
                  onChange={(e) => setEditItemCustom(e.target.value)}
                  disabled={editSubmitting}
                  style={{ marginTop: 8 }}
                />
              )}
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
                onChange={(e) => setEditSale(e.target.value)}
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
