import { LAYOUT } from './config';

export interface InputHandlers {
  /** 回傳 true 表示開始拖曳（之後會收到 onMove / onUp） */
  onDown: (x: number, y: number) => boolean;
  onMove: (x: number) => void;
  onUp: () => void;
  onCancel: () => void;
}

/** 觸控與滑鼠共用 Pointer Events，座標轉成內部座標 360 × 640 */
export function bindInput(cv: HTMLCanvasElement, h: InputHandlers) {
  const pt = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    const s = r.width / LAYOUT.W;
    return [(e.clientX - r.left) / s, (e.clientY - r.top) / s];
  };
  let dragging = false;
  cv.addEventListener('pointerdown', (e) => {
    const [x, y] = pt(e);
    if (h.onDown(x, y)) { dragging = true; cv.setPointerCapture(e.pointerId); }
  });
  cv.addEventListener('pointermove', (e) => { if (dragging) h.onMove(pt(e)[0]); });
  cv.addEventListener('pointerup', () => { if (dragging) { dragging = false; h.onUp(); } });
  cv.addEventListener('pointercancel', () => { if (dragging) { dragging = false; h.onCancel(); } });
}
