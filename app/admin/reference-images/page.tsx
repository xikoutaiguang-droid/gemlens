"use client";

import { useEffect, useState } from "react";
import { activateDeveloperKeyFromUrl, compressImageFile, getDeveloperKey } from "../../../lib/clientUtils";

interface StagedImage {
  file: File;
  preview: string;
}

interface UploadResult {
  success: boolean;
  saved: number;
  total: number;
  errors: string[];
}

export default function ReferenceImagesAdminPage() {
  const [devKey, setDevKey] = useState<string | undefined>(undefined);
  const [brandName, setBrandName] = useState("");
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    activateDeveloperKeyFromUrl();
    setDevKey(getDeveloperKey());
  }, []);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setStaged(files.map((file) => ({ file, preview: URL.createObjectURL(file) })));
    setResult(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!brandName.trim() || staged.length === 0) {
      setError("ブランド名と画像を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const images = await Promise.all(staged.map((s) => compressImageFile(s.file)));
      const res = await fetch("/api/admin/reference-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devKey, brandName: brandName.trim(), images }),
      });
      const data = (await res.json()) as UploadResult;
      setResult(data);
      if (data.success) {
        setStaged([]);
        setBrandName("");
      }
    } catch {
      setError("送信中にエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (devKey === undefined) {
    return <div style={{ padding: 24, fontFamily: "sans-serif" }}>読み込み中...</div>;
  }

  if (!devKey) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        開発者キーが必要です。URLに <code>?dev=&lt;キー&gt;</code> を付けて再度開いてください。
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>参照画像の登録</h1>
      <p style={{ fontSize: 13, color: "#6b6b6b", marginBottom: 24 }}>
        識別できなかったブランドのタグ実物写真を登録し、画像類似検索の参照データとして使用します。
      </p>

      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>ブランド名</label>
      <input
        type="text"
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
        placeholder="例: ARTS&SCIENCE"
        style={{ width: "100%", padding: 10, fontSize: 15, border: "2px solid #0a0a0a", marginBottom: 20 }}
      />

      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>タグ写真（複数選択可）</label>
      <input type="file" accept="image/*" multiple onChange={handleFilesSelected} style={{ marginBottom: 16 }} />

      {staged.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {staged.map((s, i) => (
            <img
              key={i}
              src={s.preview}
              alt={`preview-${i}`}
              style={{ width: 80, height: 80, objectFit: "cover", border: "1px solid #ccc" }}
            />
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: "100%",
          padding: 14,
          fontSize: 15,
          fontWeight: 700,
          background: "#0a0a0a",
          color: "#fff",
          border: "none",
          cursor: submitting ? "default" : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "登録中..." : "登録する"}
      </button>

      {error && <p style={{ color: "#E31E24", marginTop: 16 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 16, fontSize: 14 }}>
          <p>
            {result.saved} / {result.total} 件を登録しました。
          </p>
          {result.errors.length > 0 && (
            <ul style={{ color: "#E31E24" }}>
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
