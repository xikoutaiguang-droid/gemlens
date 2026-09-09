"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_IMAGES = 3;
const SCAN_TIMEOUT_MS = 20000;
const LOADING_STEPS = ["Uploading...", "Reading tag...", "Identifying brand...", "Fetching market info..."];

// ============================================================
//  型
// ============================================================
interface MarketAdvice {
  popularItems?: string;
  marketValue?: string;
  listingCount?: string;
}

interface Candidate {
  brandName: string;
  kana?: string;
  rank?: string;
  info?: string;
  scorePercent: number;
  marketInfo?: MarketAdvice | null;
}

interface ScanResult {
  success: boolean;
  single?: boolean;
  brandName?: string;
  kana?: string;
  info?: string;
  candidates?: Candidate[];
  familyAlert?: boolean;
  guessedBrand?: string;
  message?: string;
  debugText?: string;
  limitReached?: boolean;
  marketInfo?: MarketAdvice | null;
}

type Phase = "idle" | "staging" | "loading" | "result-single" | "result-candidates" | "result-error";

// ============================================================
//  端末識別ID（1日の無料利用回数カウント用）
// ============================================================
function getDeviceId(): string {
  try {
    const KEY = "brandtag_device_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

// ============================================================
//  画像リサイズ・圧縮
// ============================================================
function resizeAndCompress(source: CanvasImageSource, srcW: number, srcH: number): string {
  const canvas = document.createElement("canvas");
  const MAX = 1200;
  let w = srcW;
  let h = srcH;
  if (w > h) {
    if (w > MAX) {
      h = Math.round((h * MAX) / w);
      w = MAX;
    }
  } else if (h > MAX) {
    w = Math.round((w * MAX) / h);
    h = MAX;
  }
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(resizeAndCompress(img, img.width, img.height));
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
//  相場情報の表示（人気アイテム / 価格帯）
// ============================================================
function BulletList({ text }: { text?: string }) {
  const lines = (text || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) {
    return (
      <div className="market-list">
        <div className="market-list-item">
          <span className="bullet-mark" />
          <span>情報なし</span>
        </div>
      </div>
    );
  }
  return (
    <div className="market-list">
      {lines.map((line, i) => (
        <div className="market-list-item" key={i}>
          <span className="bullet-mark" />
          <span>{line.replace(/^[・\-*]\s*/, "")}</span>
        </div>
      ))}
    </div>
  );
}

const PRICE_LINE_RE = /^(.+?)[：:]\s*安め\s*([^／/]+)[／/]\s*平均\s*([^／/]+)[／/]\s*高値\s*(.+)$/;

function PriceList({ text }: { text?: string }) {
  const lines = (text || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) {
    return (
      <div className="market-list">
        <div className="market-list-item">
          <span className="bullet-mark" />
          <span>情報なし</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      {lines.map((line, i) => {
        const m = line.match(PRICE_LINE_RE);
        if (m) {
          const tiers: [string, string][] = [
            ["安め", m[2].trim()],
            ["平均", m[3].trim()],
            ["高値", m[4].trim()],
          ];
          return (
            <div className="price-item" key={i}>
              <div className="price-item-name">{m[1].trim()}</div>
              <div className="price-tiers">
                {tiers.map(([label, value]) => (
                  <div className={"price-tier" + (label === "平均" ? " price-tier-avg" : "")} key={label}>
                    <span className="price-tier-label">{label}</span>
                    <span className="price-tier-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div className="market-list-item" key={i}>
            <span className="bullet-mark" />
            <span>{line}</span>
          </div>
        );
      })}
    </div>
  );
}

function MarketSection({ info }: { info?: MarketAdvice | null }) {
  if (!info || (!info.popularItems && !info.marketValue && !info.listingCount)) return null;
  return (
    <div className="market-section" style={{ display: "flex" }}>
      <div className="market-header">AI 相場情報</div>
      <div className="market-block">
        <div className="market-block-label">人気アイテム・定番モデル</div>
        <div className="market-block-value">
          <BulletList text={info.popularItems} />
        </div>
      </div>
      <div className="market-block">
        <div className="market-block-label">中古相場（直近）</div>
        <div className="market-block-value">
          <PriceList text={info.marketValue} />
        </div>
      </div>
      {info.listingCount && (
        <div className="market-block">
          <div className="market-block-label">出品件数の目安（参考値）</div>
          <div className="market-block-value">
            <BulletList text={info.listingCount} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  インライン撮影パネル（getUserMedia、無音・カメラ限定）
// ============================================================
function CameraOverlay({
  remainingSlots,
  onDone,
  onClose,
}: {
  remainingSlots: number;
  onDone: (images: string[]) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        const err = e as { name?: string };
        setError(
          `カメラを起動できませんでした（${err?.name || "エラー"}）。ブラウザのカメラ許可設定をご確認のうえ、再度お試しください。`
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || shots.length >= remainingSlots) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const dataUrl = resizeAndCompress(video, w, h);
    setShots((prev) => [...prev, dataUrl]);
  }, [shots.length, remainingSlots]);

  const removeShot = useCallback((index: number) => {
    setShots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const finish = useCallback(() => {
    if (!shots.length) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onDone(shots);
  }, [shots, onDone]);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  }, [onClose]);

  if (error) {
    return (
      <div className="camera-error">
        <p>{error}</p>
        <button onClick={handleClose}>閉じる</button>
      </div>
    );
  }

  return (
    <div className="camera-view">
      <div className="camera-top">
        <span className="camera-count">
          {shots.length} / {remainingSlots}枚
        </span>
        <button className="camera-close" onClick={handleClose} aria-label="閉じる">
          &times;
        </button>
      </div>
      <video ref={videoRef} autoPlay playsInline muted />
      <div className="camera-controls">
        <div className="camera-thumbs">
          {shots.map((src, i) => (
            <div className="camera-thumb" key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ローカル撮影データURLのプレビューのためnext/imageは非対応 */}
              <img src={src} alt="" />
              <button
                aria-label="削除"
                onClick={(e) => {
                  e.stopPropagation();
                  removeShot(i);
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <div className="camera-shutter-row">
          <button
            className="camera-shutter"
            onClick={capture}
            disabled={shots.length >= remainingSlots}
            aria-label="撮影"
          />
        </div>
        {shots.length > 0 && (
          <button className="camera-done" onClick={finish}>
            この内容でGEMLENSへ戻る（{shots.length}枚）
          </button>
        )}
        <div className="camera-hint">無音・カメラ限定の撮影ページです（最大{remainingSlots}枚）</div>
      </div>
    </div>
  );
}

// ============================================================
//  メイン画面
// ============================================================
export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stagedImages, setStagedImages] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [modalCandidate, setModalCandidate] = useState<Candidate | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showRetry, setShowRetry] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const resultPanelRef = useRef<HTMLDivElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRequestIdRef = useRef(0);
  const lastImagesRef = useRef<string[] | null>(null);

  const scrollTop = useCallback(() => {
    setTimeout(() => {
      if (resultPanelRef.current) resultPanelRef.current.scrollTop = 0;
    }, 50);
  }, []);

  const stopLoadingAnim = useCallback(() => {
    if (loadingTimerRef.current) {
      clearInterval(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  }, []);

  const startLoadingAnim = useCallback(() => {
    let step = 0;
    setLoadingStep(0);
    loadingTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, LOADING_STEPS.length - 1);
      setLoadingStep(step);
      if (step === LOADING_STEPS.length - 1) stopLoadingAnim();
    }, 2500);
  }, [stopLoadingAnim]);

  const resetToIdle = useCallback(() => {
    setStagedImages([]);
    setCameraOpen(false);
    setResult(null);
    setModalCandidate(null);
    setShowRetry(false);
    setPhase("idle");
    scrollTop();
  }, [scrollTop]);

  const runScan = useCallback(
    async (images: string[]) => {
      lastImagesRef.current = images;
      const myId = ++scanRequestIdRef.current;

      setModalCandidate(null);
      setShowRetry(false);
      setPhase("loading");
      startLoadingAnim();

      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = setTimeout(() => {
        if (myId === scanRequestIdRef.current) setShowRetry(true);
      }, SCAN_TIMEOUT_MS);

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images, deviceId: getDeviceId() }),
        });
        const data: ScanResult = await res.json();

        if (myId !== scanRequestIdRef.current) return;
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

        stopLoadingAnim();
        setStagedImages([]);
        setResult(data);
        setPhase(!data.success ? "result-error" : data.single ? "result-single" : "result-candidates");
        scrollTop();
      } catch (err) {
        if (myId !== scanRequestIdRef.current) return;
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
        stopLoadingAnim();
        const message = err instanceof Error ? err.message : String(err);
        setErrorMessage("通信エラー: " + message);
        setResult(null);
        setPhase("result-error");
        scrollTop();
      }
    },
    [scrollTop, startLoadingAnim, stopLoadingAnim]
  );

  const addStagedImages = useCallback((newImages: string[]) => {
    setStagedImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    // 新しい撮影を始めた時点で、直前の判定結果は必ず隠す（前回結果が残るバグの再発防止）
    setPhase("staging");
    setModalCandidate(null);
  }, []);

  const removeStagedImage = useCallback((index: number) => {
    setStagedImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setPhase(next.length > 0 ? "staging" : "idle");
      return next;
    });
  }, []);

  const handleGalleryChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const dataUrl = await compressImageFile(file);
      addStagedImages([dataUrl]);
    },
    [addStagedImages]
  );

  const handleCameraDone = useCallback(
    (images: string[]) => {
      setCameraOpen(false);
      addStagedImages(images);
    },
    [addStagedImages]
  );

  const submitStaged = useCallback(() => {
    if (!stagedImages.length) return;
    runScan(stagedImages);
  }, [stagedImages, runScan]);

  const retryLastScan = useCallback(() => {
    if (lastImagesRef.current) runScan(lastImagesRef.current);
  }, [runScan]);

  const canAddMore = stagedImages.length < MAX_IMAGES;
  const debugText = result?.debugText;

  return (
    <div id="app-root">
      <header onClick={resetToIdle} role="button" tabIndex={0}>
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
      </header>

      <div className="container">
        <div className="result-panel" ref={resultPanelRef}>
          {phase === "idle" && (
            <div id="idle-msg">
              <div className="idle-arrow" />
              <div className="idle-text">Scan a tag to identify the brand</div>
              <div className="idle-note">
                &#8505;&#65039; このアプリはVercelでホストされた通常のWebアプリです。安心してご利用ください。
              </div>
            </div>
          )}

          {phase === "staging" && (
            <div id="staging">
              <div className="staging-label">
                選択した画像（{stagedImages.length}/{MAX_IMAGES}）
              </div>
              <div className="staging-thumbs">
                {stagedImages.map((src, i) => (
                  <div className="staging-thumb" key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- ローカル撮影データURLのプレビューのためnext/imageは非対応 */}
                    <img src={src} alt="" />
                    <button
                      className="staging-thumb-remove"
                      aria-label="削除"
                      onClick={() => removeStagedImage(i)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "loading" && (
            <div id="loading" style={{ display: "flex" }}>
              <div
                className="step-ring"
                style={{
                  background: `conic-gradient(var(--red) ${Math.round(
                    ((loadingStep + 1) / LOADING_STEPS.length) * 100
                  )}%, #e8e8e8 0%)`,
                }}
              >
                <div className="step-ring-inner">
                  <span id="step-counter">{loadingStep + 1}</span>
                </div>
              </div>
              <div id="loading-text">{showRetry ? "通信が遅いようです…" : LOADING_STEPS[loadingStep]}</div>
              {showRetry && (
                <button className="btn btn-camera" style={{ display: "inline-flex" }} onClick={retryLastScan}>
                  再送信する
                </button>
              )}
            </div>
          )}

          {phase === "result-single" && result && (
            <div id="result-single" style={{ display: "flex" }}>
              <div className="single-header">
                <div className="single-names">
                  <div id="disp-brand">{result.brandName}</div>
                  <div id="disp-kana">{result.kana}</div>
                </div>
              </div>
              <div className="section-divider" />
              <MarketSection info={result.marketInfo} />
              <div className="section-divider" />
              <div className="info-section">
                <div className="info-label">備考</div>
                <div className="info-value">{result.info || "—"}</div>
              </div>
            </div>
          )}

          {phase === "result-candidates" && result?.candidates && (
            <div id="result-candidates" style={{ display: "flex" }}>
              <div id="candidates-label">
                {result.familyAlert
                  ? "ファミリーブランドが検出されました — 正しいブランドを選んでください"
                  : "候補が複数見つかりました — タップして詳細を確認"}
              </div>
              <div id="candidates-list">
                {result.candidates.map((c, idx) => (
                  <div className="candidate-row" key={c.brandName}>
                    <div className="candidate-main" onClick={() => setModalCandidate(c)}>
                      <div className="candidate-left">
                        <div className="candidate-brand">{c.brandName}</div>
                        <div className="candidate-kana">{c.kana || ""}</div>
                      </div>
                      <div className="candidate-right">
                        <div className="score-num">{c.scorePercent}%</div>
                        <div className="score-bar-bg">
                          <div
                            className="score-bar-fill"
                            style={{ width: `${c.scorePercent}%`, transitionDelay: `${80 + idx * 60}ms` }}
                          />
                        </div>
                        <div className="candidate-arrow" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "result-error" && (
            <div id="result-error" style={{ display: "flex" }}>
              <div className="error-bar" />
              <div id="disp-error">{result?.message || errorMessage || "ブランドを特定できませんでした。"}</div>
            </div>
          )}

          {debugText && (
            <div id="debug-wrap" style={{ display: "block" }}>
              <div id="debug-label">Raw Text</div>
              <div id="disp-debug">{debugText}</div>
            </div>
          )}
        </div>

        <div className="btn-panel">
          <button
            type="button"
            className="btn btn-camera"
            disabled={!canAddMore}
            onClick={() => setCameraOpen(true)}
          >
            <svg className="btn-icon" viewBox="0 0 24 24">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{stagedImages.length === 0 ? "撮影する" : "追加で撮影"}</span>
          </button>
          <label
            className="btn btn-gallery"
            htmlFor="input-gallery"
            style={!canAddMore ? { opacity: 0.4, pointerEvents: "none" } : undefined}
          >
            <svg className="btn-icon" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>{stagedImages.length === 0 ? "写真を選ぶ" : "追加で選ぶ"}</span>
          </label>
          <input
            type="file"
            id="input-gallery"
            accept="image/*"
            ref={galleryInputRef}
            onChange={handleGalleryChange}
          />
        </div>
        {stagedImages.length > 0 && (
          <button className="btn btn-submit" onClick={submitStaged}>
            この内容で判定する（{stagedImages.length}枚）
          </button>
        )}
      </div>

      {modalCandidate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalCandidate(null)}>
          <div id="modal-box">
            <div className="modal-header">
              <div className="modal-names">
                <div id="modal-brand">{modalCandidate.brandName}</div>
                <div id="modal-kana">{modalCandidate.kana || ""}</div>
              </div>
              <button className="modal-close" onClick={() => setModalCandidate(null)}>
                ×
              </button>
            </div>
            <div className="modal-divider" />
            <MarketSection info={modalCandidate.marketInfo} />
            <div className="modal-divider" />
            <div className="modal-block">
              <div className="modal-label">備考</div>
              <div className="modal-value">{modalCandidate.info || "—"}</div>
            </div>
          </div>
        </div>
      )}

      {cameraOpen && (
        <CameraOverlay
          remainingSlots={MAX_IMAGES - stagedImages.length}
          onDone={handleCameraDone}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
