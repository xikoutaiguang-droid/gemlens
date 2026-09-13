"use client";

import { useCallback, useRef, useState } from "react";
import { getDeveloperKey } from "../../lib/clientUtils";

// Google Ad Manager（GPT）のリワード広告（視聴完了で特典を付与する広告）を表示するボタン。
//
// 前提条件（未設定の場合は自動的に非表示になる）:
// ・Google Ad Managerのアカウント開設・審査が完了していること
// ・リワード広告用の広告ユニットを作成し、そのパス（例: /1234567/rewarded_scan）を
//   環境変数 NEXT_PUBLIC_GAM_AD_UNIT_PATH に設定すること
//
// 既知の制約（サーバー側検証は未実装）:
// 広告SDKの「視聴完了」イベント（rewardedSlotGranted）はブラウザ側で発火するため、
// 悪意のあるユーザーはこのイベントを経由せず直接 /api/ads/reward を叩くことで
// 視聴せずに特典を得られてしまう可能性がある。本来はGoogle Ad ManagerのServer-Side
// Verification（SSV）コールバックでサーバー側から検証すべきだが、広告アカウントの
// 実際の設定（SSVコールバックURLの登録など）が済んでいないため未対応。
// ただし1日3回という上限（DAILY_AD_BONUS_LIMIT）自体がサーバー側にあるため、
// 突破されても影響は「1日+3枚」に限定される。

declare global {
  interface Window {
    googletag?: {
      cmd: Array<() => void>;
      enums: { OutOfPageFormat: { REWARDED: unknown } };
      defineOutOfPageSlot: (adUnitPath: string, format: unknown) => GoogleTagRewardedSlot | null;
      pubads: () => {
        addEventListener: (event: string, cb: (event: { makeRewardedVisible?: () => void; payload?: unknown }) => void) => void;
      };
      enableServices: () => void;
      display: (slot: GoogleTagRewardedSlot) => void;
      destroySlots: (slots: GoogleTagRewardedSlot[]) => void;
    };
  }
}

interface GoogleTagRewardedSlot {
  addService: (service: unknown) => void;
}

const GPT_SCRIPT_SRC = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
let gptScriptPromise: Promise<void> | null = null;

function loadGptScript(): Promise<void> {
  if (gptScriptPromise) return gptScriptPromise;
  gptScriptPromise = new Promise((resolve, reject) => {
    window.googletag = window.googletag || { cmd: [] } as unknown as Window["googletag"];
    const script = document.createElement("script");
    script.src = GPT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gpt.js読み込み失敗"));
    document.head.appendChild(script);
  });
  return gptScriptPromise;
}

interface UsageLike {
  allowed: boolean;
  count: number;
  limit: number;
  adBonus: number;
  adBonusLimit: number;
  isDeveloper: boolean;
}

interface RewardedAdButtonProps {
  usage: UsageLike | null;
  onGranted: (usage: UsageLike) => void;
}

export default function RewardedAdButton({ usage, onGranted }: RewardedAdButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const slotRef = useRef<GoogleTagRewardedSlot | null>(null);

  const adUnitPath = process.env.NEXT_PUBLIC_GAM_AD_UNIT_PATH;

  const cleanupSlot = useCallback(() => {
    if (slotRef.current && window.googletag) {
      window.googletag.destroySlots([slotRef.current]);
      slotRef.current = null;
    }
  }, []);

  const grantBonus = useCallback(async () => {
    try {
      const res = await fetch("/api/ads/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devKey: getDeveloperKey() }),
      });
      const data = await res.json();
      if (data.usage) onGranted(data.usage);
    } catch {
      // 特典付与に失敗しても広告自体は視聴済みのため、静かに諦める（次回再試行してもらう）
    }
  }, [onGranted]);

  const handleClick = useCallback(async () => {
    if (!adUnitPath || status === "loading") return;
    setStatus("loading");

    try {
      await loadGptScript();
    } catch {
      setStatus("error");
      return;
    }

    const googletag = window.googletag!;
    googletag.cmd.push(() => {
      cleanupSlot();

      const slot = googletag.defineOutOfPageSlot(adUnitPath, googletag.enums.OutOfPageFormat.REWARDED);
      if (!slot) {
        // このページ・デバイスがリワード広告に対応していない
        setStatus("error");
        return;
      }
      slotRef.current = slot;
      slot.addService(googletag.pubads());

      googletag.pubads().addEventListener("rewardedSlotReady", (event) => {
        event.makeRewardedVisible?.();
      });
      googletag.pubads().addEventListener("rewardedSlotClosed", () => {
        cleanupSlot();
        setStatus("idle");
      });
      googletag.pubads().addEventListener("rewardedSlotGranted", () => {
        grantBonus();
      });

      googletag.enableServices();
      googletag.display(slot);
    });
  }, [adUnitPath, status, cleanupSlot, grantBonus]);

  // 広告ユニット未設定（Ad Manager未開設）の間は何も表示しない
  if (!adUnitPath) return null;
  if (!usage) return null;

  const remainingBonus = usage.adBonusLimit - usage.adBonus;
  if (usage.isDeveloper || remainingBonus <= 0) return null;

  return (
    <button type="button" className="btn btn-ad-reward" onClick={handleClick} disabled={status === "loading"}>
      {status === "loading"
        ? "広告を読み込み中…"
        : `広告を見て+1回（本日あと${remainingBonus}回）`}
      {status === "error" && <span className="ad-reward-error">広告を表示できませんでした</span>}
    </button>
  );
}
