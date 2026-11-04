import { BG_IMAGE, CONFIG } from './config';
import { levelColor } from './levels';

const url = (p: string) => import.meta.env.BASE_URL + p;

export const bgImage = new Image();
bgImage.src = url(BG_IMAGE);

const ballImgs: Record<number, HTMLImageElement> = {};
function loadDefaultBallImages() {
  for (const [lv, path] of Object.entries(CONFIG.BALL_IMAGES)) {
    const img = new Image();
    img.src = url(path);
    ballImgs[Number(lv)] = img;
  }
}
loadDefaultBallImages();

/** Apply browser-decrypted images for a generated game. Unfilled levels keep defaults. */
export function setCustomBallImages(images: Record<number, string>) {
  for (const key of Object.keys(ballImgs)) delete ballImgs[Number(key)];
  for (const [lv, path] of Object.entries(CONFIG.BALL_IMAGES)) {
    const img = new Image();
    img.src = url(path);
    ballImgs[Number(lv)] = img;
  }
  for (const [lv, src] of Object.entries(images)) {
    const n = Number(lv);
    if (!Number.isInteger(n) || n < 1 || n > 10) continue;
    const img = new Image();
    img.src = src;
    ballImgs[n] = img;
  }
  for (const key of Object.keys(edgeCache)) delete edgeCache[Number(key)];
}

export const ready = (i?: HTMLImageElement) => !!(i && i.complete && i.naturalWidth);

/** 該等級的圖片（尚未載入或沒設定時回傳 null） */
export const ballImage = (n: number) => (ready(ballImgs[n]) ? ballImgs[n] : null);

const edgeCache: Record<number, string> = {};

/**
 * 偵測球底部邊緣的顏色，給氣球結使用：
 * 有圖片時取圖片底邊的平均色，沒有圖片時使用該等級的預設顏色。
 */
export function edgeColor(n: number, K: number): string {
  const base = levelColor(n, K);
  const im = ballImage(n);
  if (!im) return base;
  if (edgeCache[n]) return edgeCache[n];
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const s = Math.max(32 / im.naturalWidth, 32 / im.naturalHeight);
    g.drawImage(im, 16 - (im.naturalWidth * s) / 2, 16 - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
    const d = g.getImageData(14, 28, 5, 3).data;
    let r = 0, gr = 0, b = 0, k = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 128) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; k++; }
    }
    return (edgeCache[n] = k ? `rgb(${Math.round(r / k)},${Math.round(gr / k)},${Math.round(b / k)})` : base);
  } catch {
    return base;
  }
}
