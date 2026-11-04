import { DEFAULT_PLAYER_MAX_LEVEL, TUNING } from './config';
import { checkGameOver } from './gameover';
import { Launcher } from './launcher';
import { processMerges } from './merge';
import { PhysicsWorld } from './physics';
import type { Pop, Ring } from './types';

const MAX_LEVEL_KEY = 'balloon-push-merge:max-level';

function getSavedMaxLevel() {
  try {
    const saved = Number(localStorage.getItem(MAX_LEVEL_KEY));
    if (Number.isInteger(saved) && saved >= 4 && saved <= 10) return saved;
  } catch { /* local storage can be unavailable in private browsing */ }
  return Math.max(4, Math.min(10, DEFAULT_PLAYER_MAX_LEVEL));
}

/** 遊戲狀態與主更新：串起物理、發射器、合成、結束判定 */
export class Game {
  K = getSavedMaxLevel();
  score = 0;
  state: 'play' | 'over' = 'play';
  warning = false;
  world = new PhysicsWorld();
  launcher = new Launcher();
  pops: Pop[] = [];
  rings: Ring[] = [];
  private acc = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.world.maxLevel = this.K;
    this.world.clear();
    this.pops = [];
    this.rings = [];
    this.score = 0;
    this.state = 'play';
    this.warning = false;
    this.acc = 0;
    this.launcher.reset(this.K);
  }

  /** 調整最高等級並重新開始，偏好只保存在目前瀏覽器 */
  adjustMaxLevel(delta: number) {
    const next = Math.max(4, Math.min(10, this.K + delta));
    if (next === this.K) return;
    this.K = next;
    try { localStorage.setItem(MAX_LEVEL_KEY, String(this.K)); } catch { /* continue without persistence */ }
    this.reset();
  }

  update(dtMs: number) {
    const dt = dtMs / 1000;
    if (this.state === 'play') {
      this.acc += dtMs;
      while (this.acc >= TUNING.stepMs) {
        this.world.step();
        this.score += processMerges(this.world, this.K, this.pops, this.rings);
        this.acc -= TUNING.stepMs;
      }
      const r = checkGameOver(this.world.balls, this.K, dt);
      this.warning = r.warning;
      if (r.over) this.state = 'over';
    }
    for (const o of this.pops) o.t += dt;
    this.pops = this.pops.filter((o) => o.t < 1);
    for (const o of this.rings) o.t += dt;
    this.rings = this.rings.filter((o) => o.t < 0.3);
  }
}
