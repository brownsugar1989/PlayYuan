# PlayYuan
It's the place to store some small, customized games

---

# 推推合成球

類似 Suika Game 的合成遊戲，把「垂直掉落」改成「水平推移」：從手機底部左右選位置、放開發射，氣球往遠端牆滑行，同級相撞會合成更高一級。

- 技術：TypeScript + Vite + Matter.js（Canvas 2D）
- 部署：GitHub Pages（GitHub Actions 自動建置）

## 網址（部署完成後）

| 版本 | 網址 |
|---|---|
| TypeScript + Vite 版 | `https://<你的帳號>.github.io/<儲存庫名>/` |
| 單一 HTML 版 | `https://<你的帳號>.github.io/<儲存庫名>/standalone/` |

單一 HTML 版放在 `public/standalone/index.html`，不需要建置，內含背景圖，物理引擎從 CDN 載入。

## 本機開發

需要 Node.js 18 以上。

```bash
npm install
npm run dev        # 開發伺服器，網址會顯示在終端機
npm run typecheck  # 型別檢查
npm run build      # 建置到 dist/
npm run preview    # 預覽建置結果
```

## 遊戲中調整最高等級

遊戲畫面左上方有「最高等級」控制器，按 **−** 或 **+** 可在 4 到 10 級之間調整。每次調整會重新開始本局；設定會保存在目前瀏覽器，下次開啟仍會使用。不同裝置或瀏覽器的設定彼此獨立。

預設值仍可在 `src/config.ts` 的 `CONFIG.MAX_LEVEL` 修改。

## 開發者可以調整的設定

等級球圖片與結算文字在 `src/config.ts`：

1. **等級球圖片**：`CONFIG.BALL_IMAGES`。把圖片放進 `public/assets/balls/`，再填入對應等級，例如：
   ```ts
   BALL_IMAGES: { 1: 'assets/balls/1.webp', 2: 'assets/balls/2.webp' }
   ```
   沒填的等級使用預設顏色。有圖片的球會裁成圓形、不顯示等級數字，氣球結的顏色會自動取圖片底邊的顏色。
2. **結算畫面文字**：`CONFIG.RESULT`（`title` 標題、`unit` 分數單位）。預設樣式是 `{ title: '遊戲結束', unit: '分' }`。

手感參數（重力、發射速度、碰撞後滑動速度、結束判定時間…）在同一個檔案的 `TUNING`。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `src/config.ts` | 開發者設定、版面、手感參數 |
| `src/levels.ts` | 半徑、顏色、隨機生成範圍、計分、警戒線位置 |
| `src/physics.ts` | Matter.js 封裝：牆、球、碰撞偵測 |
| `src/merge.ts` | 合成、計分、最高級規則 |
| `src/gameover.ts` | 警戒線結束判定 |
| `src/launcher.ts` | 發射器、下一顆、瞄準線 |
| `src/input.ts` | 觸控與滑鼠輸入 |
| `src/renderer.ts` | 繪圖：背景、氣球、HUD、跳字、結算畫面 |
| `src/assets.ts` | 圖片載入、氣球結顏色偵測 |
| `src/game.ts` | 遊戲狀態與主更新 |
| `src/main.ts` | 進入點 |

## 部署到 GitHub Pages

1. 在 GitHub 建立一個新的儲存庫（例如 `balloon-push-merge`）。
2. 把這個專案推上去：
   ```bash
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/<儲存庫名>.git
   git push -u origin main
   ```
3. 到儲存庫的 **Settings → Pages**，把 **Source** 選成 **GitHub Actions**。
4. 回到 **Actions** 分頁，等 `Deploy to GitHub Pages` 跑完（綠色勾勾），網址就會出現在 Pages 設定頁。
5. 之後每次推送到 `main`，網站都會自動更新。

## 注意

- `npm run build` 只做建置，不含型別檢查；型別檢查請用 `npm run typecheck`。
- 建議第一次在本機 `npm install` 之後，把產生的 `package-lock.json` 一起提交。
- 背景圖內的角色是他人作品，公開發佈前請留意授權。
