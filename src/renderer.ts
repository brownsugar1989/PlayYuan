import { CONFIG, LAYOUT } from './config';
import { ballImage, bgImage, edgeColor, ready } from './assets';
import { levelColor, lineY, radius, showPreview } from './levels';
import type { Game } from './game';

const FONT = '"PingFang TC","Noto Sans TC",system-ui,sans-serif';

export interface ResultText {
  line1: string;
  line2: string;
}

/** 畫面繪製：背景、球場、氣球、瞄準線、HUD、得分跳字、結算畫面 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(
    private cv: HTMLCanvasElement,
    private result: ResultText = {
      line1: CONFIG.RESULT.title,
      line2: `{{score}}${CONFIG.RESULT.unit}`,
    },
  ) {
    this.ctx = cv.getContext('2d')!;
    this.fit();
    addEventListener('resize', () => this.fit());
  }

  /** 9:16 內部畫布等比縮放並考慮高解析度螢幕 */
  private fit() {
    const { W, H } = LAYOUT;
    const s = Math.min(innerWidth / W, innerHeight / H);
    const d = devicePixelRatio || 1;
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    this.cv.width = Math.round(W * s * d);
    this.cv.height = Math.round(H * s * d);
    this.ctx.setTransform(s * d, 0, 0, s * d, 0, 0);
  }

  private text(s: string, x: number, y: number, size: number, align: CanvasTextAlign) {
    const c = this.ctx;
    c.font = `800 ${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size / 4;
    c.strokeStyle = '#8a2f5c';
    c.strokeText(s, x, y);
    c.fillStyle = '#fff';
    c.fillText(s, x, y);
  }

  /** 氣球：氣球結（偵測底部邊緣色）、球身、圖片、外框、光澤、數字 */
  private ball(n: number, x: number, y: number, r: number, K: number, alpha = 1) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = 'rgba(70,20,50,.35)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;

    // 氣球結
    c.fillStyle = edgeColor(n, K);
    c.strokeStyle = edgeColor(n, K);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y + r * 0.96);
    c.lineTo(x - r * 0.13, y + r * 1.2);
    c.lineTo(x + r * 0.13, y + r * 1.2);
    c.closePath();
    c.fill();
    c.stroke();

    // 球身（最高級為鑽石閃）
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (n >= K) {
      const T = performance.now() / 1000;
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.5, `hsl(${(T * 70) % 360},90%,82%)`);
      g.addColorStop(1, `hsl(${(T * 70 + 120) % 360},85%,70%)`);
      c.fillStyle = g;
    } else {
      c.fillStyle = levelColor(n, K);
    }
    c.fill();
    c.shadowColor = 'transparent';

    // 圖片（裁成圓形，cover 填滿）
    const im = ballImage(n);
    if (im) {
      c.save();
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.clip();
      const s = Math.max((2 * r) / im.naturalWidth, (2 * r) / im.naturalHeight);
      c.drawImage(im, x - (im.naturalWidth * s) / 2, y - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
      c.restore();
    }

    // 外框
    c.lineWidth = 2;
    c.strokeStyle = edgeColor(n, K);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();

    // 光澤：立體光影 + 左上角高光（透明度偏低，蓋在照片上也不擋）
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.clip();
    const sg = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    sg.addColorStop(0, 'rgba(255,255,255,.25)');
    sg.addColorStop(0.55, 'rgba(255,255,255,0)');
    sg.addColorStop(1, 'rgba(90,30,70,.2)');
    c.fillStyle = sg;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath();
    c.ellipse(x - r * 0.42, y - r * 0.46, r * 0.17, r * 0.1, -0.7, 0, Math.PI * 2);
    c.fill();

    // 鑽石閃的星芒
    if (n >= K && !im) {
      c.fillStyle = '#fff';
      const T = performance.now() / 500;
      for (let i = 0; i < 3; i++) {
        const a = T + i * 2.1;
        const px = x + Math.cos(a) * r * 0.45;
        const py = y + Math.sin(a * 1.3) * r * 0.45;
        c.fillRect(px - 1.5, py - 5, 3, 10);
        c.fillRect(px - 5, py - 1.5, 10, 3);
      }
    }

    // 等級數字（有圖片時不顯示）
    if (!im) {
      c.fillStyle = 'rgba(90,30,70,.55)';
      c.font = `bold ${Math.max(10, r * 0.6)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(n), x, y);
    }
    c.restore();
  }

  draw(g: Game) {
    const c = this.ctx;
    const now = performance.now();
    const K = g.K;
    const { W, H, X0, X1, FT, FB } = LAYOUT;

    c.imageSmoothingQuality = 'high';
    c.clearRect(0, 0, W, H);

    // 背景：以寬度為準，從底部對齊（保住底部的娃娃）
    if (ready(bgImage)) {
      const h = (W * bgImage.naturalHeight) / bgImage.naturalWidth;
      c.drawImage(bgImage, 0, H - h, W, h);
    }

    // 球場底色與邊框
    c.fillStyle = 'rgba(60,20,45,.28)';
    c.fillRect(X0, FT, X1 - X0, FB - FT);
    c.strokeStyle = 'rgba(255,255,255,.7)';
    c.lineWidth = 3;
    c.strokeRect(X0, FT, X1 - X0, FB - FT);

    // 警戒線
    const ly = lineY(K);
    c.setLineDash([8, 6]);
    c.strokeStyle = g.warning ? '#ff4d6d' : 'rgba(255,255,255,.75)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(X0, ly);
    c.lineTo(X1, ly);
    c.stroke();
    c.setLineDash([]);

    // 場上的球（合成出的球有放大回彈動畫）
    for (const b of g.world.balls) {
      const t = now - b.t0;
      const u = Math.min(1, t / 260);
      const s = b.mg ? (u < 0.5 ? 0.6 + u * 1.1 : 1.15 - (u - 0.5) * 0.3) : Math.min(1, 0.75 + t / 600);
      this.ball(b.lv, b.position.x, b.position.y, b.rad * s, K);
    }

    // 合成到最高級的光環
    for (const o of g.rings) {
      const u = o.t / 0.3;
      c.save();
      c.globalAlpha = 1 - u;
      c.strokeStyle = '#fff';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(o.x, o.y, o.r * (1 + 0.5 * u), 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    // 瞄準線與待發射的球
    if (g.state === 'play') {
      const L = g.launcher;
      const r = radius(L.current, K);
      const x = L.clampX(r);
      const y0 = FB - r - 1;
      const ye = L.aimEndY(g.world.balls, K);
      c.save();
      c.globalAlpha = L.dragging ? 0.95 : 0.45;
      c.setLineDash([8, 8]);
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      c.strokeStyle = '#fff';
      c.beginPath();
      c.moveTo(x, y0 - r);
      c.lineTo(x, ye);
      c.stroke();
      c.restore();
      this.ball(L.current, x, y0, r, K, L.dragging ? 1 : 0.5);
    }

    // HUD：分數（右上）、下一顆預覽（分數下方，最高等級 >= 8）
    const scoreText = '你有多棒: ' + g.score.toLocaleString('en-US');
    let scoreSize = 24;
    c.font = `800 ${scoreSize}px ${FONT}`;
    while (scoreSize > 12 && c.measureText(scoreText).width > X1 - 138) {
      scoreSize--;
      c.font = `800 ${scoreSize}px ${FONT}`;
    }
    this.text(scoreText, X1, 26, scoreSize, 'right');
    if (showPreview(K)) {
      c.fillStyle = 'rgba(255,255,255,.4)';
      c.beginPath();
      c.roundRect(300, 44, 52, 52, 10);
      c.fill();
      const r = radius(g.launcher.next, K);
      this.ball(g.launcher.next, 326, 70, r * Math.min(1, 22 / r), K);
    }

    // 最高等級控制：選擇會保存在目前瀏覽器
    c.fillStyle = 'rgba(255,255,255,.78)';
    c.beginPath();
    c.roundRect(8, 10, 122, 30, 15);
    c.fill();
    c.fillStyle = '#7a2a52';
    c.font = 'bold 10px sans-serif';
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.fillText('最高級', 13, 25);
    for (const [x, disabled] of [[49, K <= 4], [98, K >= 10]] as const) {
      c.fillStyle = disabled ? 'rgba(122,42,82,.06)' : 'rgba(122,42,82,.12)';
      c.beginPath();
      c.roundRect(x, 15, 20, 20, 10);
      c.fill();
    }
    c.fillStyle = K <= 4 ? 'rgba(122,42,82,.4)' : '#7a2a52';
    c.textAlign = 'center';
    c.font = 'bold 15px sans-serif';
    c.fillText('−', 59, 25);
    c.font = 'bold 13px sans-serif';
    c.fillText(String(K), 83, 25);
    c.fillStyle = K >= 10 ? 'rgba(122,42,82,.4)' : '#7a2a52';
    c.font = 'bold 15px sans-serif';
    c.fillText('+', 108, 25);

    c.fillStyle = 'rgba(255,255,255,.72)';
    c.beginPath();
    c.roundRect(8, 48, 122, 24, 12);
    c.fill();
    c.fillStyle = '#7a2a52';
    c.font = 'bold 10px sans-serif';
    c.textAlign = 'left';
    c.fillText('＋ 製作專屬版本', 15, 60);

    // 得分跳字：碰撞點左側，約 1 秒內上浮並淡出（左側放不下時改放右側）
    for (const o of g.pops) {
      const e = 1 - Math.pow(1 - o.t, 2);
      const s = '+' + o.p.toLocaleString('en-US');
      c.save();
      c.globalAlpha = 1 - o.t;
      c.font = `800 18px ${FONT}`;
      const w = c.measureText(s).width;
      const left = o.x - o.r - 4 - w < X0 + 2;
      this.text(s, left ? o.x + o.r + 4 : o.x - o.r - 4, o.y - 36 * e, 18, left ? 'left' : 'right');
      c.restore();
    }

    // 結算畫面
    if (g.state === 'over') {
      c.fillStyle = 'rgba(40,10,30,.6)';
      c.fillRect(0, 0, W, H);
      const score = g.score.toLocaleString('en-US');
      const line2 = this.result.line2.replace(/\{\{score\}\}/g, score);
      this.fitCenteredText(this.result.line1, W / 2, 250, 36, W - 32);
      this.fitCenteredText(line2, W / 2, 310, 28, W - 32);
      c.fillStyle = '#fff';
      c.beginPath();
      c.roundRect(110, 350, 140, 44, 22);
      c.fill();
      c.fillStyle = '#8a2f5c';
      c.font = 'bold 18px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('重新開始', W / 2, 372);
    }
  }

  private fitCenteredText(text: string, x: number, y: number, size: number, maxWidth: number) {
    const c = this.ctx;
    let fitted = size;
    c.font = `800 ${fitted}px ${FONT}`;
    while (fitted > 14 && c.measureText(text).width > maxWidth) {
      fitted--;
      c.font = `800 ${fitted}px ${FONT}`;
    }
    this.text(text, x, y, fitted, 'center');
  }
}
