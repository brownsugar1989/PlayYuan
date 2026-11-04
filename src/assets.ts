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
 * 取球身圖片主體最底部的不透明像素平均色，供球結與邊框共用。
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
    const pixels = g.getImageData(0, 0, 32, 32).data;
    let bottom = -1;
    for (let y = 31; y >= 0; y--) {
      let count = 0;
      for (let x = 0; x < 32; x++) if (pixels[(y * 32 + x) * 4 + 3] > 160) count++;
      if (count >= 3) { bottom = y; break; }
    }
    if (bottom < 0) return (edgeCache[n] = base);
    let r = 0, gr = 0, b = 0, k = 0;
    for (let y = Math.max(0, bottom - 2); y <= bottom; y++) {
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4;
        if (pixels[i + 3] > 160) { r += pixels[i]; gr += pixels[i + 1]; b += pixels[i + 2]; k++; }
      }
    }
    return (edgeCache[n] = k ? `rgb(${Math.round(r / k)},${Math.round(gr / k)},${Math.round(b / k)})` : base);
  } catch {
    return base;
  }
}
