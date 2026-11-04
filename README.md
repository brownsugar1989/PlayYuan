# 合成我的心上人

一款可以逐級放入自選照片的氣球合成小遊戲。玩家移動發射位置並放開，讓氣球往上滑動；相同等級相撞時會合成更高一級。

一般合成的分數是「被合併球的等級 × 50」。合成出本局最高等級時，立即獲得大分，公式為「最高等級 × 50 × 2^最高等級」，新生成的最高級球會留在場上。若本局最高等級設定為 7 至 10，兩顆最高級球之後再次相撞會消失，並再獲得一次大分。

## 直接開始

- [開始遊玩](https://brownsugar1989.github.io/PlayYuan/)
- [製作專屬版本](https://brownsugar1989.github.io/PlayYuan/creator.html)
- [單一 HTML 版](https://brownsugar1989.github.io/PlayYuan/standalone/)

手機和平板可用手指拖曳調整發射位置；電腦可用滑鼠。放開後就會發射氣球。相同等級的氣球會合成；最高級球的合成規則會依玩家設定的最高等級而異。

### 調整本局最高等級

遊戲畫面左上角的「最高級」控制器可設定本局最高等級，範圍是第 4 至第 10 級，預設為第 5 級。按「−」或「+」會重新開始本局。設定會保存在目前瀏覽器，不會改變客製遊戲的設定。

## 製作專屬遊戲連結

前往[製作專屬版本](https://brownsugar1989.github.io/PlayYuan/creator.html)，依序完成：

1. 在想放照片的等級按「上傳圖片」。第 1 至第 10 級都能分別設定；留空的等級會使用遊戲預設顏色。支援 JPG、PNG、WebP，單張原始圖片上限為 20 MB。
2. 上傳後可調整照片的裁切、位置、縮放與氣球效果，也可選擇在本機瀏覽器去背。第一次使用去背功能時，瀏覽器會下載模型；照片本身不會傳給模型服務。
3. 編輯結算畫面的兩行文字。第二行必須包含 `{{score}}`，遊戲會在該處顯示玩家分數。
4. 按「生成網址」，再按「複製連結」分享。也可以在同一瀏覽器刪除自己建立的版本。

### 照片與分享連結的隱私

照片的裁切、去背及加密都在瀏覽器中處理。生成時，處理後的圖片會縮小、加密，再傳到 Cloudflare 儲存服務；GitHub 儲存庫不會收到圖片。儲存服務保存的是密文，預設 30 天後刪除。

完整分享網址包含解密金鑰。拿到完整網址的人就能遊玩並看到其中的照片，因此請只分享給信任的人。建立版本時用來刪除資料的金鑰保存在建立者的瀏覽器；請用同一個瀏覽器刪除。即使沒有手動刪除，版本也會在保存期限後失效。

### 共用最高分

每條客製遊戲連結有共用最高分，同一連結中不同的「最高級」設定各自分開排名。遊戲只傳送分數，不記錄玩家名稱。分數由瀏覽器提交，沒有反作弊驗證，適合休閒遊玩。

## 開發與本機預覽

需要 Node.js 18 以上。在專案資料夾執行：

```bash
npm install
npm run dev        # 啟動本機開發伺服器
npm run typecheck  # 執行 TypeScript 型別檢查
npm run build      # 建置到 dist/
npm run preview    # 預覽建置結果
```

單一 HTML 版位於 `public/standalone/index.html`，部署後可由上方網址開啟。

## 部署網站

此儲存庫已設定 GitHub Actions。推送到 `main` 後會自動建置並部署 GitHub Pages。若是自己的 fork：

1. 將專案推送到 GitHub 儲存庫的 `main` 分支。
2. 在儲存庫 **Settings → Pages** 將 **Build and deployment → Source** 設為 **GitHub Actions**。
3. 到 **Actions** 查看 `Deploy to GitHub Pages` 工作流程，等待成功完成。
4. 網站網址會顯示在 **Settings → Pages**。專案儲存庫的網址格式通常是 `https://<帳號>.github.io/<儲存庫名>/`。

## 分享服務（維護者設定）

客製遊戲由前端 GitHub Pages 和 Cloudflare Worker/R2 儲存服務共同提供。部署自己的副本時，需在 Cloudflare 建立 R2 bucket，設定 `backend/wrangler.toml` 的 bucket 名稱與允許來源，再從 `backend` 資料夾登入並部署：

```bash
cd backend
npx wrangler login
npx wrangler r2 bucket create <bucket-name>
npx wrangler deploy
```

GitHub Actions 建置網站時，儲存 API 網址使用 `VITE_STORAGE_API_URL`。若你的 Worker 網址不同，請在 GitHub 儲存庫的 **Settings → Secrets and variables → Actions → Variables** 設定該變數。Worker 的 `ALLOWED_ORIGINS` 也要包含你的 Pages 網址；否則瀏覽器會拒絕呼叫分享服務。

沒有設定或部署分享服務時，一般遊戲仍可遊玩，但客製遊戲無法生成分享網址。部署 Worker 前，維護者也應為建立客製遊戲的 API 設定速率限制。

## 預設外觀與遊戲程式

- 預設球圖片與結算文字：`src/config.ts`
- 尺寸、重力、發射速度等手感參數：同檔案的 `TUNING`
- 建議在 `public/assets/balls/` 放入預設球圖片，再於 `src/config.ts` 設定路徑。
- 客製遊戲圖片不會提交到程式碼儲存庫。

主要模組：

| 檔案 | 用途 |
|---|---|
| `src/config.ts` | 預設外觀、版面與遊戲參數 |
| `src/levels.ts` | 等級、球體大小、顏色與分數 |
| `src/physics.ts` | Matter.js 物理模擬 |
| `src/merge.ts` | 合成與計分 |
| `src/gameover.ts` | 結束判定 |
| `src/launcher.ts` | 發射器與下一顆球 |
| `src/input.ts` | 觸控與滑鼠操作 |
| `src/renderer.ts` | 遊戲畫面與結算畫面 |
| `src/assets.ts` | 圖片載入與氣球顏色取樣 |
| `src/game.ts` | 遊戲狀態 |
| `src/main.ts` | 遊戲進入點 |
| `src/creator.ts`、`src/photo-editor.ts` | 客製化編輯器與照片處理 |
| `backend/worker.js` | 加密遊戲資料與共用最高分 API |

## 注意事項

- `npm run build` 不執行型別檢查；型別檢查請另外執行 `npm run typecheck`。
- 背景圖中的角色可能有其原作者授權條件，重新發布前請確認使用權。
