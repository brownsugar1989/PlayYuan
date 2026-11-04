import { CONFIG, TUNING } from './config';
import { checkGameOver } from './gameover';
import { Launcher } from './launcher';
import { processMerges } from './merge';
import { PhysicsWorld } from './physics';
import type { Pop, Ring } from './types';

/** 遊戲狀態與主更新：串起物理、發射器、合成、結束判定 */
export class Game {
  K = CONFIG.MAX_LEVEL;
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

  /** 測試用：在 4 ~ 10 級之間切換最高等級並重新開始 */
  cycleLevel() {
    this.K = this.K >= 10 ? 4 : this.K + 1;
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
