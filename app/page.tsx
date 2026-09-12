"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  activateDeveloperKeyFromUrl,
  compressImageFile,
  getAccountCode,
  getDeveloperKey,
  getOrCreateAccountCode,
  resizeAndCompress,
  resizeDataUrl,
  setAccountCode as persistAccountCode,
} from "../lib/clientUtils";
import { isValidAccountCode, normalizeAccountCode } from "../lib/accountCode";
import ItemCategoryPicker from "./components/ItemCategoryPicker";

const MAX_IMAGES = 3;
const SCAN_TIMEOUT_MS = 20000;
const HISTORY_THUMB_MAX_DIMENSION = 400;
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

interface UsageInfo {
  allowed: boolean;
  count: number;
  limit: number;
  isDeveloper: boolean;
}

type PlanLevel = "free" | "standard" | "premium";

interface ScanResult {
  success: boolean;
  single?: boolean;
  unregistered?: boolean;
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
  usage?: UsageInfo;
}

type Phase = "idle" | "staging" | "loading" | "result-single" | "result-candidates" | "result-error";

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
  const [showSplash, setShowSplash] = useState(true);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [plan, setPlan] = useState<PlanLevel>("free");
  const [addHistoryTarget, setAddHistoryTarget] = useState<{ brandName: string; kana?: string } | null>(null);
  const [historyItem, setHistoryItem] = useState("");
  const [historyPhoto, setHistoryPhoto] = useState("");
  const [historyCameraOpen, setHistoryCameraOpen] = useState(false);
  const [historyPurchaseInput, setHistoryPurchaseInput] = useState("");
  const [historySubmitting, setHistorySubmitting] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showFirstLaunchPrompt, setShowFirstLaunchPrompt] = useState(false);
  const [firstLaunchInput, setFirstLaunchInput] = useState("");
  const [firstLaunchError, setFirstLaunchError] = useState("");
  const [firstLaunchSubmitting, setFirstLaunchSubmitting] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showStandaloneNoCodePrompt, setShowStandaloneNoCodePrompt] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const resultPanelRef = useRef<HTMLDivElement>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRequestIdRef = useRef(0);
  const lastImagesRef = useRef<string[] | null>(null);

  const fetchUsage = useCallback((accountCode: string) => {
    const devKey = getDeveloperKey();
    const params = new URLSearchParams();
    if (devKey) params.set("devKey", devKey);
    params.set("accountCode", accountCode);
    fetch("/api/usage?" + params.toString())
      .then((res) => res.json())
      .then((data: { usage?: UsageInfo; plan?: PlanLevel }) => {
        if (data.usage) setUsage(data.usage);
        if (data.plan) setPlan(data.plan);
      })
      .catch(() => {
        // 残り回数の取得に失敗しても本体機能には影響させない
      });
  }, []);

  useEffect(() => {
    activateDeveloperKeyFromUrl();

    const splashTimer = setTimeout(() => setShowSplash(false), 2600);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // 「ホーム画面に追加して連携」ボタンから追加された場合、マニフェストの
    // start_urlにコードが埋め込まれてこのURLに付与されている。これが
    // あれば最優先でこの端末のコードとして保存し、そのまま引き継ぐ。
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");
    if (codeFromUrl) {
      const normalized = normalizeAccountCode(codeFromUrl);
      if (isValidAccountCode(normalized)) {
        persistAccountCode(normalized);
        urlParams.delete("code");
        const cleanUrl = window.location.pathname + (urlParams.toString() ? "?" + urlParams.toString() : "");
        window.history.replaceState({}, "", cleanUrl);
        fetchUsage(normalized);
        return () => clearTimeout(splashTimer);
      }
    }

    // iOSでは「ホーム画面に追加」したアプリと通常のSafari/Chromeタブとで
    // localStorageの保存領域が分離されることがあり、この端末では復元コードが
    // 見つからない＝新規ユーザーとは限らない（別の保存領域に既存のコードがある
    // だけの可能性がある）。自動的に新しいコードを発行する前に、
    // 既存のコードを持っていないか必ず確認する。
    const existing = getAccountCode();
    if (existing) {
      fetchUsage(existing);
    } else if (standalone) {
      // ホーム画面アプリ単体でその場のコードを新規発行してしまうと、
      // 「連携」を経由していないのに連携済み扱いになってしまう。
      // ここでは新規発行させず、既存コードの入力かブラウザでの連携に誘導する。
      setShowStandaloneNoCodePrompt(true);
    } else {
      setShowFirstLaunchPrompt(true);
    }

    return () => clearTimeout(splashTimer);
  }, [fetchUsage]);

  const scrollTop = useCallback(() => {
    setTimeout(() => {
      if (resultPanelRef.current) resultPanelRef.current.scrollTop = 0;
    }, 50);
  }, []);

  function submitFirstLaunchRestore() {
    const normalized = normalizeAccountCode(firstLaunchInput);
    setFirstLaunchError("");
    if (!isValidAccountCode(normalized)) {
      setFirstLaunchError("コードの形式が正しくありません");
      return;
    }
    setFirstLaunchSubmitting(true);
    persistAccountCode(normalized);
    setShowFirstLaunchPrompt(false);
    setShowStandaloneNoCodePrompt(false);
    setFirstLaunchSubmitting(false);
    fetchUsage(normalized);
  }

  function startFreshAccount() {
    const code = getOrCreateAccountCode();
    setShowFirstLaunchPrompt(false);
    fetchUsage(code);
  }

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
          body: JSON.stringify({ images, accountCode: getOrCreateAccountCode(), devKey: getDeveloperKey() }),
        });
        const data: ScanResult = await res.json();

        if (myId !== scanRequestIdRef.current) return;
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

        stopLoadingAnim();
        setStagedImages([]);
        setResult(data);
        if (data.usage) setUsage(data.usage);
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
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (!files.length) return;
      const dataUrls = await Promise.all(files.map((file) => compressImageFile(file)));
      addStagedImages(dataUrls);
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

  const openAddToHistory = useCallback((target: { brandName: string; kana?: string }) => {
    setModalCandidate(null);
    setHistoryItem("");
    setHistoryPhoto("");
    setHistoryPurchaseInput("");
    setHistoryError("");
    setAddHistoryTarget(target);
  }, []);

  const submitAddToHistory = useCallback(
    async (skipPrice: boolean) => {
      if (!addHistoryTarget) return;
      setHistorySubmitting(true);
      setHistoryError("");
      try {
        const accountCode = getOrCreateAccountCode();
        const trimmed = historyPurchaseInput.trim();
        const purchasePrice = !skipPrice && trimmed ? Number(trimmed) : undefined;
        const photo = historyPhoto ? await resizeDataUrl(historyPhoto, HISTORY_THUMB_MAX_DIMENSION) : undefined;
        const res = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountCode,
            brandName: addHistoryTarget.brandName,
            kana: addHistoryTarget.kana,
            item: historyItem.trim() || undefined,
            photo,
            purchasePrice,
          }),
        });
        const data = (await res.json()) as { success: boolean; message?: string };
        if (!data.success) {
          setHistoryError(data.message || "保存に失敗しました");
          return;
        }
        setAddHistoryTarget(null);
        setToastMessage("仕入れ記録に追加しました");
        setTimeout(() => setToastMessage(null), 2000);
      } catch {
        setHistoryError("送信中にエラーが発生しました");
      } finally {
        setHistorySubmitting(false);
      }
    },
    [addHistoryTarget, historyItem, historyPhoto, historyPurchaseInput]
  );

  const canAddMore = stagedImages.length < MAX_IMAGES;
  const debugText = result?.debugText;

  return (
    <div id="app-root">
      {showSplash && (
        <div className="splash-screen" aria-hidden="true">
          <svg className="splash-mark" viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg">
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
          <span className="splash-text">GEMLENS</span>
        </div>
      )}
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
        <div className="header-right">
          <Link href="/history" className="history-link" onClick={(e) => e.stopPropagation()}>
            マイページ
          </Link>
          <Link
            href="/history"
            className={isStandalone ? "usage-badge" : "usage-badge badge-inactive"}
            onClick={(e) => e.stopPropagation()}
          >
            {isStandalone ? "連携済み" : "未連携"}
          </Link>
          {usage && plan === "free" && (
            <span className="usage-badge">
              {usage.isDeveloper ? "DEV" : "残り"} {Math.max(usage.limit - usage.count, 0)}/{usage.limit}
            </span>
          )}
          {plan !== "free" && (
            <span className="usage-badge">{plan === "premium" ? "PREMIUM" : "STANDARD"}</span>
          )}
        </div>
      </header>

      <div className="container">
        <div className="result-panel" ref={resultPanelRef}>
          {phase === "idle" && (
            <div id="idle-msg">
              <svg className="idle-arrow" viewBox="0 0 24 34" width="24" height="34" aria-hidden="true">
                <line x1="12" y1="0" x2="12" y2="22" stroke="var(--red)" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
                <polyline points="4,18 12,26 20,18" stroke="var(--red)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="idle-text">Scan a tag to identify the brand</div>
              <div className="idle-note">
                Vercelでホストされた通常のWebアプリです。安心してご利用ください。
                <br />
                文字のない記号・ロゴのみのタグは、複数枚撮影すると判定精度が上がります。
              </div>
              <Link href="/legal" className="idle-legal-link">
                利用規約・プライバシーポリシー
              </Link>
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
                <button
                  className="btn-add-history-inline"
                  title="仕入れ記録に追加"
                  aria-label="仕入れ記録に追加"
                  onClick={() => openAddToHistory({ brandName: result.brandName!, kana: result.kana })}
                >
                  +
                </button>
              </div>
              {result.unregistered && (
                <div className="unregistered-notice">
                  未登録ブランド（AI推定） — データベース未登録のためランク・備考はありません。相場情報はAIによる推定です。
                </div>
              )}
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
            multiple
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
              <button
                className="btn-add-history-inline"
                title="仕入れ記録に追加"
                aria-label="仕入れ記録に追加"
                onClick={() => openAddToHistory({ brandName: modalCandidate.brandName, kana: modalCandidate.kana })}
              >
                +
              </button>
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

      {addHistoryTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && !historySubmitting && setAddHistoryTarget(null)}
        >
          <div className="sheet-box">
            <div className="modal-header">
              <div className="modal-names">
                <div id="modal-brand">{addHistoryTarget.brandName}</div>
                <div id="modal-kana">{addHistoryTarget.kana || ""}</div>
              </div>
              <button className="modal-close" onClick={() => setAddHistoryTarget(null)} disabled={historySubmitting}>
                ×
              </button>
            </div>
            <div className="modal-divider" />
            <div className="field">
              <label className="field-label">アイテム全体の写真（任意）</label>
              {historyPhoto ? (
                <div className="history-photo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 撮影済みdata URLのプレビューのためnext/imageは非対応 */}
                  <img src={historyPhoto} alt="" />
                  <div className="edit-photo-actions">
                    <button
                      type="button"
                      className="edit-photo-btn"
                      onClick={() => setHistoryCameraOpen(true)}
                      disabled={historySubmitting}
                    >
                      撮り直す
                    </button>
                    <button
                      type="button"
                      className="edit-photo-btn edit-photo-remove"
                      onClick={() => setHistoryPhoto("")}
                      disabled={historySubmitting}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-gallery"
                  onClick={() => setHistoryCameraOpen(true)}
                  disabled={historySubmitting}
                >
                  アイテム全体の写真を撮る
                </button>
              )}
            </div>
            <div className="field">
              <label className="field-label">アイテム（任意）</label>
              <ItemCategoryPicker onChange={setHistoryItem} disabled={historySubmitting} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="history-purchase-price">
                仕入れ値（円・任意）
              </label>
              <input
                id="history-purchase-price"
                className="field-input"
                type="number"
                inputMode="numeric"
                placeholder="例: 3000"
                value={historyPurchaseInput}
                onChange={(e) => setHistoryPurchaseInput(e.target.value)}
                disabled={historySubmitting}
              />
            </div>
            {historyError && <div style={{ color: "var(--red)", fontSize: 12 }}>{historyError}</div>}
            <div className="btn-panel">
              <button
                className="btn btn-gallery"
                onClick={() => submitAddToHistory(true)}
                disabled={historySubmitting}
              >
                スキップして追加
              </button>
              <button
                className="btn btn-camera"
                onClick={() => submitAddToHistory(false)}
                disabled={historySubmitting}
              >
                この価格で追加
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && <div className="toast">{toastMessage}</div>}

      {cameraOpen && (
        <CameraOverlay
          remainingSlots={MAX_IMAGES - stagedImages.length}
          onDone={handleCameraDone}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {historyCameraOpen && (
        <CameraOverlay
          remainingSlots={1}
          onDone={(images) => {
            setHistoryPhoto(images[0]);
            setHistoryCameraOpen(false);
          }}
          onClose={() => setHistoryCameraOpen(false)}
        />
      )}

      {showFirstLaunchPrompt && (
        <div className="modal-overlay">
          <div className="sheet-box">
            <div className="modal-header">
              <div className="modal-names">
                <div id="modal-brand">はじめに</div>
              </div>
            </div>
            <div className="modal-divider" />
            <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
              以前に発行された12桁の復元コードをお持ちですか？
              <br />
              （ホーム画面に追加したアプリと、通常のブラウザとで別々に保存されるため、
              以前の仕入れ記録を引き継ぐにはコードの入力が必要です）
            </div>
            <div className="field">
              <label className="field-label">復元コード（お持ちの場合）</label>
              <input
                className="field-input"
                value={firstLaunchInput}
                onChange={(e) => setFirstLaunchInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                disabled={firstLaunchSubmitting}
              />
              {firstLaunchError && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>{firstLaunchError}</div>}
            </div>
            <button
              type="button"
              className="btn btn-submit"
              onClick={submitFirstLaunchRestore}
              disabled={firstLaunchSubmitting || !firstLaunchInput.trim()}
              style={{ marginTop: 12 }}
            >
              このコードで復元する
            </button>
            <button
              type="button"
              onClick={startFreshAccount}
              disabled={firstLaunchSubmitting}
              style={{
                marginTop: 10,
                width: "100%",
                background: "none",
                border: "none",
                color: "var(--gray)",
                fontSize: 12,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              コードは無い（新しく始める）
            </button>
          </div>
        </div>
      )}

      {showStandaloneNoCodePrompt && (
        <div className="modal-overlay">
          <div className="sheet-box">
            <div className="modal-header">
              <div className="modal-names">
                <div id="modal-brand">連携が必要です</div>
              </div>
            </div>
            <div className="modal-divider" />
            <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
              このホーム画面アプリはまだ連携されていません。
              <br />
              以前に発行された12桁の復元コードをお持ちの場合は下に入力してください。
              お持ちでない場合は、ブラウザで開いて「連携」から追加し直してください。
            </div>
            <div className="field">
              <label className="field-label">復元コード（お持ちの場合）</label>
              <input
                className="field-input"
                value={firstLaunchInput}
                onChange={(e) => setFirstLaunchInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                disabled={firstLaunchSubmitting}
              />
              {firstLaunchError && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>{firstLaunchError}</div>}
            </div>
            <button
              type="button"
              className="btn btn-submit"
              onClick={submitFirstLaunchRestore}
              disabled={firstLaunchSubmitting || !firstLaunchInput.trim()}
              style={{ marginTop: 12 }}
            >
              このコードで復元する
            </button>
            <a
              href={typeof window !== "undefined" ? window.location.origin : "/"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: 10,
                display: "block",
                width: "100%",
                textAlign: "center",
                padding: "12px",
                background: "var(--black)",
                color: "white",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              ブラウザで開いて連携する
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
