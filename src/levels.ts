import { LAYOUT, TUNING } from './config';

const ANCH = [[255, 255, 255], [255, 158, 196], [255, 242, 168], [156, 191, 92]];
export const DIAMOND_COLOR = '#cdb8ff';

export const maxRadius = (K: number) => (K <= 6 ? TUNING.rMaxSmall : TUNING.rMaxLarge);

/** 等級 n 的半徑：1 級到最高級之間以等比數列內插 */
export const radius = (n: number, K: number) =>
  TUNING.radiusScale * TUNING.r1 * Math.pow(maxRadius(K) / TUNING.r1, (n - 1) / (K - 1));

/** 預設顏色：白 → 粉 → 鵝黃 → 酪梨綠 沿色相內插，最高級固定為鑽石閃 */
export function levelColor(n: number, K: number): string {
  if (n >= K) return DIAMOND_COLOR;
  const p = ((n - 1) / (K - 2)) * 3;
  const i = Math.min(2, Math.floor(p));
  const f = p - i;
  const a = ANCH[i], b = ANCH[i + 1];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',')})`;
}

/** 最高級消失的大分 */
export const bigScore = (K: number) => K * 50 * Math.pow(2, K);

/** 隨機生成的最高等級 = min(3, K/3 無條件捨去)，K = 5 時特例為 2 */
export const spawnMax = (K: number) => (K === 5 ? 2 : Math.min(3, Math.floor(K / 3)));
export const randomSpawn = (K: number) => 1 + Math.floor(Math.random() * spawnMax(K));

/** 最高等級 >= 8 時顯示「下一顆」預覽 */
export const showPreview = (K: number) => K >= 8;

/** 警戒線 y：從遠端牆算起位於場地深度的 1 - 2/K 處 */
export const lineY = (K: number) => {
  const { FT, FB } = LAYOUT;
  return FT + (1 - 2 / K) * (FB - FT);
};
