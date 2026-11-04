import { LAYOUT, TUNING } from './config';
import { radius, randomSpawn } from './levels';
import type { PhysicsWorld } from './physics';
import type { Ball } from './types';

const { X0, X1, FT, FB } = LAYOUT;

/** 發射器：目前的球、下一顆、左右位置、發射冷卻、瞄準線 */
export class Launcher {
  x = 180;
  dragging = false;
  current = 1;
  next = 1;
  private lastShot = 0;

  reset(K: number) {
    this.current = randomSpawn(K);
    this.next = randomSpawn(K);
    this.lastShot = 0;
  }

  clampX(r: number) {
    return Math.max(X0 + r, Math.min(X1 - r, this.x));
  }

  fire(world: PhysicsWorld, K: number): boolean {
    const t = performance.now();
    if (t - this.lastShot < TUNING.shotCooldownMs) return false;
    this.lastShot = t;
    const r = radius(this.current, K);
    world.addBall(this.current, this.clampX(r), FB - r - 1, 0, -TUNING.launchSpeed);
    this.current = this.next;
    this.next = randomSpawn(K);
    return true;
  }

  /** 瞄準線終點 y：第一個會撞到的球，或遠端牆 */
  aimEndY(balls: Ball[], K: number): number {
    const r = radius(this.current, K);
    const x = this.clampX(r);
    const y0 = FB - r - 1;
    let ye = FT + r;
    for (const b of balls) {
      const d = Math.abs(b.position.x - x);
      const m = b.rad + r;
      if (d < m && b.position.y < y0) {
        const yc = b.position.y + Math.sqrt(m * m - d * d);
        if (yc < y0 && yc > ye) ye = yc;
      }
    }
    return ye;
  }
}
