"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateAccountCode, ITEM_CATEGORIES, setAccountCode as persistAccountCode } from "../../lib/clientUtils";
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

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + "T00:00:00");
  const to = new Date(toDateStr + "T00:00:00");
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function HistoryPage() {
  const [accountCode, setAccountCodeState] = useState<string | null>(null);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState<HistoryRecord | null>(null);
  const [editItem, setEditItem] = useState("");
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
  }, [loadHistory]);

  function openEdit(record: HistoryRecord) {
    setEditTarget(record);
    setEditItem(record.item ?? "");
    setEditPurchase(record.purchasePrice != null ? String(record.purchasePrice) : "");
    setEditSale(record.salePrice != null ? String(record.salePrice) : "");
    setEditPurchasedAt(record.purchasedAt ?? record.createdAt.slice(0, 10));
    setEditSoldAt(record.soldAt ?? "");
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
                  const purchasedAt = r.purchasedAt ?? r.createdAt.slice(0, 10);
                  const days = daysBetween(purchasedAt, sold ? r.soldAt ?? todayDateString() : todayDateString());
                  return (
                    <div className="candidate-row" key={r.id}>
                      <div className="candidate-main" onClick={() => openEdit(r)}>
                        <div className="candidate-left">
                          <div className="candidate-brand">{r.brandName}</div>
                          <div className="candidate-kana">{r.kana || ""}</div>
                          {r.item && <div className="history-item">{r.item}</div>}
                          {(r.purchasePrice != null || r.salePrice != null) && (
                            <div className="history-price">
                              {r.purchasePrice != null && `仕入 ${yen(r.purchasePrice)}`}
                              {r.purchasePrice != null && r.salePrice != null && "　"}
                              {r.salePrice != null && `売却 ${yen(r.salePrice)}`}
                            </div>
                          )}
                        </div>
                        <div className="candidate-right">
                          <span className={`status-badge ${sold ? "status-sold" : "status-instock"}`}>
                            {sold ? "売却済" : "在庫"}
                          </span>
                          {profit != null && <div className="history-profit">+{yen(profit)}</div>}
                          <div className="history-days">{sold ? `${days}日で売却` : `仕入れて${days}日`}</div>
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
            <div className="account-code-box">
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
              <input
                className="field-input"
                type="text"
                list="item-categories-edit"
                value={editItem}
                onChange={(e) => setEditItem(e.target.value)}
                disabled={editSubmitting}
              />
              <datalist id="item-categories-edit">
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
