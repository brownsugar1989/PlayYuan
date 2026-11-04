import Matter from 'matter-js';
import { CONFIG, LAYOUT, TUNING } from './config';
import { radius } from './levels';
import type { Ball } from './types';

const { Engine, Bodies, Body, Composite, Events } = Matter;
const { W, X0, X1, FT, FB } = LAYOUT;

/** 物理世界：牆、球、碰撞偵測（只負責偵測，合成由 merge.ts 處理） */
export class PhysicsWorld {
  engine = Engine.create({ positionIterations: 8, velocityIterations: 6 });
  balls: Ball[] = [];
  /** 待合成的球對（同級、尚未排隊、不在冷卻中） */
  queue: [Ball, Ball][] = [];
  maxLevel = CONFIG.MAX_LEVEL;

  constructor() {
    this.engine.gravity.x = 0;
    this.engine.gravity.y = TUNING.gravityY;
    const wall = { isStatic: true, restitution: 0, friction: 0 };
    const FD = FB - FT;
    Composite.add(this.engine.world, [
      Bodies.rectangle(W / 2, FT - 25, W + 200, 50, wall),          // 遠端牆
      Bodies.rectangle(X0 - 25, (FT + FB) / 2, 50, FD + 400, wall), // 左牆
      Bodies.rectangle(X1 + 25, (FT + FB) / 2, 50, FD + 400, wall), // 右牆
      Bodies.rectangle(W / 2, FB + 27, W + 200, 50, wall),          // 玩家側底牆
    ]);
    Events.on(this.engine, 'collisionStart', this.onContact);
    Events.on(this.engine, 'collisionActive', this.onContact);
    Events.on(this.engine, 'beforeUpdate', () => {
      for (const b of this.balls) {
        const s = Math.hypot(b.velocity.x, b.velocity.y);
        if (s > TUNING.maxSpeed) {
          Body.setVelocity(b, { x: (b.velocity.x * TUNING.maxSpeed) / s, y: (b.velocity.y * TUNING.maxSpeed) / s });
        }
      }
    });
  }

  private onContact = (e: Matter.IEventCollision<Matter.Engine>) => {
    const now = performance.now();
    const K = this.maxLevel;
    for (const p of e.pairs) {
      const a = p.bodyA as Ball;
      const b = p.bodyB as Ball;
      if (
        a.label === 'ball' && b.label === 'ball' && a.lv === b.lv &&
        (a.lv < K || K > 6) &&              // 最高等級 <= 6 時，最高級球不再合成
        !a.dead && !b.dead && now > a.nm && now > b.nm
      ) {
        a.dead = b.dead = true;
        this.queue.push([a, b]);
      }
    }
  };

  addBall(lv: number, x: number, y: number, vx = 0, vy = 0, age = 0): Ball {
    const r = radius(lv, this.maxLevel);
    const b = Bodies.circle(x, y, r, {
      restitution: 0, friction: 0, frictionStatic: 0, frictionAir: TUNING.frictionAir, label: 'ball',
    }) as Ball;
    b.lv = lv; b.rad = r; b.age = age; b.crossed = false; b.over = 0;
    b.nm = 0; b.mg = false; b.dead = false; b.t0 = performance.now();
    Body.setVelocity(b, { x: vx, y: vy });
    Composite.add(this.engine.world, b);
    this.balls.push(b);
    return b;
  }

  removeBalls(list: Ball[]) {
    Composite.remove(this.engine.world, list);
    this.balls = this.balls.filter((o) => !list.includes(o));
  }

  clear() {
    this.removeBalls([...this.balls]);
    this.queue = [];
  }

  step() {
    Engine.update(this.engine, TUNING.stepMs);
  }
}
