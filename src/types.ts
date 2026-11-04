import type Matter from 'matter-js';

export interface Ball extends Matter.Body {
  lv: number;        // 等級
  rad: number;       // 半徑
  age: number;       // 存在秒數
  crossed: boolean;  // 是否曾經越過警戒線往遠端
  over: number;      // 越線持續秒數
  nm: number;        // 在此時間之前不可合成（ms）
  mg: boolean;       // 是否由合成產生
  dead: boolean;     // 已排入合成佇列
  t0: number;        // 出生時間（ms）
}

export interface Pop { p: number; x: number; y: number; r: number; t: number }
export interface Ring { x: number; y: number; r: number; t: number }
