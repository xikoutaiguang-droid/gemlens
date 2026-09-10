import type { NextRequest } from "next/server";

// レート制限のキーに使うクライアントIPを取得する。
// localStorageのdeviceIdと違い、シークレットモード・ホーム画面追加・サイトデータ削除などで
// リセットされないため、無料枠制限の実効性を保つために使用する。
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
