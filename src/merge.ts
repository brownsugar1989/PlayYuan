import { TUNING } from './config';
import { bigScore, radius } from './levels';
import type { PhysicsWorld } from './physics';
import type { Pop, Ring } from './types';

/**
 * 處理這一步排隊中的合成，回傳得到的分數。
 * - 一般：兩顆同級球 → 中點生成高一級的球，得 n × 50
 * - 合成出最高級時立即給大分，最高級球留在場上
 * - 最高等級 >= 7：最高級球再次碰撞時消失並再給大分
 */
export function processMerges(world: PhysicsWorld, K: number, pops: Pop[], rings: Ring[]): number {
  let gained = 0;
  const addPop = (p: number, x: number, y: number, r: number) => {
    gained += p;
    const stack = pops.filter((o) => o.t < 0.3).length; // 連鎖時錯開，避免重疊
    pops.push({ p, x, y: y - stack * 18, r, t: 0 });
  };

  for (const [a, b] of world.queue) {
    const n = a.lv;
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    world.removeBalls([a, b]);
    if (n >= K) {
      addPop(bigScore(K), x, y, radius(K, K));
    } else {
      const c = world.addBall(
        n + 1, x, y,
        (a.velocity.x + b.velocity.x) / 2, (a.velocity.y + b.velocity.y) / 2,
        Math.max(a.age, b.age),
      );
      c.crossed = a.crossed && b.crossed;
      c.nm = performance.now() + TUNING.mergeImmuneMs; // 短暫冷卻，讓連鎖合成看得清楚
      c.mg = true;
      if (n + 1 >= K) rings.push({ x, y, r: c.rad, t: 0 }); // 合成到最高級才出現光環
      addPop(n + 1 >= K ? bigScore(K) : n * 50, x, y, c.rad);
    }
  }
  world.queue = [];
  return gained;
}
