// クライアント側（ブラウザ）専用の共通ユーティリティ。
// メイン画面（app/page.tsx）と管理画面（app/admin/reference-images/page.tsx）の両方から使用する。

const DEV_KEY_STORAGE = "gemlens_dev_key";

export function activateDeveloperKeyFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const dev = params.get("dev");
    if (dev) {
      localStorage.setItem(DEV_KEY_STORAGE, dev);
      params.delete("dev");
      const cleanUrl =
        window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  } catch {
    // ignore
  }
}

export function getDeveloperKey(): string | undefined {
  try {
    return localStorage.getItem(DEV_KEY_STORAGE) || undefined;
  } catch {
    return undefined;
  }
}

export function resizeAndCompress(source: CanvasImageSource, srcW: number, srcH: number): string {
  const canvas = document.createElement("canvas");
  const MAX = 1200;
  let w = srcW;
  let h = srcH;
  if (w > h) {
    if (w > MAX) {
      h = Math.round((h * MAX) / w);
      w = MAX;
    }
  } else if (h > MAX) {
    w = Math.round((w * MAX) / h);
    h = MAX;
  }
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(resizeAndCompress(img, img.width, img.height));
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
