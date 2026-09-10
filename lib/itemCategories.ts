// 仕入れ記録の「アイテム」欄で使う、大ジャンル→中ジャンル→小ジャンルの階層構造。
// セカンドストリートの実際のカテゴリ構成（メンズウェア/レディースウェア/バッグ/シューズ/
// 服飾雑貨他/キッズ 等）を参考に、ブランドタグが付くファッション関連の商材に絞って構成している。
// 枝によって深さが異なる（バッグ等は大→中→小の3階層、腕時計等はそこで終わる2階層）のは、
// 元にした実サイトの構造自体がジャンルによって深さが異なるため。
export interface CategoryNode {
  label: string;
  children?: CategoryNode[];
}

function leaf(label: string): CategoryNode {
  return { label };
}

function branch(label: string, children: string[]): CategoryNode {
  return { label, children: children.map(leaf) };
}

export const ITEM_CATEGORY_TREE: CategoryNode[] = [
  {
    label: "メンズウェア",
    children: [
      branch("トップス", [
        "カーディガン",
        "ニット・セーター",
        "ジャージ",
        "スウェット",
        "パーカー",
        "ジップパーカー",
        "Tシャツ",
        "シャツ",
        "カットソー",
        "その他",
      ]),
      branch("アウター", ["ジャケット", "コート", "ダウンジャケット", "ブルゾン", "ベスト", "その他"]),
      branch("ボトムス", ["パンツ", "デニム", "ショートパンツ", "その他"]),
      leaf("その他"),
    ],
  },
  {
    label: "レディースウェア",
    children: [
      branch("トップス", ["カットソー", "ニット・セーター", "シャツ・ブラウス", "Tシャツ", "その他"]),
      branch("アウター", ["ジャケット", "コート", "ダウンジャケット", "ベスト", "その他"]),
      branch("ボトムス", ["パンツ", "スカート", "デニム", "その他"]),
      leaf("ワンピース"),
      leaf("その他"),
    ],
  },
  {
    label: "キッズ・ベビー",
    children: [
      branch("トップス", ["カットソー", "ニット・セーター", "パーカー", "その他"]),
      branch("アウター", ["ジャケット", "コート", "その他"]),
      branch("ボトムス", ["パンツ", "スカート", "その他"]),
      leaf("その他"),
    ],
  },
  {
    label: "服飾雑貨",
    children: [
      branch("バッグ", [
        "トートバッグ",
        "ショルダーバッグ",
        "リュック",
        "ハンドバッグ",
        "ボストンバッグ",
        "クラッチバッグ",
        "その他",
      ]),
      branch("財布", ["長財布", "二つ折り財布", "コインケース", "カードケース", "その他"]),
      branch("シューズ", ["スニーカー", "ブーツ", "サンダル", "革靴", "パンプス", "その他"]),
      leaf("腕時計"),
      branch("ジュエリー・アクセサリー", ["リング", "ネックレス", "ブレスレット", "ピアス・イヤリング", "その他"]),
      branch("帽子", ["キャップ", "ニット帽", "ハット", "その他"]),
      leaf("その他"),
    ],
  },
  leaf("スポーツ・アウトドア"),
  leaf("その他"),
];

export function findNode(nodes: CategoryNode[], label: string): CategoryNode | undefined {
  return nodes.find((n) => n.label === label);
}

export interface LocatedSelection {
  level1: string;
  level2: string;
  level3: string;
  custom: string;
}

// 保存済みのitem文字列（末端ラベルのみ）から、木構造上のどのパスに対応するかを逆引きする。
// 見つからない場合はカスタム入力された値とみなし、トップレベルの「その他」に割り当てる。
export function locateValue(value: string): LocatedSelection {
  if (!value) return { level1: "", level2: "", level3: "", custom: "" };

  for (const l1 of ITEM_CATEGORY_TREE) {
    if (l1.label === value) return { level1: l1.label, level2: "", level3: "", custom: "" };
    if (!l1.children) continue;
    for (const l2 of l1.children) {
      if (l2.label === value) return { level1: l1.label, level2: l2.label, level3: "", custom: "" };
      if (!l2.children) continue;
      for (const l3 of l2.children) {
        if (l3.label === value) return { level1: l1.label, level2: l2.label, level3: l3.label, custom: "" };
      }
    }
  }
  return { level1: "その他", level2: "", level3: "", custom: value };
}
