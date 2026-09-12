import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: "gemlens",
  project: "javascript-nextjs",
  // ソースマップアップロード用のSENTRY_AUTH_TOKENは未設定のため、
  // ビルド時の警告を静かにする（エラー監視自体には影響しない）
  silent: true,
});
