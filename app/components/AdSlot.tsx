"use client";

// AdSenseの審査・パブリッシャーID取得後、この中に<ins class="adsbygoogle">タグを設置する。
// それまでは広告枠の位置とレイアウト崩れ防止用の高さだけを確保しておくプレースホルダー。
//
// planを渡した場合はSTANDARD/PREMIUM会員には表示しない（無料プランのみ）。
// 公式サイトなど「会員プランの概念が無い場所」ではplanを省略すれば常に表示する。
interface AdSlotProps {
  plan?: "free" | "standard" | "premium";
  slot?: string; // 将来のAdSense広告ユニットID
  label?: string;
}

export default function AdSlot({ plan, slot, label = "広告" }: AdSlotProps) {
  if (plan && plan !== "free") return null;

  return (
    <div className="ad-slot" data-ad-slot={slot ?? "pending"} aria-label={label}>
      <span className="ad-slot-label">{label}</span>
    </div>
  );
}
