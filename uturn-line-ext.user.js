// ==UserScript==
// @name         UTurn懶惰蟲專用
// @namespace    https://github.com/iewihc/uturn-line-ext
// @version      1.25.2
// @description  Uturn 派單神器：複製、地址導航、快速回覆、前綴、派單轉發到 Discord、估價、預約單、後台一鍵分享自動送出。
// @author       iewihc
// @match        https://manager.line.biz/*
// @match        https://chat.line.biz/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      discord.com
// @connect      discordapp.com
// @connect      mr-chi-tech.com
// @homepageURL  https://github.com/iewihc/uturn-line-ext
// @supportURL   https://github.com/iewihc/uturn-line-ext/issues
// @downloadURL  https://raw.githubusercontent.com/iewihc/uturn-line-ext/main/uturn-line-ext.user.js
// @updateURL    https://raw.githubusercontent.com/iewihc/uturn-line-ext/main/uturn-line-ext.user.js
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";

  const UTURN_BUILD = "1.24.2";
  try {
    console.log(
      "%c[UTurn懶惰蟲] loaded build " + UTURN_BUILD,
      "color:#1c6cf3;font-weight:bold",
    );
  } catch (_) {}

  /* ---------------------------------------------------------------------- *
   * Constants
   * ---------------------------------------------------------------------- */
  const BLUE = "#1c6cf3"; // 主要藍色
  const BLUE_HOVER = "#0b57d0";
  const BLUE_SOFT = "#eef4ff";

  const BUBBLE_CLASS = "loe-copy-bubble";
  const BUTTON_CLASS = "loe-copy-button";
  const TEXT_PAD_CLASS = "loe-copy-text-pad";
  const ICON_CLASS = "loe-copy-icon";
  const COPIED_CLASS = "loe-copy-copied";
  const MAP_LINK_CLASS = "loe-map-link";

  const QUICK_BUTTON_CLASS = "loe-quick-reply-button";
  const QUICK_MENU_CLASS = "loe-quick-reply-menu";
  const QUICK_MENU_OPEN_CLASS = "loe-quick-reply-open";
  const STORE_KEY = "loe_quick_replies_v1";
  const QR_BAR_CLASS = "loe-qr-bar"; // 輸入框上方的快捷氣泡列
  const QR_CHIP_CLASS = "loe-qr-chip";

  const FORWARD_BUTTON_CLASS = "loe-forward-button";
  const PREFIX_CHIP_CLASS = "loe-prefix-chip";
  const PREFIX_KEY = "loe_prefix_v1"; // 前綴設定（一組，對應目前 OA 帳號）
  const WEBHOOK_KEY = "loe_discord_webhook_v1"; // Discord 頻道 webhook 網址
  const DISPATCHER_KEY = "loe_dispatcher_v1"; // 派單人員名稱／後台帳號（顯示為 Discord 訊息發送者；驅動遠端設定的 key）
  const FLEET_KEY = "loe_fleet_v1"; // 目前要拉哪個車隊的遠端設定（如 HELLO）
  const DISPATCH_BUTTON_CLASS = "loe-dispatch-button"; // 派單按鈕
  const DISPATCH_POP_CLASS = "loe-dispatch-pop";
  const ESTIMATE_BUTTON_CLASS = "loe-estimate-button"; // 估價按鈕
  const AUTOREPLY_KEY = "loe_dispatch_autoreply_v1"; // 派單後是否自動回覆客人
  const MEMO_INCLUDE_KEY = "loe_dispatch_memo_include_v1"; // 派單是否帶入筆記(note:)
  const DISPATCH_TEMPLATE_KEY = "loe_dispatch_template_v1"; // 自動回覆要送的範本名稱
  const MARK_FOLLOWUP_KEY = "loe_dispatch_mark_followup_v1"; // 派單後是否標記待處理
  const LINEURL_INCLUDE_KEY = "loe_dispatch_lineurl_v1"; // 送出是否附上對話連結(linechaturl:)
  const CHAT_OVERRIDE_KEY = "loe_chat_overrides_v1"; // 對話層級覆寫（群編＋固定上車地址）


  // 派單後給客人的回覆訊息
  const DISPATCH_REPLY_MSG =
    "馬上幫您安排調派時間約③ - ⑧分\n有車會立即告知,請勿關閉通知\n派車期間請勿催促";

  const ADDRESS_PATTERN =
    /((?:(?:(?:台|臺)北|新北|桃園|(?:台|臺)中|(?:台|臺)南|高雄|基隆|新竹|嘉義|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|(?:台|臺)東|澎湖|金門|連江)[縣市])?(?:[一-鿿]{1,8}[鄉鎮市區])?[一-鿿]{1,14}(?:路|街|大道)(?:[一二三四五六七八九十\d]+段)?(?:\d+巷)?(?:\d+弄)?\d+(?:-\d+)?號(?:\d+樓)?)/g;

  // 內建 SVG 圖示（Lucide 風格），定義一次、用名稱引用 ic("copy")。
  // 不依賴任何外部 CDN，避免因連不到外站而整個腳本無法載入。
  const ICONS = {
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
    check: '<path d="M20 6 9 17l-5-5"></path>',
    x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    "message-square":
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    forward:
      '<polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path>',
    settings:
      '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    truck:
      '<path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>',
    calculator:
      '<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="14" x2="8" y2="14"></line><line x1="12" y1="14" x2="12" y2="14"></line><line x1="16" y1="14" x2="16" y2="18"></line><line x1="8" y1="18" x2="12" y2="18"></line>',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>',
  };
  const ic = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const COPY_ICON = ic("copy");
  const CHECK_ICON = ic("check");
  const ERROR_ICON = ic("x");
  const QUICK_ICON = ic("message-square");
  const FORWARD_ICON = ic("forward");
  function paintIcons() {
    /* 內建 SVG 直接渲染，無需後處理 */
  }

  /* ---------------------------------------------------------------------- *
   * Styles
   * ---------------------------------------------------------------------- */
  const style = document.createElement("style");
  style.textContent = `
    .${BUBBLE_CLASS} { position: relative !important; }
    .${TEXT_PAD_CLASS} { padding-right: 30px !important; }

    /* 每則訊息的複製按鈕 (藍色) */
    .${BUTTON_CLASS} {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 1px solid rgba(28, 108, 243, 0.30);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.86);
      color: ${BLUE};
      cursor: pointer;
      opacity: 0.5;
      user-select: none;
      backdrop-filter: blur(3px);
      transition: opacity .12s ease, background .12s ease, border-color .12s ease;
    }
    .${BUBBLE_CLASS}:hover .${BUTTON_CLASS} { opacity: 1; }
    .${BUTTON_CLASS}:hover,
    .${BUTTON_CLASS}:focus-visible {
      border-color: ${BLUE};
      background: ${BLUE_SOFT};
      color: ${BLUE_HOVER};
      opacity: 1;
      outline: none;
    }
    .${ICON_CLASS},
    .${BUTTON_CLASS} > svg,
    .${FORWARD_BUTTON_CLASS} > svg {
      width: 14px; height: 14px;
      fill: none; stroke: currentColor;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }
    .${BUTTON_CLASS}.${COPIED_CLASS} {
      border-color: rgba(6, 199, 85, 0.55);
      color: #06c755;
      background: #effaf1;
      opacity: 1;
    }

    /* 地址 -> Google Maps 連結 */
    .${MAP_LINK_CLASS} {
      color: ${BLUE_HOVER};
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }

    /* 快速回覆按鈕 (藍色，與通話邀請 icon 對齊) */
    .${QUICK_BUTTON_CLASS} {
      position: relative;
      top: 3px;                 /* 與工具列其它圖示靠下對齊 */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: ${BLUE} !important;
      cursor: pointer;
    }
    .${QUICK_BUTTON_CLASS}:hover { color: ${BLUE_HOVER} !important; }
    .${QUICK_BUTTON_CLASS} > svg {
      width: 20px; height: 20px;
      fill: none; stroke: currentColor;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
      display: block;
    }

    /* 快速回覆彈出選單 */
    .${QUICK_MENU_CLASS} {
      position: absolute;
      left: 0;
      bottom: 100%;
      margin-bottom: 10px;
      z-index: 2147483647;
      display: none;
      min-width: 200px;
      max-width: 320px;
      max-height: 320px;
      overflow-y: auto;
      padding: 6px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    }
    .${QUICK_BUTTON_CLASS}.${QUICK_MENU_OPEN_CLASS} .${QUICK_MENU_CLASS} { display: block; }
    .${QUICK_MENU_CLASS} ul { list-style: none; margin: 0; padding: 0; }
    .${QUICK_MENU_CLASS} li { margin: 0; padding: 0; }
    .loe-qr-item {
      display: block;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #1f2937;
      font: inherit;
      font-size: 13px;
      line-height: 1.35;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }
    .loe-qr-item:hover, .loe-qr-item:focus-visible {
      background: ${BLUE_SOFT};
      color: ${BLUE_HOVER};
      outline: none;
    }
    .loe-qr-empty {
      padding: 10px;
      color: #94a3b8;
      font-size: 12px;
      text-align: center;
    }
    .loe-qr-sep { height: 1px; margin: 6px 4px; background: rgba(15,23,42,0.08); }
    .loe-qr-manage {
      display: flex; align-items: center; gap: 6px;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: ${BLUE};
      font: inherit; font-size: 13px; font-weight: 600;
      text-align: left;
      cursor: pointer;
    }
    .loe-qr-manage:hover { background: ${BLUE_SOFT}; color: ${BLUE_HOVER}; }

    /* 輸入框上方的快捷氣泡列 */
    .${QR_BAR_CLASS} {
      display: flex; gap: 6px; align-items: center;
      padding: 6px 10px;
      overflow-x: auto;
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
    }
    .${QR_BAR_CLASS}::-webkit-scrollbar { height: 4px; }
    .${QR_BAR_CLASS}::-webkit-scrollbar-thumb { background: rgba(15,23,42,.15); border-radius: 4px; }
    .${QR_CHIP_CLASS} {
      flex-shrink: 0;
      padding: 5px 12px;
      border: 1px solid rgba(28, 108, 243, 0.35);
      border-radius: 999px;
      background: ${BLUE_SOFT};
      color: ${BLUE_HOVER};
      font: inherit; font-size: 12px; font-weight: 600;
      line-height: 1.2;
      cursor: pointer; white-space: nowrap;
      max-width: 200px; overflow: hidden; text-overflow: ellipsis;
    }
    .${QR_CHIP_CLASS}:hover { background: #e0ecff; border-color: ${BLUE}; }

    /* 管理視窗 */
    .loe-modal-mask {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 23, 42, 0.45);
    }
    .loe-modal {
      width: min(480px, 92vw);
      max-height: 86vh;
      display: flex; flex-direction: column;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.32);
      overflow: hidden;
      font-size: 14px;
      color: #1f2937;
    }
    .loe-modal-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(15,23,42,0.08);
      font-size: 15px; font-weight: 700;
    }
    .loe-modal-close {
      border: 0; background: transparent; cursor: pointer;
      font-size: 20px; line-height: 1; color: #64748b; padding: 2px 6px; border-radius: 6px;
    }
    .loe-modal-close:hover { background: #f1f5f9; color: #1f2937; }
    .loe-modal-body { padding: 16px 18px; overflow-y: auto; }
    .loe-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
    .loe-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(15,23,42,0.10);
      border-radius: 10px;
      background: #fafbfc;
    }
    .loe-row-info { flex: 1; min-width: 0; }
    .loe-row-name { font-weight: 600; }
    .loe-row-text {
      color: #64748b; font-size: 12px; margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .loe-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .loe-mini {
      border: 1px solid rgba(15,23,42,0.14);
      background: #fff; border-radius: 7px;
      padding: 5px 10px; font-size: 12px; cursor: pointer; color: #334155;
    }
    .loe-mini:hover { background: #f1f5f9; }
    .loe-mini:disabled { opacity: 0.35; cursor: default; }
    .loe-mini:disabled:hover { background: #fff; }
    .loe-mini.danger { color: #dc2626; border-color: rgba(220,38,38,0.3); }
    .loe-mini.danger:hover { background: #fef2f2; }
    .loe-form { display: flex; flex-direction: column; gap: 10px;
      border-top: 1px dashed rgba(15,23,42,0.14); padding-top: 16px; }
    .loe-form-title { font-weight: 700; font-size: 13px; color: #334155; }
    .loe-input, .loe-textarea {
      width: 100%; box-sizing: border-box;
      border: 1px solid rgba(15,23,42,0.18);
      border-radius: 8px; padding: 9px 11px;
      font: inherit; font-size: 13px; color: #1f2937; background: #fff;
    }
    .loe-input:focus, .loe-textarea:focus { outline: none; border-color: ${BLUE}; box-shadow: 0 0 0 3px rgba(28,108,243,0.12); }
    .loe-textarea { resize: vertical; min-height: 72px; }
    .loe-form-actions { display: flex; gap: 8px; }
    .loe-btn-primary {
      border: 0; border-radius: 8px; cursor: pointer;
      background: ${BLUE}; color: #fff; font: inherit; font-size: 13px; font-weight: 600;
      padding: 9px 16px;
    }
    .loe-btn-primary:hover { background: ${BLUE_HOVER}; }
    .loe-btn-ghost {
      border: 1px solid rgba(15,23,42,0.16); border-radius: 8px; cursor: pointer;
      background: #fff; color: #334155; font: inherit; font-size: 13px;
      padding: 9px 14px;
    }
    .loe-btn-ghost:hover { background: #f1f5f9; }

    /* 轉發按鈕（地址訊息專用，放在複製按鈕左邊） */
    .${FORWARD_BUTTON_CLASS} {
      position: absolute;
      top: 6px;
      right: 32px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: 1px solid rgba(28, 108, 243, 0.30);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.86);
      color: ${BLUE};
      cursor: pointer;
      opacity: 0.5;
      backdrop-filter: blur(3px);
      transition: opacity .12s ease, background .12s ease, border-color .12s ease;
    }
    .${BUBBLE_CLASS}:hover .${FORWARD_BUTTON_CLASS} { opacity: 1; }
    .${FORWARD_BUTTON_CLASS}:hover,
    .${FORWARD_BUTTON_CLASS}:focus-visible {
      border-color: ${BLUE}; background: ${BLUE_SOFT}; color: ${BLUE_HOVER}; opacity: 1; outline: none;
    }
    .${FORWARD_BUTTON_CLASS}.${COPIED_CLASS},
    .${BUTTON_CLASS}.${COPIED_CLASS} {
      border-color: rgba(6,199,85,.55); color: #06c755; background: #effaf1; opacity: 1;
    }
    /* 失敗閃紅（不更換 icon） */
    .${FORWARD_BUTTON_CLASS}.loe-err, .${BUTTON_CLASS}.loe-err {
      border-color: rgba(220,38,38,.55); color: #dc2626; background: #fef2f2; opacity: 1;
    }
    /* 有轉發按鈕的泡泡需要更多右側留白 */
    .loe-has-forward.${TEXT_PAD_CLASS} { padding-right: 56px !important; }

    /* 自訂 tooltip（轉發 / 複製）— 按鈕本身已是 position:absolute */
    [data-loe-tip]::after {
      content: attr(data-loe-tip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.92);
      color: #fff;
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
      padding: 4px 7px;
      border-radius: 5px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity .12s ease;
      z-index: 2147483647;
    }
    [data-loe-tip]:hover::after { opacity: 1; }

    /* 前綴設定 chip（頂部帳號名稱旁） */
    .${PREFIX_CHIP_CLASS} {
      display: inline-flex; align-items: center; gap: 5px;
      margin-left: 8px;
      height: 28px;
      padding: 0 10px;
      border: 1px solid rgba(28,108,243,.35);
      border-radius: 999px;
      background: ${BLUE_SOFT};
      color: ${BLUE_HOVER};
      font-size: 12px; font-weight: 600;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      max-width: 220px;
    }
    .${PREFIX_CHIP_CLASS}:hover { border-color: ${BLUE}; background: #e0ecff; }
    .${PREFIX_CHIP_CLASS} .loe-prefix-text { overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
    .${PREFIX_CHIP_CLASS}.loe-prefix-empty { color: ${BLUE}; background: #fff; }
    .${PREFIX_CHIP_CLASS} > svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }

    /* 一鍵匯入所有設定按鈕 */
    .loe-import-btn {
      display: inline-flex; align-items: center; gap: 5px;
      margin-left: 6px; height: 28px; padding: 0 12px;
      border: 1px solid rgba(28,108,243,.35); border-radius: 999px;
      background: #fff; color: ${BLUE};
      font-size: 12px; font-weight: 600; line-height: 1;
      cursor: pointer; white-space: nowrap;
    }
    .loe-import-btn:hover { background: ${BLUE_SOFT}; border-color: ${BLUE}; color: ${BLUE_HOVER}; }
    .loe-import-btn > svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }

    /* 前綴設定彈出框 */
    .loe-prefix-pop {
      position: fixed; z-index: 2147483647;
      width: 280px; padding: 12px;
      background: #fff; border: 1px solid rgba(15,23,42,.12);
      border-radius: 12px; box-shadow: 0 14px 40px rgba(15,23,42,.22);
      font-size: 13px; color: #1f2937;
    }
    .loe-prefix-pop .loe-pop-title { font-weight: 700; margin-bottom: 8px; font-size: 13px; }
    .loe-prefix-pop .loe-pop-hint { color: #94a3b8; font-size: 11px; margin-bottom: 8px; line-height: 1.4; }
    .loe-prefix-pop input {
      width: 100%; box-sizing: border-box; border: 1px solid rgba(15,23,42,.18);
      border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; margin-bottom: 10px;
    }
    .loe-prefix-pop input:focus { outline: none; border-color: ${BLUE}; box-shadow: 0 0 0 3px rgba(28,108,243,.12); }
    .loe-prefix-pop .loe-pop-actions { display: flex; gap: 8px; justify-content: flex-end; }

    /* Toast */
    .loe-toast {
      position: fixed; left: 50%; bottom: 90px; transform: translateX(-50%);
      z-index: 2147483647;
      background: rgba(15,23,42,.92); color: #fff;
      padding: 10px 16px; border-radius: 10px; font-size: 13px;
      box-shadow: 0 10px 30px rgba(15,23,42,.3);
      max-width: 80vw; white-space: pre-wrap; text-align: center;
      opacity: 0; transition: opacity .18s ease;
    }
    .loe-toast.show { opacity: 1; }

    /* 派單按鈕（傳送左邊，藍色） */
    .${DISPATCH_BUTTON_CLASS} {
      position: relative;
      top: 4px;                 /* 與「傳送」按鈕靠下對齊 */
      display: inline-flex; align-items: center; justify-content: center; gap: 5px;
      height: 32px; margin-right: 8px; padding: 0 14px;
      border: 0; border-radius: 6px;
      background: ${BLUE}; color: #fff;
      font: inherit; font-size: 13px; font-weight: 700; line-height: 1;
      cursor: pointer; white-space: nowrap;
    }
    .${DISPATCH_BUTTON_CLASS}:hover { background: ${BLUE_HOVER}; }
    .${DISPATCH_BUTTON_CLASS} > svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* 估價按鈕（派單左邊，藍色外框） */
    .${ESTIMATE_BUTTON_CLASS} {
      position: relative;
      top: 4px;                 /* 與「傳送」靠下對齊 */
      display: inline-flex; align-items: center; justify-content: center; gap: 5px;
      height: 32px; margin-right: 8px; padding: 0 12px;
      border: 1px solid ${BLUE}; border-radius: 6px;
      background: #fff; color: ${BLUE};
      font: inherit; font-size: 13px; font-weight: 700; line-height: 1;
      cursor: pointer; white-space: nowrap;
    }
    .${ESTIMATE_BUTTON_CLASS}:hover { background: ${BLUE_SOFT}; color: ${BLUE_HOVER}; border-color: ${BLUE_HOVER}; }
    .${ESTIMATE_BUTTON_CLASS} > svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* 派單彈出視窗（精簡版，限制高度避免超出畫面） */
    .${DISPATCH_POP_CLASS} {
      position: fixed; z-index: 2147483647;
      width: 300px; padding: 12px;
      background: #fff; border: 1px solid rgba(15,23,42,.12);
      border-radius: 12px; box-shadow: 0 16px 44px rgba(15,23,42,.24);
      font-size: 13px; color: #1f2937;
      overflow-y: auto;
    }
    .${DISPATCH_POP_CLASS} { position: fixed; } /* 確保 X 以此為定位基準 */
    .${DISPATCH_POP_CLASS} .loe-pop-title { font-weight: 700; font-size: 14px; margin-bottom: 6px; padding-right: 22px; }
    .${DISPATCH_POP_CLASS} .loe-pop-close {
      position: absolute; top: 8px; right: 10px;
      border: 0; background: transparent; cursor: pointer;
      font-size: 20px; line-height: 1; color: #94a3b8; padding: 2px 6px; border-radius: 6px;
    }
    .${DISPATCH_POP_CLASS} .loe-pop-close:hover { background: #f1f5f9; color: #1f2937; }
    .${DISPATCH_POP_CLASS} .loe-prefix-badge {
      display: inline-flex; align-items: center; gap: 5px;
      margin-bottom: 6px; padding: 2px 8px; border-radius: 999px;
      background: ${BLUE_SOFT}; color: ${BLUE_HOVER}; font-size: 11px; font-weight: 600;
    }
    .${DISPATCH_POP_CLASS} label.loe-fld { display: block; font-size: 11px; color: #475569; margin: 6px 0 2px; }
    .${DISPATCH_POP_CLASS} input:not([type=checkbox]), .${DISPATCH_POP_CLASS} textarea {
      width: 100%; box-sizing: border-box; border: 1px solid rgba(15,23,42,.18);
      border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13px;
    }
    .${DISPATCH_POP_CLASS} textarea { resize: vertical; min-height: 34px; }
    .${DISPATCH_POP_CLASS} input:focus, .${DISPATCH_POP_CLASS} textarea:focus { outline: none; border-color: ${BLUE}; box-shadow: 0 0 0 3px rgba(28,108,243,.12); }
    .${DISPATCH_POP_CLASS} .loe-check { display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; font-size: 12px; color: #334155; cursor: pointer; line-height: 1.35; }
    .${DISPATCH_POP_CLASS} .loe-check input { width: 16px; height: 16px; margin: 1px 0 0; flex-shrink: 0; }
    .${DISPATCH_POP_CLASS} .loe-preview { margin: 8px 0 2px; padding: 7px 10px; background: #f8fafc; border-radius: 8px; color: #334155; font-size: 12px; white-space: pre-wrap; word-break: break-all; min-height: 16px; }
    .${DISPATCH_POP_CLASS} .loe-pop-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .${DISPATCH_POP_CLASS} .loe-check { align-items: center; }
    .loe-tpl-select { flex: 1; min-width: 0; border: 1px solid rgba(15,23,42,.18); border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12px; background: #fff; color: #1f2937; cursor: pointer; }
    .loe-tpl-select:focus { outline: none; border-color: ${BLUE}; }
  `;
  document.head.appendChild(style);

  /* ---------------------------------------------------------------------- *
   * Storage (GM with localStorage fallback)
   * ---------------------------------------------------------------------- */
  function storeGet(key, def) {
    try {
      if (typeof GM_getValue === "function") {
        const v = GM_getValue(key);
        if (v != null) return typeof v === "string" ? JSON.parse(v) : v;
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch (_) {}
    return def;
  }
  function storeSet(key, val) {
    try {
      if (typeof GM_setValue === "function")
        GM_setValue(key, JSON.stringify(val));
    } catch (_) {}
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }
  function getReplies() {
    const v = storeGet(STORE_KEY, null);
    return Array.isArray(v) ? v : []; // 不再內建預設樣板，一律由後端（依帳號）帶入
  }
  function setReplies(arr) {
    storeSet(STORE_KEY, arr);
    refreshAllQuickMenus();
    renderQuickBar();
  }
  /* ---- 每個官方帳號(OA)獨立：前綴 + webhook 以 OA id 分開儲存 ---- */
  function getOaId() {
    const parts = location.pathname.split("/").filter(Boolean);
    // chat.line.biz/{oaId}/chat/...  ；找出符合 OA id 樣式的片段
    const m = parts.find((p) => /^U[0-9a-fA-F]{20,}$/.test(p) || /^@/.test(p));
    if (m) return m;
    // manager.line.biz：/.../account/{oaId}/...
    const ai = parts.indexOf("account");
    if (ai >= 0 && parts[ai + 1]) return parts[ai + 1];
    return parts[0] || "default";
  }
  function getOaName() {
    const dd = document.querySelector("header .dropdown.btn-group");
    return dd ? dd.textContent.trim() : "";
  }
  // 目前對話的客戶名稱（頂部標題），完整帶入。
  // LINE 把 emoji 以 <img alt="🍿"> 呈現，這裡用 alt 還原，得到「🍿Z3721/版主 允🐱」這種完整名稱。
  function getCustomerName() {
    const h = document.querySelector(".sub-header h4");
    if (!h) return "";
    let name = "";
    (function walk(node) {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) name += n.nodeValue;
        else if (n.tagName === "IMG") name += n.getAttribute("alt") || "";
        else if (n.childNodes && n.childNodes.length) walk(n);
        else name += n.textContent || "";
      });
    })(h);
    return name.trim();
  }
  function getChatId() {
    const parts = location.pathname.split("/").filter(Boolean);
    const ci = parts.indexOf("chat");
    return ci >= 0 && parts[ci + 1] ? parts[ci + 1] : "";
  }
  function scopedKey(base) {
    return `${base}::${getOaId()}`;
  }
  // 設定指定 OA 帳號(gid)的前綴（給「一鍵匯入」用，可寫入非目前帳號）
  function setPrefixForGid(gid, text) {
    storeSet(`${PREFIX_KEY}::${gid}`, text || "");
  }
  // chat 層級覆寫：key = gid/chat -> { group, pickup }
  function getChatOverrides() {
    const v = storeGet(CHAT_OVERRIDE_KEY, null);
    return v && typeof v === "object" ? v : {};
  }
  function setChatOverrides(map) {
    storeSet(CHAT_OVERRIDE_KEY, map || {});
  }
  function getCurrentOverride() {
    const gid = getOaId();
    const chat = getChatId();
    if (!chat) return null;
    return getChatOverrides()[`${gid}/${chat}`] || null;
  }
  // 套用一份車隊雲端設定（後端 /line-ext-config 回應）到本地：
  //   - official(無 chatId)：設該 OA 的群編前綴
  //   - store(有 chatId)：該對話固定群編＋上車地址
  //   - 一併套用 Discord webhook（每車隊一個）
  // 設定來源已從硬編碼 CONFIG 改為後端 DB（admin「懶惰蟲配置」頁維護）。
  function applyFleetConfig(data) {
    const entries = (data && data.entries) || [];
    const overrides = {};
    let gidCount = 0,
      chatCount = 0;
    entries.forEach((e) => {
      if (!e.groupId) return;
      if (e.chatId) {
        overrides[`${e.groupId}/${e.chatId}`] = {
          group: e.group || "",
          pickup: e.pickup || "",
        };
        chatCount++;
      } else {
        setPrefixForGid(e.groupId, e.group || "");
        gidCount++;
      }
    });
    setChatOverrides(overrides);
    if (data && typeof data.discordWebhook === "string" && data.discordWebhook) {
      setWebhook(data.discordWebhook);
    }
    renderPrefixChip();
    return { gidCount, chatCount };
  }
  async function fetchFleetConfig(fleet) {
    if (!fleet) return null;
    try {
      return await httpGetJson(
        `${API_BASE}/line-ext-config?fleet=${encodeURIComponent(fleet)}`,
      );
    } catch (_) {
      return null;
    }
  }
  // 一鍵匯入：向後端拉目前車隊的設定並套用（取代舊的硬編碼 CONFIG）
  async function applyConfig() {
    const fleet = getFleet();
    if (!fleet) {
      toast("請先在設定面板填寫車隊（如 HELLO）");
      return { gidCount: 0, chatCount: 0 };
    }
    const data = await fetchFleetConfig(fleet);
    if (!data) {
      toast("讀取雲端設定失敗，請稍後再試");
      return { gidCount: 0, chatCount: 0 };
    }
    return applyFleetConfig(data);
  }
  // 取值：先讀此帳號專屬的 key；若沒有、但有舊的全域設定，搬移過來(一次性)
  function getScoped(base) {
    const k = scopedKey(base);
    let v = storeGet(k, null);
    if (v == null) {
      const legacy = storeGet(base, null); // 舊版全域設定
      if (legacy != null && legacy !== "") {
        storeSet(k, legacy);
        v = legacy;
      }
    }
    return typeof v === "string" ? v : "";
  }
  function getPrefix() {
    return getScoped(PREFIX_KEY);
  }
  function setPrefix(text) {
    storeSet(scopedKey(PREFIX_KEY), text || "");
    renderPrefixChip();
  }
  // Webhook 與後台帳號為「全域共用」：設定一次，所有帳號／頁面共用。
  // 讀取時：先讀全域；若全域空、但舊版有存成「此帳號專屬」，自動搬到全域(一次性)。
  function getGlobalWithMigration(base) {
    let v = storeGet(base, "");
    if (!v) {
      const sc = storeGet(scopedKey(base), "");
      if (sc) {
        storeSet(base, sc);
        v = sc;
      }
    }
    return typeof v === "string" ? v : "";
  }
  function getWebhook() {
    return getGlobalWithMigration(WEBHOOK_KEY);
  }
  function setWebhook(url) {
    storeSet(WEBHOOK_KEY, (url || "").trim());
  }
  function getDispatcher() {
    return (getGlobalWithMigration(DISPATCHER_KEY) || "").trim();
  }
  function setDispatcher(name) {
    storeSet(DISPATCHER_KEY, (name || "").trim());
  }
  // 車隊（全域共用）：決定要向後端拉哪個車隊的懶惰蟲設定（webhook + 官方/店配）
  function getFleet() {
    return (getGlobalWithMigration(FLEET_KEY) || "").trim();
  }
  function setFleet(name) {
    // 不分大小寫：後端 /line-ext-config 解析車隊時已 ToUpper，這裡原樣保存即可（hello / HELLO 皆可）
    storeSet(FLEET_KEY, (name || "").trim());
  }
  function getAutoReply() {
    return storeGet(AUTOREPLY_KEY, false) === true;
  }
  function setAutoReply(on) {
    storeSet(AUTOREPLY_KEY, !!on);
  }
  function getMemoInclude() {
    return storeGet(MEMO_INCLUDE_KEY, true) !== false; // 預設帶入
  }
  function setMemoInclude(on) {
    storeSet(MEMO_INCLUDE_KEY, !!on);
  }
  function getDispatchTemplate() {
    const v = storeGet(DISPATCH_TEMPLATE_KEY, "");
    return typeof v === "string" ? v : "";
  }
  function setDispatchTemplate(name) {
    storeSet(DISPATCH_TEMPLATE_KEY, name || "");
  }
  function getMarkFollowUp() {
    return storeGet(MARK_FOLLOWUP_KEY, true) !== false; // 預設標記
  }
  function setMarkFollowUp(on) {
    storeSet(MARK_FOLLOWUP_KEY, !!on);
  }
  function getLineUrlInclude() {
    return storeGet(LINEURL_INCLUDE_KEY, true) !== false; // 預設附上
  }
  function setLineUrlInclude(on) {
    storeSet(LINEURL_INCLUDE_KEY, !!on);
  }

  /* ---------------------------------------------------------------------- *
   * Toast
   * ---------------------------------------------------------------------- */
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "loe-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 250);
    }, 2200);
  }

  /* ---------------------------------------------------------------------- *
   * Copy
   * ---------------------------------------------------------------------- */
  function getMessageText(chatBody) {
    const node =
      chatBody.querySelector("[data-copy-target].chat-item-text") ||
      chatBody.querySelector(".chat-item-text");
    return node ? node.innerText.trim() : "";
  }
  async function copyText(text) {
    if (!text) return false;
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text, "text");
      return true;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
  function flashCopied(button, ok) {
    button.innerHTML = ok ? CHECK_ICON : ERROR_ICON;
    button.classList.toggle(COPIED_CLASS, ok);
    paintIcons();
    window.setTimeout(() => {
      button.innerHTML = COPY_ICON;
      button.classList.remove(COPIED_CLASS);
      paintIcons();
    }, 1000);
  }
  // 只閃一下成功/失敗顏色，不更換 icon（給轉發按鈕用，維持「轉發」樣式）
  function flashState(button, ok) {
    button.classList.toggle(COPIED_CLASS, ok);
    button.classList.toggle("loe-err", !ok);
    window.setTimeout(() => {
      button.classList.remove(COPIED_CLASS, "loe-err");
    }, 1000);
  }

  /* ---------------------------------------------------------------------- *
   * Address -> Google Maps (clone-based, survives framework re-render)
   * ---------------------------------------------------------------------- */
  function createMapLink(address) {
    const link = document.createElement("a");
    link.className = MAP_LINK_CLASS;
    link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = address;
    link.title = "在 Google Maps 開啟導航";
    link.addEventListener("click", (e) => e.stopPropagation());
    return link;
  }
  function linkifyAddresses(container) {
    if (!container) return;
    if (container.querySelector(`a.${MAP_LINK_CLASS}`)) return;
    ADDRESS_PATTERN.lastIndex = 0;
    if (!ADDRESS_PATTERN.test(container.textContent || "")) return;

    // 就地替換：只動「含地址的那一個文字節點」，不清空／重建整個容器，
    // 避免容器內容瞬間被掏空造成瀏覽器失去捲動定位、把對話頂上去。
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (
          p.closest(
            `a, button, script, style, textarea, input, .${MAP_LINK_CLASS}`,
          )
        )
          return NodeFilter.FILTER_REJECT;
        ADDRESS_PATTERN.lastIndex = 0;
        return ADDRESS_PATTERN.test(node.nodeValue || "")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      ADDRESS_PATTERN.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0,
        m;
      while ((m = ADDRESS_PATTERN.exec(text)) !== null) {
        if (m.index > last)
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(createMapLink(m[0]));
        last = m.index + m[0].length;
      }
      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)));
      // Vue 可能已把節點換掉；用 contains 確認仍是子節點，再包 try 保證絕不丟錯中斷後續處理。
      const p = textNode.parentNode;
      if (p && p.contains(textNode)) {
        try {
          p.replaceChild(frag, textNode);
        } catch (_) {}
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * Reply input (custom <textarea-ex> with shadow DOM)
   * ---------------------------------------------------------------------- */
  function getEditorHost() {
    return (
      document.querySelector("textarea-ex#editor") ||
      document.querySelector("textarea-ex")
    );
  }
  function fillReplyTextarea(text, replace = false) {
    const host = getEditorHost();
    const inner =
      host && host.shadowRoot && host.shadowRoot.querySelector("textarea");
    if (inner) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set;
      let next, pos;
      if (replace) {
        next = text;
        pos = text.length;
      } else {
        const start = inner.selectionStart ?? inner.value.length;
        const end = inner.selectionEnd ?? inner.value.length;
        next = inner.value.slice(0, start) + text + inner.value.slice(end);
        pos = start + text.length;
      }
      setter.call(inner, next);
      inner.dispatchEvent(
        new Event("input", { bubbles: true, composed: true }),
      );
      inner.dispatchEvent(
        new Event("change", { bubbles: true, composed: true }),
      );
      inner.focus();
      try {
        inner.setSelectionRange(pos, pos);
      } catch (_) {}
      return true;
    }
    // Fallback: plain textarea
    const ta =
      document.querySelector('textarea[part="input"].input') ||
      document.querySelector('textarea[part="input"]') ||
      document.querySelector("textarea.input") ||
      document.querySelector("textarea");
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set;
    const next = replace ? text : ta.value + text;
    setter ? setter.call(ta, next) : (ta.value = next);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.focus();
    return true;
  }

  /* ---------------------------------------------------------------------- *
   * Quick reply menu
   * ---------------------------------------------------------------------- */
  function closeQuickReplyMenus(except) {
    document
      .querySelectorAll(`.${QUICK_BUTTON_CLASS}.${QUICK_MENU_OPEN_CLASS}`)
      .forEach((b) => {
        if (b !== except) {
          b.classList.remove(QUICK_MENU_OPEN_CLASS);
          b.setAttribute("aria-expanded", "false");
        }
      });
  }
  function populateQuickMenu(menu) {
    menu.textContent = "";
    // 選單只保留「管理 / 新增快速回覆」一項（快速回覆清單已顯示在輸入框上方的氣泡列）
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "loe-qr-manage";
    manage.textContent = "管理 / 新增快速回覆";
    manage.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeQuickReplyMenus();
      openManager();
    });
    menu.appendChild(manage);
  }
  function refreshAllQuickMenus() {
    document
      .querySelectorAll(`.${QUICK_MENU_CLASS}`)
      .forEach(populateQuickMenu);
  }
  // 輸入框上方的快捷氣泡列（最多前 5 個；點了帶入對話框）
  function renderQuickBar(bar) {
    bar = bar || document.querySelector(`.${QR_BAR_CLASS}`);
    if (!bar) return;
    bar.textContent = "";
    const reps = getReplies(); // 全部顯示（氣泡列可水平滑動）
    reps.forEach((r) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = QR_CHIP_CLASS;
      chip.textContent = r.name || r.text;
      chip.title = r.text;
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillReplyTextarea(r.text);
      });
      bar.appendChild(chip);
    });
  }
  function ensureQuickBar() {
    const host = getEditorHost();
    if (!host) return;
    const editorArea = host.closest(".editor-area");
    const col = editorArea ? editorArea.parentElement : null;
    if (!col) return;
    let bar = col.querySelector(`:scope > .${QR_BAR_CLASS}`);
    if (bar) return; // 已存在就不要重建（避免每次 observer 觸發都重繪造成忙迴圈）
    bar = document.createElement("div");
    bar.className = QR_BAR_CLASS;
    col.insertBefore(bar, col.firstChild);
    renderQuickBar(bar);
  }
  function addQuickReplyButton(phoneLink) {
    if (
      !phoneLink ||
      phoneLink.parentElement.querySelector(`.${QUICK_BUTTON_CLASS}`)
    )
      return;
    const button = document.createElement("a");
    button.href = "#";
    button.role = "button";
    button.className = `mr-2 ${QUICK_BUTTON_CLASS}`;
    button.setAttribute("aria-label", "快速回覆");
    button.setAttribute("aria-expanded", "false");
    button.title = "快速回覆";
    // 內嵌 SVG icon，與通話邀請 (la-chat-phone) icon 對齊
    button.insertAdjacentHTML("beforeend", QUICK_ICON);
    const menu = document.createElement("div");
    menu.className = QUICK_MENU_CLASS;
    menu.setAttribute("role", "menu");
    menu.addEventListener("click", (e) => e.stopPropagation());
    populateQuickMenu(menu);
    button.appendChild(menu);
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !button.classList.contains(QUICK_MENU_OPEN_CLASS);
      closeQuickReplyMenus(button);
      if (willOpen) populateQuickMenu(menu);
      button.classList.toggle(QUICK_MENU_OPEN_CLASS, willOpen);
      button.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
    phoneLink.insertAdjacentElement("afterend", button);
  }
  function enhanceQuickReplyToolbars(root = document) {
    root.querySelectorAll("i.lar.la-chat-phone.la-fw.la-lg").forEach((icon) => {
      addQuickReplyButton(icon.closest("a"));
    });
  }

  /* ---------------------------------------------------------------------- *
   * Manager modal (add / edit / delete)
   * ---------------------------------------------------------------------- */
  function openManager() {
    closeManager();
    let editIndex = -1;

    const mask = document.createElement("div");
    mask.className = "loe-modal-mask";
    mask.addEventListener("click", (e) => {
      if (e.target === mask) closeManager();
    });

    const modal = document.createElement("div");
    modal.className = "loe-modal";

    const head = document.createElement("div");
    head.className = "loe-modal-head";
    head.innerHTML = `<span>快速回覆管理</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "loe-modal-close";
    closeBtn.textContent = "×";
    closeBtn.title = "關閉";
    closeBtn.addEventListener("click", closeManager);
    head.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "loe-modal-body";

    const list = document.createElement("div");
    list.className = "loe-list";

    const form = document.createElement("div");
    form.className = "loe-form";
    const formTitle = document.createElement("div");
    formTitle.className = "loe-form-title";
    formTitle.textContent = "新增快速回覆";
    const nameInput = document.createElement("input");
    nameInput.className = "loe-input";
    nameInput.placeholder = "名稱（選單顯示用，例如：車來了）";
    const textInput = document.createElement("textarea");
    textInput.className = "loe-textarea";
    textInput.placeholder = "貼上的內容文字";
    const actions = document.createElement("div");
    actions.className = "loe-form-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "loe-btn-primary";
    saveBtn.textContent = "新增";
    const cancelEditBtn = document.createElement("button");
    cancelEditBtn.className = "loe-btn-ghost";
    cancelEditBtn.textContent = "取消編輯";
    cancelEditBtn.style.display = "none";
    actions.appendChild(saveBtn);
    actions.appendChild(cancelEditBtn);
    form.appendChild(formTitle);
    form.appendChild(nameInput);
    form.appendChild(textInput);
    form.appendChild(actions);

    function resetForm() {
      editIndex = -1;
      nameInput.value = "";
      textInput.value = "";
      formTitle.textContent = "新增快速回覆";
      saveBtn.textContent = "新增";
      cancelEditBtn.style.display = "none";
    }
    cancelEditBtn.addEventListener("click", resetForm);

    function renderList() {
      const replies = getReplies();
      list.textContent = "";
      if (!replies.length) {
        const empty = document.createElement("div");
        empty.className = "loe-qr-empty";
        empty.textContent = "尚無項目";
        list.appendChild(empty);
        return;
      }
      replies.forEach((r, i) => {
        const row = document.createElement("div");
        row.className = "loe-row";
        const info = document.createElement("div");
        info.className = "loe-row-info";
        const nm = document.createElement("div");
        nm.className = "loe-row-name";
        nm.textContent = r.name || "(未命名)";
        const tx = document.createElement("div");
        tx.className = "loe-row-text";
        tx.textContent = r.text;
        info.appendChild(nm);
        info.appendChild(tx);
        const act = document.createElement("div");
        act.className = "loe-row-actions";
        const up = document.createElement("button");
        up.className = "loe-mini";
        up.textContent = "↑";
        up.title = "上移";
        up.disabled = i === 0;
        up.addEventListener("click", () => {
          const arr = getReplies();
          if (i > 0) {
            [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
            setReplies(arr);
            renderList();
          }
        });
        const down = document.createElement("button");
        down.className = "loe-mini";
        down.textContent = "↓";
        down.title = "下移";
        down.disabled = i === replies.length - 1;
        down.addEventListener("click", () => {
          const arr = getReplies();
          if (i < arr.length - 1) {
            [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
            setReplies(arr);
            renderList();
          }
        });
        const ed = document.createElement("button");
        ed.className = "loe-mini";
        ed.textContent = "編輯";
        ed.addEventListener("click", () => {
          editIndex = i;
          nameInput.value = r.name || "";
          textInput.value = r.text || "";
          formTitle.textContent = "編輯快速回覆";
          saveBtn.textContent = "更新";
          cancelEditBtn.style.display = "";
          nameInput.focus();
        });
        const del = document.createElement("button");
        del.className = "loe-mini danger";
        del.textContent = "刪除";
        del.addEventListener("click", () => {
          const arr = getReplies();
          arr.splice(i, 1);
          setReplies(arr);
          if (editIndex === i) resetForm();
          renderList();
        });
        act.appendChild(up);
        act.appendChild(down);
        act.appendChild(ed);
        act.appendChild(del);
        row.appendChild(info);
        row.appendChild(act);
        list.appendChild(row);
      });
    }

    saveBtn.addEventListener("click", () => {
      const text = textInput.value.trim();
      if (!text) {
        textInput.focus();
        return;
      }
      const name = nameInput.value.trim() || text.slice(0, 12);
      const arr = getReplies();
      if (editIndex >= 0 && editIndex < arr.length) {
        arr[editIndex] = { name, text };
      } else {
        arr.push({ name, text });
      }
      setReplies(arr);
      resetForm();
      renderList();
    });

    const listHint = document.createElement("div");
    listHint.className = "loe-qr-empty";
    listHint.style.cssText = "text-align:left;padding:0 0 8px;color:#94a3b8;";
    listHint.textContent =
      "用 ↑ ↓ 調整順序；對話框上方會顯示全部（可左右滑動）。";
    body.appendChild(listHint);
    body.appendChild(list);
    body.appendChild(form);
    modal.appendChild(head);
    modal.appendChild(body);
    mask.appendChild(modal);
    document.body.appendChild(mask);
    renderList();
    nameInput.focus();

    mask._loeEsc = (e) => {
      if (e.key === "Escape") closeManager();
    };
    document.addEventListener("keydown", mask._loeEsc);
    openManager._mask = mask;
  }
  function closeManager() {
    const mask = openManager._mask;
    if (mask) {
      if (mask._loeEsc) document.removeEventListener("keydown", mask._loeEsc);
      mask.remove();
      openManager._mask = null;
    }
  }

  /* ---------------------------------------------------------------------- *
   * Forward (轉發) — 地址訊息專用
   * ---------------------------------------------------------------------- *
   * 目前動作為「組好『前綴 + 地址』並複製到剪貼簿 + 顯示提示」。
   * 之後要改成送到 Discord 等服務時，只要改寫 sendForward() 即可。
   */
  // 送到 Discord webhook（用 GM_xmlhttpRequest 以避開 CORS）；沒設定則複製到剪貼簿
  function postToDiscord(url, content) {
    // 帶上派單人員 → 顯示為該則訊息的發送者（webhook username 覆寫，後端不需改動）
    const body = { content };
    const who = getDispatcher();
    if (who) body.username = who;
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest({
          method: "POST",
          url,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify(body),
          onload: (res) =>
            res.status >= 200 && res.status < 300
              ? resolve()
              : reject(new Error("HTTP " + res.status)),
          onerror: () => reject(new Error("network")),
          ontimeout: () => reject(new Error("timeout")),
        });
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then((r) =>
            r.ok ? resolve() : reject(new Error("HTTP " + r.status)),
          )
          .catch(reject);
      }
    });
  }
  async function sendForward(payload) {
    const url = getWebhook();
    if (url) {
      await postToDiscord(url, payload);
      return "discord";
    }
    await copyText(payload);
    return "clipboard";
  }
  function buildForwardPayload(addresses) {
    const prefix = getPrefix();
    // 每個地址都加上前綴，格式直接相接，例如：W0/潭富路二段176號
    return addresses.map((a) => `${prefix}${a}`).join("\n");
  }
  function addForwardButton(bubble, textNode) {
    if (bubble.querySelector(`.${FORWARD_BUTTON_CLASS}`)) return;
    // 不論是否地址類型，所有文字訊息都加上「轉發」
    textNode.classList.add("loe-has-forward");
    const fwd = document.createElement("button");
    fwd.type = "button";
    fwd.className = FORWARD_BUTTON_CLASS;
    fwd.innerHTML = FORWARD_ICON;
    fwd.setAttribute("aria-label", "轉發到派單");
    fwd.setAttribute("data-loe-tip", "轉發");
    fwd.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 轉發＝開啟「派單」視窗，把這則訊息內容帶入「上車地址」；送出派單才會呼叫 Discord
      openDispatchPopover(textNode.innerText.trim());
    });
    bubble.appendChild(fwd);
    paintIcons();
  }

  /* ---------------------------------------------------------------------- *
   * Per-message copy button + address linkify
   * ---------------------------------------------------------------------- */
  function addCopyButton(chatBody) {
    const bubble = chatBody.querySelector(".chat-item");
    const textNode =
      chatBody.querySelector("[data-copy-target].chat-item-text") ||
      chatBody.querySelector(".chat-item-text");
    if (!bubble || !textNode) return;
    linkifyAddresses(textNode);
    addForwardButton(bubble, textNode);
    if (chatBody.querySelector(`.${BUTTON_CLASS}`)) return;
    bubble.classList.add(BUBBLE_CLASS);
    textNode.classList.add(TEXT_PAD_CLASS); // 預留右側空間，固定顯示的按鈕不會蓋到文字
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.innerHTML = COPY_ICON;
    button.setAttribute("aria-label", "複製這則訊息");
    button.setAttribute("data-loe-tip", "複製");
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const ok = await copyText(getMessageText(chatBody));
        flashCopied(button, ok);
      } catch (_) {
        flashCopied(button, false);
      }
    });
    bubble.appendChild(button);
  }
  function enhanceChatBodies(root = document) {
    root.querySelectorAll(".chat-body").forEach(addCopyButton);
  }

  /* ---------------------------------------------------------------------- *
   * Prefix setting (頂部帳號名稱旁，一組，對應目前 OA 帳號)
   * ---------------------------------------------------------------------- */
  const GEAR_ICON = ic("settings");

  function renderPrefixChip() {
    const chip = document.querySelector(`.${PREFIX_CHIP_CLASS}`);
    if (!chip) return;
    const prefix = getPrefix();
    chip.classList.toggle("loe-prefix-empty", !prefix);
    chip.textContent = "";
    chip.insertAdjacentHTML("beforeend", GEAR_ICON);
    const span = document.createElement("span");
    span.className = "loe-prefix-text";
    span.textContent = prefix ? prefix : "設定前綴";
    chip.appendChild(span);
    chip.title = prefix ? `目前前綴：${prefix}（點擊編輯）` : "設定轉發前綴";
    paintIcons();
  }
  function openPrefixPopover(anchor) {
    closePrefixPopover();
    const pop = document.createElement("div");
    pop.className = "loe-prefix-pop";
    const title = document.createElement("div");
    title.className = "loe-pop-title";
    title.textContent = "轉發設定";

    // 顯示目前綁定的官方帳號（每個帳號各自獨立）
    const acct = document.createElement("div");
    acct.style.cssText =
      "display:inline-flex;align-items:center;margin-bottom:8px;padding:3px 9px;border-radius:999px;background:#eef4ff;color:#0b57d0;font-size:12px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    acct.textContent = `此帳號：${getOaName() || getOaId()}`;

    // 前綴
    const hint = document.createElement("div");
    hint.className = "loe-pop-hint";
    hint.innerHTML =
      "群編前綴（不用加斜線，派單時會自動補上）。例如填「W0」。（僅套用於此帳號）";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "例如：W0";
    input.value = getPrefix();

    // 後台帳號（Email）— 全部帳號共用，顯示為這張單在 Discord 的發送者
    const whoHint = document.createElement("div");
    whoHint.className = "loe-pop-hint";
    whoHint.style.marginTop = "4px";
    whoHint.textContent = "後台帳號（Email，全部帳號共用，設定一次即可）：";
    const whoInput = document.createElement("input");
    whoInput.type = "email";
    whoInput.placeholder = "例如：dispatcher@uturn.com";
    whoInput.value = getDispatcher();

    // 車隊 — 設定後台帳號後，依此向後端拉該車隊的 Webhook 與官方/店配設定
    const fleetHint = document.createElement("div");
    fleetHint.className = "loe-pop-hint";
    fleetHint.style.marginTop = "4px";
    fleetHint.textContent = "車隊（設定帳號後自動套用該車隊的雲端設定，如 HELLO）：";
    const fleetInput = document.createElement("input");
    fleetInput.type = "text";
    fleetInput.placeholder = "例如：HELLO";
    fleetInput.value = getFleet();

    const actions = document.createElement("div");
    actions.className = "loe-pop-actions";
    const clearBtn = document.createElement("button");
    clearBtn.className = "loe-btn-ghost";
    clearBtn.textContent = "清除";
    clearBtn.addEventListener("click", () => {
      setPrefix("");
      setDispatcher("");
      setFleet("");
      closePrefixPopover();
      toast("已清除前綴、後台帳號與車隊");
    });
    const saveBtn = document.createElement("button");
    saveBtn.className = "loe-btn-primary";
    saveBtn.textContent = "儲存";
    saveBtn.addEventListener("click", () => {
      const acct = whoInput.value.trim();
      if (acct && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acct)) {
        whoInput.focus();
        toast("後台帳號請輸入正確的 Email 格式");
        return;
      }
      setPrefix(input.value.trim());
      setDispatcher(acct);
      setFleet(fleetInput.value.trim());
      closePrefixPopover();
      toast(
        "已儲存設定" +
          (input.value.trim() ? "（前綴：" + input.value.trim() + "）" : ""),
      );
      // 設定後台帳號後才驅動：拉該帳號的快速回覆與該車隊的 Webhook/設定
      syncRemoteConfig();
    });
    actions.appendChild(clearBtn);
    actions.appendChild(saveBtn);

    pop.appendChild(title);
    pop.appendChild(acct);
    pop.appendChild(hint);
    pop.appendChild(input);
    pop.appendChild(whoHint);
    pop.appendChild(whoInput);
    pop.appendChild(fleetHint);
    pop.appendChild(fleetInput);
    pop.appendChild(actions);
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 8) + "px";
    pop.style.left =
      Math.round(Math.min(r.left, window.innerWidth - 296)) + "px";
    input.focus();
    const onKey = (e) => {
      if (e.key === "Enter") saveBtn.click();
      if (e.key === "Escape") closePrefixPopover();
    };
    input.addEventListener("keydown", onKey);
    whoInput.addEventListener("keydown", onKey);
    fleetInput.addEventListener("keydown", onKey);
    pop.addEventListener("click", (e) => e.stopPropagation());
    openPrefixPopover._pop = pop;
  }
  function closePrefixPopover() {
    if (openPrefixPopover._pop) {
      openPrefixPopover._pop.remove();
      openPrefixPopover._pop = null;
    }
  }
  function enhancePrefixChip() {
    const header = document.querySelector("header");
    if (!header) return;
    if (header.querySelector(`.${PREFIX_CHIP_CLASS}`)) return;
    const dd = header.querySelector(".dropdown.btn-group");
    if (!dd) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = PREFIX_CHIP_CLASS;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openPrefixPopover._pop) closePrefixPopover();
      else openPrefixPopover(chip);
    });
    dd.insertAdjacentElement("afterend", chip);

    // 一鍵匯入所有設定（向後端拉目前車隊的設定並套用）
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "loe-import-btn";
    importBtn.insertAdjacentHTML("beforeend", ic("download"));
    const importLabel = document.createElement("span");
    importLabel.textContent = "一鍵匯入所有設定";
    importBtn.appendChild(importLabel);
    importBtn.title = "向後端拉目前車隊（設定面板）的群編設定並套用到各帳號／門市";
    importBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = await applyConfig();
      toast(`已匯入設定：${r.gidCount} 個帳號群編、${r.chatCount} 筆門市覆寫`);
    });
    chip.insertAdjacentElement("afterend", importBtn);

    // 估價按鈕（頂部，放在「一鍵匯入所有設定」旁邊）
    const estBtn = document.createElement("button");
    estBtn.type = "button";
    estBtn.className = "loe-import-btn";
    estBtn.insertAdjacentHTML("beforeend", ic("calculator"));
    const estLabel = document.createElement("span");
    estLabel.textContent = "估價";
    estBtn.appendChild(estLabel);
    estBtn.title = "估價（開啟計費網站）";
    estBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open("https://calc-fare.mr-chi-tech.com/", "_blank", "noopener");
    });
    importBtn.insertAdjacentElement("afterend", estBtn);

    renderPrefixChip();
  }

  /* ---------------------------------------------------------------------- *
   * 派單 (dispatch) — 手動填寫上車地址＋備註，加上前綴送到 Discord，
   * 並把「尋車中」訊息填入輸入框
   * ---------------------------------------------------------------------- */
  const TRUCK_ICON = ic("truck");
  const CALC_ICON = ic("calculator");
  // 固定格式：群編/地址 [note:筆記] mailto:後台帳號
  // 群編不需自行加斜線，這裡自動補上一個（已有斜線也不會重複）。
  // 例：W0/虎尾高中 note:王小明 mailto:dc@gmail.com
  function buildDispatchPayload(groupCode, address, memo) {
    const email = getDispatcher();
    const g = (groupCode || "").replace(/\/+$/, ""); // 去掉尾端斜線，統一補一個
    let body = g ? `${g}/${address}` : address;
    if (memo) body += ` note:${memo}`; // 筆記（司機看不到，內部備記用）
    if (email) body += ` mailto:${email}`;
    return body;
  }
  function closeDispatchPopover() {
    if (openDispatchPopover._pop) {
      openDispatchPopover._pop.remove();
      openDispatchPopover._pop = null;
    }
  }
  // 自動回覆：填入訊息並按下「傳送」
  function autoSendReply(text) {
    fillReplyTextarea(text, true);
    const sendBtn = document.querySelector(
      ".send-group.btn-group input.btn, .send-group.btn-group button.btn",
    );
    if (sendBtn) {
      window.setTimeout(() => {
        try {
          sendBtn.click();
        } catch (_) {}
      }, 120);
      return true;
    }
    return false;
  }
  // 標記目前對話為「待處理」：點 LINE 自己的待處理按鈕（用它的驗證 token，API 直打會 403）。
  // 已是待處理（按鈕呈 btn-outline-success）就不再點，避免被切回未標記。
  function markFollowUp() {
    try {
      const btn = [
        ...document.querySelectorAll(".sub-header a.btn, a.btn"),
      ].find((b) => b.textContent.trim() === "待處理");
      if (!btn) return false;
      if (/btn-outline-success|\bactive\b/.test(btn.className)) return true; // 已標記
      btn.click();
      return true;
    } catch (_) {}
    return false;
  }
  function openDispatchPopover(prefillAddress) {
    closeDispatchPopover();
    const anchor = document.querySelector(`.${DISPATCH_BUTTON_CLASS}`);
    const pop = document.createElement("div");
    pop.className = DISPATCH_POP_CLASS;
    pop.addEventListener("click", (e) => e.stopPropagation());

    const title = document.createElement("div");
    title.className = "loe-pop-title";
    title.textContent = "派單";

    const closeX = document.createElement("button");
    closeX.type = "button";
    closeX.className = "loe-pop-close";
    closeX.textContent = "×";
    closeX.title = "關閉";
    closeX.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDispatchPopover();
    });

    // 依設定檔決定預設：此對話有店配覆寫就用覆寫的群編＋固定上車地址，否則用此帳號前綴
    const override = getCurrentOverride();

    // 群編（預設帶入設定的前綴／店配覆寫，可自行編輯）
    const groupLabel = document.createElement("label");
    groupLabel.className = "loe-fld";
    groupLabel.textContent = "群編（預設為設定的前綴，可改；不用加斜線）";
    const groupInput = document.createElement("input");
    groupInput.type = "text";
    groupInput.placeholder = "例如：W0";
    groupInput.value =
      override && override.group ? override.group : getPrefix();

    const addrLabel = document.createElement("label");
    addrLabel.className = "loe-fld";
    addrLabel.textContent = "上車地址";
    const addrInput = document.createElement("textarea");
    addrInput.rows = 2;
    addrInput.placeholder = "例如：墨鐵 20:30有行李箱";
    // 優先順序：轉發帶入的地址 > 店配固定上車地址
    if (prefillAddress) addrInput.value = prefillAddress;
    else if (override && override.pickup) addrInput.value = override.pickup;

    // 筆記（預約單可記客戶名稱，司機看不到；組成時變成 note:）
    const memoLabel = document.createElement("label");
    memoLabel.className = "loe-fld";
    memoLabel.textContent = "筆記(選填，司機看不到)";
    const memoInput = document.createElement("input");
    memoInput.type = "text";
    memoInput.placeholder = "例如：王小明（會變成 note:王小明）";
    memoInput.value = getCustomerName(); // 預設帶入目前客戶名稱（含 emoji），可自行改

    // 是否把筆記帶入派單（控制 note: 是否出現在預覽與送出內容）
    const memoChkWrap = document.createElement("label");
    memoChkWrap.className = "loe-check";
    const memoChk = document.createElement("input");
    memoChk.type = "checkbox";
    memoChk.checked = getMemoInclude();
    const memoChkText = document.createElement("span");
    memoChkText.textContent = "帶入乘客姓名";
    memoChkWrap.appendChild(memoChk);
    memoChkWrap.appendChild(memoChkText);

    // 是否標記「待處理」（有勾才標記）
    const markChkWrap = document.createElement("label");
    markChkWrap.className = "loe-check";
    const markChk = document.createElement("input");
    markChk.type = "checkbox";
    markChk.checked = getMarkFollowUp();
    const markChkText = document.createElement("span");
    markChkText.textContent = "標記待處理";
    markChkWrap.appendChild(markChk);
    markChkWrap.appendChild(markChkText);
    markChk.addEventListener("change", () => setMarkFollowUp(markChk.checked));

    // 取目前要送出的筆記值（沒勾就視為空）
    const currentMemo = () => (memoChk.checked ? memoInput.value.trim() : "");
    // 對話連結（linechaturl:）— 永遠在送出時加在最後；預覽不顯示
    const lineUrlSuffix = () => {
      const chat = getChatId();
      if (!chat) return "";
      return ` linechaturl:https://chat.line.biz/${getOaId()}/chat/${chat}`;
    };

    // 預覽單號（即時顯示送出的完整字串）
    const previewLabel = document.createElement("label");
    previewLabel.className = "loe-fld";
    previewLabel.textContent = "預覽單號（實際送出內容）";
    const preview = document.createElement("div");
    preview.className = "loe-preview";
    function refreshPreview() {
      const a = addrInput.value.trim();
      preview.textContent = a
        ? buildDispatchPayload(groupInput.value.trim(), a, currentMemo())
        : "（填入上車地址後顯示）";
    }
    groupInput.addEventListener("input", refreshPreview);
    addrInput.addEventListener("input", refreshPreview);
    memoInput.addEventListener("input", refreshPreview);
    memoChk.addEventListener("change", () => {
      setMemoInclude(memoChk.checked);
      refreshPreview();
    });

    // 派單後自動回覆客人（可選範本）
    const chkWrap = document.createElement("div");
    chkWrap.className = "loe-check";
    const chkLabel = document.createElement("label");
    chkLabel.style.cssText =
      "display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;";
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = getAutoReply();
    const chkText = document.createElement("span");
    chkText.textContent = "派單後自動回覆客人";
    chkLabel.appendChild(chk);
    chkLabel.appendChild(chkText);
    // 範本下拉（從快速回覆範本）
    const reps = getReplies();
    const tplSelect = document.createElement("select");
    tplSelect.className = "loe-tpl-select";
    reps.forEach((r, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = r.name || (r.text || "").slice(0, 10);
      tplSelect.appendChild(o);
    });
    let selIdx = reps.findIndex(
      (r) => (r.name || "") === getDispatchTemplate(),
    );
    if (selIdx < 0) selIdx = reps.findIndex((r) => (r.name || "") === "安排");
    if (selIdx < 0) selIdx = 0;
    if (reps.length) tplSelect.value = String(selIdx);
    tplSelect.addEventListener("change", () => {
      const r = reps[Number(tplSelect.value)];
      if (r) setDispatchTemplate(r.name || "");
    });
    const selectedReplyText = () => {
      const r = reps[Number(tplSelect.value)];
      return r ? r.text : "";
    };
    chkWrap.appendChild(chkLabel);
    chkWrap.appendChild(tplSelect);

    const actions = document.createElement("div");
    actions.className = "loe-pop-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "loe-btn-ghost";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", closeDispatchPopover);
    const sendBtn = document.createElement("button");
    sendBtn.className = "loe-btn-primary";
    sendBtn.textContent = "確認";
    sendBtn.addEventListener("click", async () => {
      const address = addrInput.value.trim();
      if (!address) {
        addrInput.focus();
        return;
      }
      // 預覽用的內容不含對話連結；送出時才在最後加上 linechaturl:
      const payload =
        buildDispatchPayload(groupInput.value.trim(), address, currentMemo()) +
        lineUrlSuffix();
      const auto = chk.checked;
      setAutoReply(auto); // 記住選擇
      sendBtn.disabled = true;
      try {
        const how = await sendForward(payload);
        closeDispatchPopover();
        if (auto) {
          autoSendReply(selectedReplyText());
          toast(
            how === "discord"
              ? "已派單到 Discord，並已自動回覆客人"
              : "已複製（未設定 Webhook），並已自動回覆客人",
          );
        } else {
          // 不勾選：只送派單，不在輸入框帶入任何訊息
          toast(
            how === "discord"
              ? "已派單到 Discord（未回覆客人）"
              : "已複製（未設定 Webhook）",
          );
        }
        // 有勾選「標記待處理」才標記目前這個對話（在自動回覆送出之後）
        if (markChk.checked) window.setTimeout(markFollowUp, 500);
      } catch (err) {
        sendBtn.disabled = false;
        toast("派單失敗：" + (err && err.message ? err.message : "未知錯誤"));
      }
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(sendBtn);

    pop.appendChild(title);
    pop.appendChild(closeX);
    pop.appendChild(groupLabel);
    pop.appendChild(groupInput);
    pop.appendChild(addrLabel);
    pop.appendChild(addrInput);
    pop.appendChild(memoLabel);
    pop.appendChild(memoInput);
    // 勾選同一行
    memoChkWrap.style.marginTop = "0";
    markChkWrap.style.marginTop = "0";
    const checksRow = document.createElement("div");
    checksRow.style.cssText =
      "display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:10px;";
    checksRow.appendChild(memoChkWrap);
    checksRow.appendChild(markChkWrap);
    pop.appendChild(checksRow);
    pop.appendChild(previewLabel);
    pop.appendChild(preview);
    pop.appendChild(chkWrap);
    pop.appendChild(actions);
    document.body.appendChild(pop);
    refreshPreview();

    // 定位：固定在按鈕「上方」展開（bottom 錨定），高度不超過按鈕上方可用空間，避免跑出畫面或抖動
    const W = pop.offsetWidth || 300;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      pop.style.left =
        Math.round(Math.max(8, Math.min(r.left, window.innerWidth - W - 8))) +
        "px";
      pop.style.bottom = Math.round(window.innerHeight - r.top + 8) + "px";
      pop.style.top = "auto";
      pop.style.maxHeight = Math.round(r.top - 16) + "px";
    } else {
      pop.style.left = Math.round((window.innerWidth - W) / 2) + "px";
      pop.style.top = "12px";
      pop.style.maxHeight = window.innerHeight - 24 + "px";
    }
    addrInput.focus();
    pop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDispatchPopover();
    });
    openDispatchPopover._pop = pop;
  }
  function addDispatchButton() {
    const group = document.querySelector(".send-group.btn-group");
    if (!group) return;
    if (!group.parentElement.querySelector(`.${DISPATCH_BUTTON_CLASS}`)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = DISPATCH_BUTTON_CLASS;
      btn.title = "派單（填寫上車地址，自動帶入前綴並送到 Discord）";
      btn.insertAdjacentHTML("beforeend", TRUCK_ICON);
      const label = document.createElement("span");
      label.textContent = "派單";
      btn.appendChild(label);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (openDispatchPopover._pop) closeDispatchPopover();
        else openDispatchPopover();
      });
      group.insertAdjacentElement("beforebegin", btn);
    }
  }

  /* ---------------------------------------------------------------------- *
   * 後台一鍵分享 → 自動送出
   *   後台按「分享」會開啟  https://chat.line.biz/{gid}/chat/{chatId}?send={token}
   *   本腳本偵測到 ?send={token} 後：
   *     GET  {API_BASE}/line-dispatch/{token}      -> { text, gid, chatId }（一次性，410=已用/過期）
   *     填入對話框 → 點送出 → POST .../ack（回報結果）→ 清掉網址 ?send
   *   ※ 腳本不含任何訊息模板：要送的文字一律由後台 getCopyText() 組好、存在後端，這裡只搬運。
   * ---------------------------------------------------------------------- */
  const API_BASE = "https://right.mr-chi-tech.com"; // 後端網域（@connect mr-chi-tech.com 已涵蓋子網域）
  const SEND_TOKEN_RE = /^[0-9a-f]{64}$/;
  let lastConsumedToken = null; // 冪等：同一 token 不重複處理
  let sendInFlight = false;

  function getSendToken() {
    try {
      const t = new URL(location.href).searchParams.get("send");
      return t && SEND_TOKEN_RE.test(t) ? t : null;
    } catch (_) {
      return null;
    }
  }
  function cleanupSendParam() {
    try {
      const u = new URL(location.href);
      if (!u.searchParams.has("send")) return;
      u.searchParams.delete("send");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (_) {}
  }
  // 等對話輸入框就緒，且（若有指定）已切到該對話
  function waitForEditorReady(chatId, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      (function poll() {
        const host = getEditorHost();
        const inner =
          host && host.shadowRoot && host.shadowRoot.querySelector("textarea");
        if (inner && (!chatId || getChatId() === chatId)) return resolve(true);
        if (Date.now() - t0 > timeoutMs) return resolve(false);
        setTimeout(poll, 200);
      })();
    });
  }
  // 找 LINE 送出鈕：派單按鈕是插在 .send-group.btn-group 「前面」(不在群內)，群內最後一顆啟用的就是送出
  function findLineSendButton() {
    const group = document.querySelector(".send-group.btn-group");
    if (group) {
      const btns = Array.from(group.querySelectorAll("button")).filter(
        (b) => !b.disabled && b.offsetParent !== null,
      );
      if (btns.length) return btns[btns.length - 1];
    }
    return null;
  }
  function pressEnterToSend() {
    const host = getEditorHost();
    const el =
      (host && host.shadowRoot && host.shadowRoot.querySelector("textarea")) ||
      document.querySelector('textarea[part="input"].input') ||
      document.querySelector("textarea.input") ||
      document.querySelector("textarea");
    if (!el) return false;
    el.focus();
    const opt = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      composed: true,
    };
    el.dispatchEvent(new KeyboardEvent("keydown", opt));
    el.dispatchEvent(new KeyboardEvent("keypress", opt));
    el.dispatchEvent(new KeyboardEvent("keyup", opt));
    return true;
  }
  function clickLineSendButton() {
    const btn = findLineSendButton();
    if (btn) {
      btn.click();
      return true;
    }
    return pressEnterToSend(); // 備援：找不到按鈕就模擬 Enter
  }
  function httpGetJson(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function")
        return reject(new Error("no GM_xmlhttpRequest"));
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { Accept: "application/json" },
        timeout: 15000,
        onload: (res) => {
          if (res.status === 200) {
            try {
              resolve(JSON.parse(res.responseText));
            } catch (e) {
              reject(e);
            }
          } else if (res.status === 410)
            reject(Object.assign(new Error("gone"), { gone: true }));
          else reject(new Error("HTTP " + res.status));
        },
        onerror: () => reject(new Error("network")),
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }
  /* ---------------------------------------------------------------------- *
   * 遠端設定同步（account-gated）
   *   - 後台帳號(account) 一設定，才會去後端拉設定並覆蓋本地快取。
   *   - 快速回覆：GET /line-quick-replies?account=X（依帳號，無 auth）
   *   - 車隊設定：GET /line-ext-config?fleet=HELLO（依車隊，無 auth，含 Discord webhook）
   *   - 拉回的值直接寫進既有的本地 key（STORE_KEY / WEBHOOK_KEY）當快取，
   *     既有讀取流程不需改動；後端沒設定或離線時自動沿用本地/預設值。
   * ---------------------------------------------------------------------- */
  async function syncRemoteQuickReplies(account) {
    if (!account) return;
    try {
      const data = await httpGetJson(
        `${API_BASE}/line-quick-replies?account=${encodeURIComponent(account)}`,
      );
      const replies = data && data.replies;
      if (Array.isArray(replies) && replies.length) {
        storeSet(STORE_KEY, replies);
        refreshAllQuickMenus();
        renderQuickBar();
      }
    } catch (_) {
      /* 離線/錯誤：沿用本地快取，不打擾使用者 */
    }
  }
  async function syncRemoteFleetConfig(fleet) {
    if (!fleet) return;
    const data = await fetchFleetConfig(fleet);
    if (data) applyFleetConfig(data); // 套用 webhook + 群編前綴 + 對話覆寫
  }
  // 設定 account 後才驅動：沒帳號一律不動遠端設定。
  function syncRemoteConfig() {
    const account = getDispatcher();
    if (!account) return;
    syncRemoteQuickReplies(account);
    syncRemoteFleetConfig(getFleet());
  }
  function ackSend(token, status, error) {
    if (typeof GM_xmlhttpRequest !== "function") return;
    GM_xmlhttpRequest({
      method: "POST",
      url: `${API_BASE}/line-dispatch/${token}/ack`,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ status, error: error || "" }),
    });
  }
  async function consumeAndSend(token) {
    sendInFlight = true;
    let data;
    try {
      data = await httpGetJson(`${API_BASE}/line-dispatch/${token}`);
    } catch (e) {
      cleanupSendParam(); // 410 / 網路錯誤都靜默：清掉網址、不重送
      sendInFlight = false;
      return;
    }
    const text = data && data.text;
    if (!text) {
      cleanupSendParam();
      sendInFlight = false;
      return;
    }
    const ready = await waitForEditorReady(data.chatId);
    if (!ready) {
      ackSend(token, "failed", "editor not ready");
      cleanupSendParam();
      sendInFlight = false;
      return;
    }
    // 對話一致性：目前畫面必須就是 token 對應的對話，避免送錯人
    if (
      (data.chatId && data.chatId !== getChatId()) ||
      (data.gid && data.gid !== getOaId())
    ) {
      ackSend(token, "failed", "chat mismatch");
      cleanupSendParam();
      sendInFlight = false;
      return;
    }
    fillReplyTextarea(text, true);
    setTimeout(() => {
      const sent = clickLineSendButton();
      ackSend(
        token,
        sent ? "sent" : "failed",
        sent ? "" : "send button not found",
      );
      cleanupSendParam();
      sendInFlight = false;
    }, 150);
  }
  function checkSendToken() {
    if (location.hostname !== "chat.line.biz") return;
    if (sendInFlight) return;
    const token = getSendToken();
    if (!token || token === lastConsumedToken) return;
    lastConsumedToken = token; // 先標記再處理，避免 observer 重入重複觸發
    consumeAndSend(token);
  }

  /* ---------------------------------------------------------------------- *
   * 「貼底」捲動穩定器
   *   不論是什麼造成捲動位移，統一用聊天 App 標準做法處理：
   *   1) 用「真實 scroll 事件的 target」找出真正在捲的容器（不用猜選擇器）。
   *   2) 記住使用者是否貼在底部。
   *   3) 任一 DOM 變動後，若原本貼底就把它拉回底；使用者主動往上翻就不再干涉。
   * ---------------------------------------------------------------------- */
  let chatScroller = null;
  let pinnedToBottom = true;
  function isElScrollable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.scrollHeight <= el.clientHeight + 8) return false;
    const oy = getComputedStyle(el).overflowY;
    return oy === "auto" || oy === "scroll" || oy === "overlay";
  }
  function findScrollerByWalk() {
    const anchor = document.querySelector(".chat-body");
    let el = anchor ? anchor.parentElement : null;
    while (el && el !== document.body) {
      if (isElScrollable(el) && el.querySelector(".chat-body")) return el;
      el = el.parentElement;
    }
    return null;
  }
  function getScroller() {
    if (chatScroller && document.contains(chatScroller)) return chatScroller;
    chatScroller = findScrollerByWalk();
    return chatScroller;
  }
  function nearBottom(sc) {
    return sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 60;
  }
  function stickToBottomIfPinned() {
    const sc = getScroller();
    if (sc && pinnedToBottom && !nearBottom(sc)) sc.scrollTop = sc.scrollHeight;
  }
  // 真實捲動事件：學到真正的捲動容器，並更新「是否貼底」（往上翻就解除貼底，不再硬拉）
  document.addEventListener(
    "scroll",
    (e) => {
      const t = e.target;
      if (
        t &&
        t.nodeType === 1 &&
        t.querySelector &&
        t.querySelector(".chat-body")
      ) {
        chatScroller = t;
        pinnedToBottom = nearBottom(t);
      }
    },
    true,
  );

  /* ---------------------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------------------- */
  let lastOaId = getOaId();
  let lastChatId = getChatId();
  enhanceChatBodies();
  enhanceQuickReplyToolbars();
  enhancePrefixChip();
  addDispatchButton();
  ensureQuickBar();
  paintIcons();
  checkSendToken();
  // 已設定後台帳號 → 拉雲端設定（快速回覆 + 該車隊 Webhook）覆蓋本地快取
  syncRemoteConfig();
  // 進頁面先貼底幾次，接住陸續載入的訊息（只在仍貼底時動作）
  [200, 600, 1000].forEach((ms) => setTimeout(stickToBottomIfPinned, ms));
  window.addEventListener("popstate", checkSendToken);
  document.addEventListener("click", () => {
    closeQuickReplyMenus();
    closePrefixPopover();
    closeDispatchPopover();
  });

  // 全域維護工作（建立按鈕/前綴/氣泡列/圖示）以 rAF 去抖動，每幀最多執行一次，避免忙迴圈卡住主執行緒。
  let maintQueued = false;
  function scheduleMaintenance() {
    if (maintQueued) return;
    maintQueued = true;
    requestAnimationFrame(() => {
      maintQueued = false;
      enhancePrefixChip();
      addDispatchButton();
      ensureQuickBar();
      paintIcons();
      checkSendToken();
      const oa = getOaId();
      if (oa !== lastOaId) {
        lastOaId = oa;
        renderPrefixChip();
        closePrefixPopover();
        closeDispatchPopover();
      }
      const chat = getChatId();
      if (chat !== lastChatId) {
        // 換對話：重設成「貼底」並重新尋找捲動容器，接著幾次把它拉到底
        lastChatId = chat;
        chatScroller = null;
        pinnedToBottom = true;
        if (chat)
          [0, 150, 400, 800, 1200].forEach((ms) =>
            setTimeout(stickToBottomIfPinned, ms),
          );
      }
      stickToBottomIfPinned();
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const chatBody = mutation.target.parentElement?.closest(".chat-body");
        if (chatBody) addCopyButton(chatBody);
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof Text) {
          const chatBody = node.parentElement?.closest(".chat-body");
          if (chatBody) addCopyButton(chatBody);
          continue;
        }
        if (!(node instanceof Element)) continue;
        if (node.matches(".chat-body")) addCopyButton(node);
        else enhanceChatBodies(node);
        if (node.matches("i.lar.la-chat-phone.la-fw.la-lg"))
          addQuickReplyButton(node.closest("a"));
        else enhanceQuickReplyToolbars(node);
      }
    }
    stickToBottomIfPinned();
    scheduleMaintenance();
  });
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();
