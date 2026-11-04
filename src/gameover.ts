import { TUNING } from './config';
import { lineY } from './levels';
import type { Ball } from './types';

/** 球在警戒線玩家側的面積比例（0 ~ 1） */
export function overlapFraction(b: Ball, line: number): number {
  const r = b.rad;
  const h = Math.max(0, Math.min(2 * r, b.position.y + r - line));
  const t = Math.acos((r - h) / r);
  return (t - Math.sin(t) * Math.cos(t)) / Math.PI;
}

/**
 * 結束判定：球越過警戒線後，0.5 秒後仍有超過 1/5 面積在線外就結束。
 * 剛發射的球先豁免，直到它越過警戒線或存在超過一段時間。
 */
export function checkGameOver(balls: Ball[], K: number, dt: number) {
  const ly = lineY(K);
  let warning = false;
  let over = false;
  for (const b of balls) {
    b.age += dt;
    if (b.position.y < ly) b.crossed = true;
    const f = overlapFraction(b, ly);
    if ((b.crossed || b.age > TUNING.overGraceSec) && f > 0) {
      b.over += dt;
      warning = true;
      if (b.over > TUNING.overHoldSec && f > TUNING.overFraction) over = true;
    } else {
      b.over = 0;
    }
  }
  return { over, warning };
}
