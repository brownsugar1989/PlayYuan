# 合成我的心上人

類似 Suika Game 的合成遊戲，把「垂直掉落」改成「水平推移」：從手機底部左右選位置、放開發射，氣球往遠端牆滑行，同級相撞會合成更高一級。

- 技術：TypeScript + Vite + Matter.js（Canvas 2D）
- 部署：GitHub Pages（GitHub Actions 自動建置）

## 網址（部署完成後）

| 版本 | 網址 |
|---|---|
| TypeScript + Vite 版 | `https://<你的帳號>.github.io/<儲存庫名>/` |
| 單一 HTML 版 | `https://<你的帳號>.github.io/<儲存庫名>/standalone/` |
| 客製化編輯器 | `https://<你的帳號>.github.io/<儲存庫名>/creator.html` |

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

遊戲內建最高 10 級。遊戲畫面左上方有「最高級」控制器，玩家可以按 **−** 或 **+** 在 4 到 10 級之間調整本局上限，預設為第 5 級。每次調整會重新開始本局；偏好保存在目前瀏覽器，下次開啟仍會使用。

開發者不需要指定等級上限；圖片欄位固定提供第 1 到第 10 級。

## 客製化遊戲編輯器

開啟 `creator.html` 後，可逐級選擇圖片。圖片只套用到指定等級；留空的等級使用預設顏色。結算文字有兩行，第二行使用 `{{score}}` 表示分數插入位置。完成預覽後可以生成、複製遊戲網址，也可以刪除自己建立的版本。

照片在瀏覽器中縮小、移除原圖中常見的拍攝資訊後，以 AES-GCM 加密，再傳送到獨立儲存服務。公開 GitHub 儲存庫只包含程式碼，不會收到使用者的照片。解密金鑰放在分享網址的 `#` 片段中，瀏覽器不會把它傳給儲存 API；但收到完整網址的人仍能打開圖片，因此只分享給信任的人。客製版本預設保存 30 天，製作者可以提前刪除。

### 啟用分享儲存服務

編輯器前端由 GitHub Pages 提供；加密資料存放在 Cloudflare R2，由 `backend/worker.js` 存取。部署前需要一個 Cloudflare 帳號；從專案根目錄登入 Wrangler 並建立 R2 bucket：

```bash
cd backend
npx wrangler login
npx wrangler r2 bucket create playyuan-games
npx wrangler deploy
```

GitHub Actions 已預設使用 `https://playyuan-game-storage.playyuan-game-api.workers.dev` 作為儲存 API。若你改用其他 Worker 網址，可在 GitHub 儲存庫 **Settings → Secrets and variables → Actions → Variables** 新增或更新 `VITE_STORAGE_API_URL`，再重新執行 Pages workflow。Worker 僅允許設定中的網站來源，保存密文 30 天，並提供持有刪除金鑰者刪除資料的 API。上線前也應在 Cloudflare 為 `POST /games/*` 設定每個來源 IP 的速率限制；CORS 只約束瀏覽器頁面，無法阻止直接呼叫 API 的程式。

若 Worker 尚未部署或 `VITE_STORAGE_API_URL` 設定錯誤，編輯器可操作與預覽，但「生成網址」會顯示儲存服務錯誤。

## 預設遊戲外觀

內建預設球圖、結算文字及手感參數可以在 `src/config.ts` 編輯。客製化使用者圖片不會寫入這些檔案或 GitHub 儲存庫。

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
