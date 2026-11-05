import './style.css';
import { BG_IMAGE } from './config';
import { Game } from './game';
import { bindInput } from './input';
import { Renderer } from './renderer';
import { setCustomBallImages } from './assets';
import { loadSharedGame } from './share';
import { getBestScore, submitScore } from './leaderboard';

const cv = document.getElementById('c') as HTMLCanvasElement;
const bg = document.getElementById('bg') as HTMLDivElement;
// 畫布以外的空白處，用同一張背景放大模糊填滿
bg.style.backgroundImage = `url(${import.meta.env.BASE_URL}${BG_IMAGE})`;

/** Temporary on-device diagnostics; only visible with ?sharpness=1. */
function showSharpnessDiagnostics() {
  const params = new URLSearchParams(location.search);
  if (!params.has('sharpness')) return;
  const rasterSnapshot = params.has('raster');
  const freezeAfterFirstFrame = params.has('freeze') || rasterSnapshot;

  const panel = document.createElement('pre');
  panel.setAttribute('aria-label', '畫面清晰度診斷資訊');
  Object.assign(panel.style, {
    position: 'fixed', right: '8px', bottom: '8px', zIndex: '9999',
    margin: '0', padding: '8px 10px', borderRadius: '8px',
    background: 'rgba(0,0,0,.82)', color: '#fff',
    font: '12px/1.4 ui-monospace, monospace', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', pointerEvents: 'none',
  });
  document.body.append(panel);

  const update = () => {
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const visual = window.visualViewport;
    panel.textContent = [
      'SHARPNESS CHECK',
      'render ' + (rasterSnapshot ? 'PNG snapshot' : freezeAfterFirstFrame ? 'single frame (frozen)' : 'continuous + startup refresh'),
      `DPR ${dpr} | page zoom ${visual?.scale ?? 1}`,
      `screen ${screen.width}×${screen.height}`,
      `viewport ${innerWidth}×${innerHeight}`,
      `visual ${visual?.width.toFixed(1) ?? '-'}×${visual?.height.toFixed(1) ?? '-'}`,
      `canvas ${cv.width}×${cv.height}`,
      `CSS ${rect.width.toFixed(2)}×${rect.height.toFixed(2)}`,
      `bitmap/CSS ${(cv.width / rect.width).toFixed(2)}×${(cv.height / rect.height).toFixed(2)}`,
    ].join('\n');
  };
  update();
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
}

async function start() {
  const customization = await loadSharedGame();
  if (customization) setCustomBallImages(customization.images);
  const game = new Game();
  const renderer = new Renderer(cv, customization?.result, Boolean(customization?.id));
  showSharpnessDiagnostics();

  let leaderboardLevel = game.K;
  const refreshLeaderboard = (maxLevel: number) => {
    if (!customization?.id) return;
    void getBestScore(customization.id, maxLevel)
      .then((score) => {
        if (leaderboardLevel === maxLevel) renderer.setBestScore(score);
      })
      .catch(() => {
        if (leaderboardLevel === maxLevel) renderer.setLeaderboardError();
      });
  };
  if (customization?.id) refreshLeaderboard(leaderboardLevel);

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
      if (x >= 8 && x <= 130 && y >= 48 && y <= 72) {
        location.href = `${import.meta.env.BASE_URL}creator.html`;
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
  let previousState = game.state;
  const diagnosticParams = new URLSearchParams(location.search);
  const rasterSnapshot = diagnosticParams.has('raster');
  const freezeAfterFirstFrame = diagnosticParams.has('freeze') || rasterSnapshot;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let canvasLayerRefreshed = false;
  let rasterSnapshotCreated = false;
  function loop(now: number) {
    const dt = Math.min(50, now - last);
    last = now;
    game.update(dt);
    if (customization?.id && leaderboardLevel !== game.K) {
      leaderboardLevel = game.K;
      refreshLeaderboard(leaderboardLevel);
    }
    if (game.state === 'over' && previousState !== 'over' && customization?.id) {
      const maxLevel = game.K;
      void submitScore(customization.id, game.score, maxLevel)
        .then((score) => {
          if (leaderboardLevel === maxLevel) renderer.setBestScore(score);
        })
        .catch(() => {
          if (leaderboardLevel === maxLevel) renderer.setLeaderboardError();
        });
    }
    previousState = game.state;
    renderer.draw(game);
    if (isIOS && !canvasLayerRefreshed) {
      canvasLayerRefreshed = true;
      cv.style.display = 'none';
      void cv.offsetHeight;
      requestAnimationFrame(() => {
        cv.style.display = '';
        void cv.offsetHeight;
        requestAnimationFrame(loop);
      });
      return;
    }
    if (rasterSnapshot && !rasterSnapshotCreated) {
      rasterSnapshotCreated = true;
      const rect = cv.getBoundingClientRect();
      const snapshot = document.createElement('img');
      snapshot.alt = 'Canvas PNG 快照比較';
      snapshot.src = cv.toDataURL('image/png');
      Object.assign(snapshot.style, {
        position: 'fixed',
        left: rect.left + 'px',
        top: rect.top + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        zIndex: '2',
      });
      document.body.append(snapshot);
      cv.style.visibility = 'hidden';
    }
    if (!freezeAfterFirstFrame) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

void start().catch((error: unknown) => {
  const panel = document.getElementById('share-error');
  if (panel) {
    panel.textContent = error instanceof Error ? error.message : '無法載入這個客製化遊戲。';
    panel.hidden = false;
  }
});
