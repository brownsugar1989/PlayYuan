import './style.css';
import { BG_IMAGE } from './config';
import { Game } from './game';
import { bindInput } from './input';
import { Renderer } from './renderer';

const cv = document.getElementById('c') as HTMLCanvasElement;
const bg = document.getElementById('bg') as HTMLDivElement;
// 畫布以外的空白處，用同一張背景放大模糊填滿
bg.style.backgroundImage = `url(${import.meta.env.BASE_URL}${BG_IMAGE})`;

const game = new Game();
const renderer = new Renderer(cv);

bindInput(cv, {
  onDown: (x, y) => {
    if (game.state === 'over') {
      if (x > 110 && x < 250 && y > 350 && y < 394) game.reset();
      return false;
    }
    if (x >= 8 && x <= 130 && y >= 10 && y <= 40) {
      if (x >= 49 && x <= 69) game.adjustMaxLevel(-1);
      else if (x >= 98 && x <= 118) game.adjustMaxLevel(1);
      return false;
    }
    game.launcher.dragging = true;
    game.launcher.x = x;
    return true;
  },
  onMove: (x) => { game.launcher.x = x; },
  onUp: () => {
    game.launcher.dragging = false;
    if (game.state === 'play') game.launcher.fire(game.world, game.K);
  },
  onCancel: () => { game.launcher.dragging = false; },
});

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(50, now - last);
  last = now;
  game.update(dt);
  renderer.draw(game);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
