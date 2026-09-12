"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function LegalPage() {
  // body側は#app-root画面（撮影・履歴）用にoverflow:hiddenが既定のため、
  // このページ滞在中だけ通常のページスクロールに戻す。
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="legal-root">
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
          <span className="usage-badge">規約</span>
        </div>
      </header>

      <div className="legal-body">
        <h1 className="legal-title">利用規約・プライバシーポリシー</h1>
        <p className="legal-updated">最終更新日：2026年9月12日</p>

        <section className="legal-section">
          <h2>利用規約</h2>

          <h3>1. サービスの内容</h3>
          <p>
            GEMLENS（以下「本サービス」）は、アパレル製品のタグを撮影することでAIがブランド名を判定し、
            古着買取・販売の参考情報を提供する個人開発のツールです。会員登録・ログインは不要で、
            端末に依存しない記録の引き継ぎのために「IDコード」を発行します。
          </p>

          <h3>2. AI判定結果に関する免責事項</h3>
          <p>
            本サービスが提示するブランド判定結果・相場情報・アイテム情報は、AIによる推定であり、
            その正確性・完全性を保証するものではありません。誤判定や実勢価格との乖離が発生する可能性があります。
            <strong>買取・販売価格の決定や実際の取引は、必ずご自身の最終確認・判断のもとで行ってください。</strong>
            本サービスの判定結果を根拠として生じた損害について、運営者は一切の責任を負いません。
          </p>

          <h3>3. 利用制限・料金プラン</h3>
          <p>
            無料枠として1日あたりのスキャン回数に上限を設けています。将来的に、
            利用回数の上限撤廃やGoogle検索連携などの追加機能を有料プラン（PRO）として提供する場合があります。
            料金プランを導入する際は、本サービス内で改めてご案内します。
          </p>

          <h3>4. IDコードの管理責任</h3>
          <p>
            記録の閲覧・復元に使用する「IDコード」は、お客様ご自身で管理していただくものとし、
            紛失・第三者への漏洩によって生じた損害について運営者は責任を負いません。
            IDコードを紛失した場合、該当の記録には二度とアクセスできなくなります。
          </p>

          <h3>5. 禁止事項</h3>
          <ul>
            <li>本サービスのシステムに過度な負荷をかける行為、不正アクセス、リバースエンジニアリング</li>
            <li>本サービスを、法令に違反する取引・盗品の査定など不正な目的で利用する行為</li>
            <li>第三者になりすます行為、他者のIDコードを不正に取得・使用する行為</li>
          </ul>

          <h3>6. サービスの変更・中断・終了</h3>
          <p>
            本サービスは個人開発により提供されており、事前の予告なく内容の変更、一時的な中断、
            または提供の終了を行う場合があります。これによりお客様に生じた損害について、
            運営者は一切の責任を負いません。
          </p>

          <h3>7. 準拠法・裁判管轄</h3>
          <p>本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、運営者の所在地を管轄する裁判所を第一審の専属的合意管轄とします。</p>
        </section>

        <section className="legal-section">
          <h2>プライバシーポリシー</h2>

          <h3>1. 取得する情報</h3>
          <ul>
            <li>
              <strong>タグの撮影画像：</strong>
              ブランド判定のため、画像判定のためにGoogle社のAI（Gemini API・Cloud Vision
              API）へ送信します。画像は判定処理のためにのみ使用され、本サービスの改善目的以外で第三者に販売・提供することはありません。
            </li>
            <li>
              <strong>仕入れ・販売記録：</strong>
              「IDコード」に紐づけて、ブランド名・アイテム区分・価格・メモ・任意で添付された写真をサーバー（Redis）に保存します。
              氏名・メールアドレス・電話番号等の個人情報の入力・保存は求めていません。
            </li>
            <li>
              <strong>IPアドレス：</strong>
              無料利用回数の上限を判定するためだけに、日付ごとに一時的（最大36時間）に保存し、自動的に削除されます。
            </li>
          </ul>

          <h3>2. 利用目的</h3>
          <p>ブランド判定機能の提供、仕入れ記録の保存・表示、無料枠の不正利用防止のためにのみ利用します。</p>

          <h3>3. 第三者への提供・委託先</h3>
          <p>本サービスは以下の外部サービスを利用しており、機能提供に必要な範囲でデータが送信されます。</p>
          <ul>
            <li>Google（Gemini API / Cloud Vision API）：タグ画像の解析</li>
            <li>Vercel：本サービスのホスティング</li>
            <li>Upstash（Redis）：記録データの保存</li>
          </ul>

          <h3>4. データの削除</h3>
          <p>
            仕入れ記録は履歴画面からいつでもご自身で削除できます。IDコードに紐づく全データの削除をご希望の場合は、下記お問い合わせ先までご連絡ください。
          </p>

          <h3>5. お問い合わせ</h3>
          <p>
            本サービスに関するお問い合わせは、
            <Link href="/contact" style={{ color: "inherit", fontWeight: 700 }}>
              こちらのお問い合わせフォーム
            </Link>
            からご連絡ください。
          </p>

          <h3>6. 本ポリシーの変更</h3>
          <p>本ポリシーの内容は、必要に応じて予告なく変更することがあります。変更後の内容は本ページに掲載した時点で効力を生じるものとします。</p>
        </section>
      </div>
    </div>
  );
}
