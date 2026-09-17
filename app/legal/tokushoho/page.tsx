"use client";

import { useEffect } from "react";
import Link from "next/link";

// 特定商取引法に基づく表記。
// 所在地・電話番号は、個人事業主向けの一般的な運用（消費者庁の通信販売ガイドラインに基づく）に
// 従い「請求があれば遅滞なく開示する」形にしている。実際に開示請求が来た場合は
// お問い合わせフォーム経由で速やかに対応すること。
export default function TokushohoPage() {
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
          <span className="usage-badge">特商法</span>
        </div>
      </header>

      <div className="legal-body">
        <h1 className="legal-title">特定商取引法に基づく表記</h1>
        <p className="legal-updated">最終更新日：2026年9月14日</p>

        <div className="legal-contact" style={{ marginBottom: 24 }}>
          所在地・電話番号は、個人事業主向けの一般的な運用に基づき「請求があった場合に遅滞なく開示する」形にしています。
          お問い合わせフォームから開示請求があった際は、速やかに対応してください。
        </div>

        <section className="legal-section">
          <h3>販売業者</h3>
          <p>西口泰広（屋号：GEMLENS）</p>

          <h3>運営統括責任者</h3>
          <p>西口泰広</p>

          <h3>所在地</h3>
          <p>
            ご請求いただいた場合には、遅滞なく開示いたします。
            <Link href="/contact" style={{ color: "inherit", fontWeight: 700 }}>
              お問い合わせフォーム
            </Link>
            よりご請求ください。
          </p>

          <h3>電話番号</h3>
          <p>
            ご請求いただいた場合には、遅滞なく開示いたします。
            <Link href="/contact" style={{ color: "inherit", fontWeight: 700 }}>
              お問い合わせフォーム
            </Link>
            よりご請求ください。
          </p>

          <h3>メールアドレス</h3>
          <p>
            <Link href="/contact" style={{ color: "inherit", fontWeight: 700 }}>
              お問い合わせフォーム
            </Link>
            よりご連絡ください。
          </p>

          <h3>販売価格</h3>
          <p>
            STANDARDプラン：月額980円（税込）
            <br />
            PREMIUMプラン：月額2,980円（税込）（初回7日間無料トライアルあり）
            <br />
            ※価格は
            <Link href="/upgrade" style={{ color: "inherit", fontWeight: 700 }}>
              プラン選択ページ
            </Link>
            の表示を正とします。
          </p>

          <h3>商品代金以外の必要料金</h3>
          <p>なし（通信費等はお客様のご負担となります）。</p>

          <h3>お支払い方法</h3>
          <p>クレジットカード決済（Stripe社の決済システムを利用）。</p>

          <h3>お支払い時期</h3>
          <p>お申し込み時に決済され、以降は毎月同日に自動更新・自動課金されます。</p>

          <h3>サービス提供時期</h3>
          <p>決済完了後、直ちにプランが反映されます。</p>

          <h3>返品・キャンセルについて</h3>
          <p>
            本サービスはデジタルサービスの性質上、決済完了後の返金は原則として承っておりません。
            プランの解約はマイページの「管理・変更する」からいつでも行うことができ、
            解約後は当月の請求期間終了時点でプランが終了します（日割り返金はありません）。
          </p>

          <h3>動作環境</h3>
          <p>インターネット接続環境と、カメラ機能を備えた最新のWebブラウザ（Safari・Chrome等）。</p>
        </section>
      </div>
    </div>
  );
}
