"use client";

import { useEffect, useRef, useState } from "react";
import { findNode, ITEM_CATEGORY_TREE, locateValue } from "../../lib/itemCategories";

interface ItemCategoryPickerProps {
  initialValue?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// 大ジャンル→中ジャンル→小ジャンルの3段階セレクトで「アイテム」を選ばせるフォーム部品。
// 深い階層ほど選択肢が無い枝（腕時計等）もあるため、選択された枝に子が無ければそこで確定し、
// 「その他」が最終選択になった場合のみ自由入力欄を表示する。
export default function ItemCategoryPicker({ initialValue, onChange, disabled }: ItemCategoryPickerProps) {
  const initial = locateValue(initialValue ?? "");
  const [level1, setLevel1] = useState(initial.level1);
  const [level2, setLevel2] = useState(initial.level2);
  const [level3, setLevel3] = useState(initial.level3);
  const [custom, setCustom] = useState(initial.custom);
  const isFirstRender = useRef(true);

  const level1Node = level1 ? findNode(ITEM_CATEGORY_TREE, level1) : undefined;
  const level2Options = level1Node?.children;
  const level2Node = level2 && level2Options ? findNode(level2Options, level2) : undefined;
  const level3Options = level2Node?.children;

  const deepest = level3 || level2 || level1;
  const isCustom = deepest === "その他";
  const finalValue = isCustom ? custom.trim() : deepest;

  useEffect(() => {
    // 初回マウント時（prefill直後）はonChangeを発火させない
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChange(finalValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalValue]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <select
        className="field-input"
        value={level1}
        onChange={(e) => {
          setLevel1(e.target.value);
          setLevel2("");
          setLevel3("");
          setCustom("");
        }}
        disabled={disabled}
      >
        <option value="">選択してください</option>
        {ITEM_CATEGORY_TREE.map((n) => (
          <option key={n.label} value={n.label}>
            {n.label}
          </option>
        ))}
      </select>

      {level2Options && level2Options.length > 0 && (
        <select
          className="field-input"
          value={level2}
          onChange={(e) => {
            setLevel2(e.target.value);
            setLevel3("");
            setCustom("");
          }}
          disabled={disabled}
        >
          <option value="">選択してください</option>
          {level2Options.map((n) => (
            <option key={n.label} value={n.label}>
              {n.label}
            </option>
          ))}
        </select>
      )}

      {level3Options && level3Options.length > 0 && (
        <select
          className="field-input"
          value={level3}
          onChange={(e) => {
            setLevel3(e.target.value);
            setCustom("");
          }}
          disabled={disabled}
        >
          <option value="">選択してください</option>
          {level3Options.map((n) => (
            <option key={n.label} value={n.label}>
              {n.label}
            </option>
          ))}
        </select>
      )}

      {isCustom && (
        <input
          className="field-input"
          type="text"
          placeholder="アイテム名を入力"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
