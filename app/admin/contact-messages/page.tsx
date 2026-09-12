"use client";

import { useEffect, useState, useCallback } from "react";
import { activateDeveloperKeyFromUrl, getDeveloperKey } from "../../../lib/clientUtils";

interface ContactMessage {
  id: string;
  message: string;
  replyTo?: string;
  accountCode?: string;
  createdAt: string;
}

export default function ContactMessagesAdminPage() {
  const [devKey, setDevKey] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: string | undefined) => {
    if (!key) return;
    try {
      const res = await fetch(`/api/admin/contact-messages?devKey=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "取得に失敗しました");
        return;
      }
      setMessages(data.messages);
    } catch {
      setError("通信エラーが発生しました");
    }
  }, []);

  useEffect(() => {
    activateDeveloperKeyFromUrl();
    const key = getDeveloperKey();
    setDevKey(key);
    load(key);
  }, [load]);

  async function handleDelete(id: string) {
    if (!devKey) return;
    if (!confirm("この問い合わせを削除しますか？")) return;
    await fetch("/api/admin/contact-messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devKey, id }),
    });
    load(devKey);
  }

  if (!devKey) {
    return <div style={{ padding: 40 }}>権限がありません（?devKey=... を付けてアクセスしてください）</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, marginBottom: 16 }}>お問い合わせ一覧</h1>
      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
      {messages === null ? (
        <div>読み込み中...</div>
      ) : messages.length === 0 ? (
        <div style={{ color: "#888" }}>お問い合わせはまだありません。</div>
      ) : (
        messages.map((m) => (
          <div key={m.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
              {new Date(m.createdAt).toLocaleString("ja-JP")}
              {m.replyTo ? ` ・ 返信先: ${m.replyTo}` : ""}
              {m.accountCode ? ` ・ コード: ${m.accountCode}` : ""}
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, marginBottom: 10 }}>{m.message}</div>
            <button
              onClick={() => handleDelete(m.id)}
              style={{ fontSize: 11, padding: "4px 10px", border: "1px solid #ccc", background: "white", cursor: "pointer" }}
            >
              削除
            </button>
          </div>
        ))
      )}
    </div>
  );
}
