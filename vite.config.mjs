// 以 Vite + vite-plugin-monkey 把 src/ 打包成單一 Tampermonkey 腳本：輸出 dist/uturn-line-ext.user.js，
// `npm run build` 再複製到專案根目錄（@updateURL 指的那個檔，要一起 commit）。
// 版本單一來源＝package.json 的 version（打進 ==UserScript== 的 @version，程式內以 GM_info.script.version 取得）。
// 混淆：terser 壓縮＋改名（變數／函式名全改單字母、拿掉空白註解）；標頭維持明文，`npm run dev` 不混淆。
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  build: {
    outDir: "dist",
    minify: "terser",
    terserOptions: {
      compress: { passes: 2 },
      mangle: true,
      format: { comments: false },
    },
  },
  plugins: [
    monkey({
      entry: "src/main.js",
      userscript: {
        name: "UTurn懶惰蟲專用",
        namespace: "https://github.com/iewihc/uturn-line-ext",
        version: pkg.version,
        description: "Uturn 派單神器：複製、地址導航、快速回覆、前綴、派單轉發到 Discord、估價、預約單、後台一鍵分享自動送出、收件匣、系統自動通知、司機對話。",
        author: "iewihc",
        match: ["https://manager.line.biz/*", "https://chat.line.biz/*"],
        grant: ["GM_setClipboard", "GM_getValue", "GM_setValue", "GM_xmlhttpRequest", "GM_cookie"],
        // line.biz：轉傳客人的 LINE 圖片；storage.googleapis.com：轉傳司機上傳的圖片
        connect: ["discord.com", "discordapp.com", "mr-chi-tech.com", "line.biz", "storage.googleapis.com"],
        homepageURL: "https://github.com/iewihc/uturn-line-ext",
        supportURL: "https://github.com/iewihc/uturn-line-ext/issues",
        downloadURL: "https://raw.githubusercontent.com/iewihc/uturn-line-ext/main/uturn-line-ext.user.js",
        updateURL: "https://raw.githubusercontent.com/iewihc/uturn-line-ext/main/uturn-line-ext.user.js",
        "run-at": "document-start",
      },
      build: {
        fileName: "uturn-line-ext.user.js",
        metaFileName: false,
        autoGrant: false,
      },
    }),
  ],
});
