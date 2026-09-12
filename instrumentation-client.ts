import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 無料枠を消費しすぎないよう、パフォーマンストレースは低いサンプリング率にする
  // （エラー自体は常に100%捕捉される。これはエラー監視目的で、フルの分散トレーシングは目的外）
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
