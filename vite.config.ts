import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base: './' 讓網站放在 GitHub Pages 的子路徑（/儲存庫名/）時資源路徑仍然正確
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        game: resolve(process.cwd(), 'index.html'),
        creator: resolve(process.cwd(), 'creator.html'),
      },
    },
  },
});
