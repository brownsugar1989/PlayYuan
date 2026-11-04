/** 玩家每次初次開啟遊戲時的最高等級預設值；遊戲上限固定為 10。 */
export const DEFAULT_PLAYER_MAX_LEVEL = 5;

/** ===== 遊戲預設外觀與結算文字 ===== */
export const CONFIG = {
  /** 預設球圖；客製化遊戲圖片由加密分享設定提供。 */
  BALL_IMAGES: {} as Record<number, string>,

  /** 預設結算文字 */
  RESULT: { title: '恭喜你獲得', unit: '分' },
};

/** 背景圖路徑（public/assets/） */
export const BG_IMAGE = 'assets/bg.webp';

/** 畫面與場地（內部座標 360 × 640，會等比縮放到螢幕） */
export const LAYOUT = { W: 360, H: 640, X0: 8, X1: 352, FT: 96, FB: 480 } as const;

/** 手感與規則參數（需要實際遊玩後調校） */
export const TUNING = {
  gravityY: -0.6,          // 全域「重力」，負值 = 拉向遠端牆
  launchSpeed: 6,          // 發射初速
  maxSpeed: 8,             // 終端速度上限（避免穿透）
  frictionAir: 0.005,      // 空氣阻力，越小碰撞後滑得越快
  shotCooldownMs: 350,     // 最短發射間隔
  mergeImmuneMs: 220,      // 新合成的球在這段時間內不會再被合成（讓連鎖看得清楚）
  overGraceSec: 1.2,       // 剛發射的球多久後開始計入結束判定
  overHoldSec: 0.5,        // 越線後多久再判定
  overFraction: 0.2,       // 越線面積超過這個比例才結束
  radiusScale: 1.18,       // 球整體尺寸設定為 1.18
  r1: 14.4,                // 1 級球半徑
  rMaxSmall: 52,           // 最高等級 <= 6 時，最高級球半徑
  rMaxLarge: 72,           // 最高等級 >= 7 時，最高級球半徑
  stepMs: 1000 / 120,      // 物理步長
};
