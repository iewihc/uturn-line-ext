// ==UserScript==
// @name         UTurn懶惰蟲專用
// @namespace    https://github.com/iewihc/uturn-line-ext
// @version      1.47.1
// @description  Uturn 派單神器：複製、地址導航、快速回覆、前綴、派單轉發到 Discord、估價、預約單、後台一鍵分享自動送出。
// @author       iewihc
// @match        https://manager.line.biz/*
// @match        https://chat.line.biz/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
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

  // 版本單一來源＝標頭 @version（Tampermonkey 自動更新必讀此行）。
  // 這裡不再各寫一份，改從 GM_info.script.version 衍生，杜絕漂移。
  const UTURN_BUILD =
    (typeof GM_info !== "undefined" &&
      GM_info.script &&
      GM_info.script.version) ||
    "dev";

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

  const QUICK_BUTTON_CLASS = "loe-quick-reply-button";
  const QUICK_MENU_CLASS = "loe-quick-reply-menu";
  const QUICK_MENU_OPEN_CLASS = "loe-quick-reply-open";
  const STORE_KEY = "loe_quick_replies_v1";
  const FLEET_STORE_KEY = "loe_fleet_quick_replies_v1"; // 車隊統一模板（匯入後常駐）
  const QR_MODE_KEY = "loe_qr_display_mode_v1"; // 氣泡列顯示模式：personal | fleet | both
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
  const CHAT_OVERRIDE_KEY = "loe_chat_overrides_v1"; // 對話層級覆寫（群編＋固定上車地址）
  const SEND_KEY_STORE_PREFIX = "loe_line_send_key_v1::"; // 身份授權通過的發送 KEY（依後台帳號存；傳送／恢復自動帶入）
  const SKIP_GROUP_CHATS_KEY = "loe_line_skip_group_chats_v1"; // 群發「群組不發送」：過濾 chatId C 開頭的群組聊天（預設開）

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
    "shield-check": '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"></path><path d="m9 12 2 2 4-4"></path>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"></path><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"></path>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
  };
  const ic = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  const COPY_ICON = ic("copy");
  const CHECK_ICON = ic("check");
  const ERROR_ICON = ic("x");
  const QUICK_ICON = ic("message-square");
  const FORWARD_ICON = ic("forward");

  /* ---------------------------------------------------------------------- *
   * Styles
   * ---------------------------------------------------------------------- */
  const style = document.createElement("style");
  style.textContent = `
    .${BUBBLE_CLASS} { position: relative !important; }
    .${TEXT_PAD_CLASS} { padding-right: 34px !important; }

    /* 每則訊息的複製按鈕（白底膠囊、淡陰影描邊、hover 微浮起變藍） */
    .${BUTTON_CLASS} {
      position: absolute;
      top: 7px;
      right: 7px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.94);
      color: #64748b;
      cursor: pointer;
      opacity: 0.55;
      user-select: none;
      box-shadow: 0 1px 3px rgba(16,24,40,.12), 0 0 0 1px rgba(16,24,40,.06);
      transition: opacity .15s ease, color .15s ease, box-shadow .15s ease, transform .12s ease;
    }
    .${BUBBLE_CLASS}:hover .${BUTTON_CLASS} { opacity: 1; }
    .${BUTTON_CLASS}:hover,
    .${BUTTON_CLASS}:focus-visible {
      color: ${BLUE};
      opacity: 1;
      outline: none;
      box-shadow: 0 2px 7px rgba(28,108,243,.28), 0 0 0 1px rgba(28,108,243,.40);
      transform: translateY(-1px);
    }
    .${BUTTON_CLASS}:active, .${FORWARD_BUTTON_CLASS}:active { transform: translateY(0); }
    .${ICON_CLASS},
    .${BUTTON_CLASS} > svg,
    .${FORWARD_BUTTON_CLASS} > svg {
      width: 14px; height: 14px;
      fill: none; stroke: currentColor;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }
    .${BUTTON_CLASS}.${COPIED_CLASS} {
      color: #06c755;
      background: #effaf1;
      opacity: 1;
      box-shadow: 0 1px 4px rgba(6,199,85,.25), 0 0 0 1px rgba(6,199,85,.45);
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
    .loe-qr-empty {
      padding: 10px;
      color: #94a3b8;
      font-size: 12px;
      text-align: center;
    }
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
      display: flex; gap: 8px; align-items: center;
      padding: 8px 10px;
      overflow-x: auto;
      background: linear-gradient(180deg, rgba(28,108,243,.04), rgba(28,108,243,0));
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      scrollbar-width: thin;
    }
    .${QR_BAR_CLASS}::-webkit-scrollbar { height: 5px; }
    .${QR_BAR_CLASS}::-webkit-scrollbar-thumb { background: rgba(15,23,42,.14); border-radius: 6px; }
    .${QR_BAR_CLASS}::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,.26); }
    .${QR_CHIP_CLASS} {
      flex-shrink: 0;
      display: inline-flex; align-items: center;
      padding: 6px 14px;
      border: 1px solid rgba(15, 23, 42, 0.10);
      border-radius: 999px;
      background: #fff;
      color: #334155;
      font: inherit; font-size: 12.5px; font-weight: 500;
      line-height: 1.25;
      cursor: pointer; white-space: nowrap;
      max-width: 220px; overflow: hidden; text-overflow: ellipsis;
      box-shadow: 0 1px 2px rgba(16,24,40,.06);
      transition: background .14s ease, border-color .14s ease, color .14s ease, box-shadow .14s ease, transform .1s ease;
    }
    .${QR_CHIP_CLASS}:hover {
      background: ${BLUE_SOFT};
      border-color: rgba(28,108,243,.50);
      color: ${BLUE_HOVER};
      box-shadow: 0 2px 7px rgba(28,108,243,.18);
      transform: translateY(-1px);
    }
    .${QR_CHIP_CLASS}:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(16,24,40,.08);
    }

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
    .loe-customers-dialog { width: min(1080px, 94vw); max-height: 90vh; padding: 0; border: 0; border-radius: 16px; color: #1f2937; background: #fff; box-shadow: 0 24px 80px #0f172a40; font: 14px/1.5 system-ui, sans-serif; }
    .loe-customers-dialog::backdrop { background: #0f172a80; }
    .loe-customers-dialog * { box-sizing: border-box; }
    .loe-customers-dialog [hidden] { display: none !important; }
    .loe-customers-dialog button:disabled { opacity: .45; cursor: not-allowed; }
    .loe-customers-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
    .loe-customers-panel { padding: 18px; min-width: 0; }
    .loe-customers-compose { background: #f8fafc; border-left: 1px solid #e2e8f0; }
    .loe-customers-muted { color: #64748b; font-size: 12px; overflow-wrap: anywhere; }
    .loe-customers-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .loe-customers-search { display: flex; gap: 8px; margin-top: 12px; }
    .loe-customers-search input { min-width: 0; flex: 1; }
    .loe-customers-account-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .loe-customers-account-head .loe-customers-section-title { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    .loe-customers-sync { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; }
    .loe-customers-sync svg, .loe-advanced-menu svg { width: 16px; height: 16px; flex-shrink: 0; }
    .loe-send-requirements [data-role="filter-input"] { width: 100%; margin: 8px 0; }
    .loe-customers-list { height: 330px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .loe-customer-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
    .loe-customer-row:has(input:checked) { background: ${BLUE_SOFT}; }
    .loe-customer-row[data-excluded="true"], .loe-customer-row[data-excluded="true"]:has(input:checked) { background: #fff7ed; }
    .loe-customer-row[data-excluded="true"] .loe-customer-name::after { content: " · 不發送"; color: #b45309; font-size: 12px; }
    .loe-customer-select { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; cursor: pointer; }
    .loe-send-requirements { margin: 14px 0; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; }
    .loe-send-requirement + .loe-send-requirement { margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .loe-send-requirement-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .loe-send-badge { font-size: 12px; color: #92400e; background: #fff7ed; border-radius: 20px; padding: 2px 8px; white-space: nowrap; }
    .loe-send-badge[data-ready="true"] { color: #166534; background: #f0fdf4; }
    .loe-send-badge[data-ready="optional"] { color: #64748b; background: #f1f5f9; }
    .loe-excluded-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 130px; overflow: auto; margin: 8px 0; }
    .loe-excluded-list button { max-width: 100%; overflow-wrap: anywhere; text-align: left; }
    .loe-send-requirements details summary { cursor: pointer; color: ${BLUE}; font-size: 12px; }
    .loe-send-requirements textarea { min-height: 72px; margin-top: 8px; }
    .loe-send-key-row { display: flex; gap: 6px; }
    .loe-key-dialog { width: min(440px, 92vw); }
    .loe-key-dialog form { display: flex; flex-direction: column; gap: 10px; }
    .loe-send-key-row input { flex: 1; min-width: 0; }
    .loe-send-ready { margin: 10px 0; font-size: 12px; color: #64748b; }
    .loe-customer-row input, .loe-customers-toolbar input { accent-color: ${BLUE}; }
    .loe-customer-avatar { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; background: #e2e8f0; object-fit: cover; }
    .loe-customer-info { min-width: 0; flex: 1; }
    .loe-customer-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .loe-customers-empty { padding: 42px 16px; text-align: center; color: #64748b; }
    .loe-customers-status { min-height: 22px; font-size: 12px; color: #64748b; }
    .loe-customers-status[data-error="true"] { color: #b91c1c; }
    .loe-customers-selection { color: ${BLUE}; font-weight: 600; }
    .loe-customers-section-title { margin: 0 0 8px; font-size: 15px; font-weight: 700; }
    .loe-customers-compose textarea { min-height: 130px; }
    .loe-customers-images { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .loe-customers-image { width: 92px; padding: 5px; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; }
    .loe-customers-image img { width: 80px; height: 72px; object-fit: contain; display: block; }
    .loe-customers-image button { margin-top: 4px; width: 100%; }
    .loe-coupon-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; max-height: 380px; overflow: auto; margin: 10px 0; }
    .loe-coupon-card { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; min-width: 0; overflow-wrap: anywhere; }
    .loe-coupon-card:has(input:checked) { border-color: ${BLUE}; background: ${BLUE_SOFT}; }
    .loe-coupon-card:has(input:disabled) { opacity: .6; cursor: default; }
    .loe-coupon-card img { display: block; width: 100%; height: 100px; object-fit: contain; background: #f1f5f9; border-radius: 6px; }
    .loe-coupon-card input { accent-color: ${BLUE}; }
    .loe-message-types { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; margin: 14px 0; background: #eef2f7; border-radius: 10px; }
    .loe-message-types label { position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; padding: 9px 2px; border-radius: 7px; cursor: pointer; font-size: 13px; white-space: nowrap; }
    .loe-message-types input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .loe-message-types label:has(input:checked) { color: ${BLUE}; background: #fff; box-shadow: 0 1px 4px #0f172a18; font-weight: 700; }
    .loe-message-types label:has(input:focus-visible) { outline: 2px solid ${BLUE}; outline-offset: 1px; }
    .loe-message-types label:has(input:disabled) { cursor: default; opacity: .65; }
    [data-role="coupons"] .loe-coupon-card { padding: 10px; gap: 8px; }
    [data-role="coupons"] .loe-coupon-card img { height: auto; aspect-ratio: 1; }
    [data-role="coupons"] .loe-coupon-card .loe-customers-muted { font-size: 12px; line-height: 1.5; }
    .loe-card-preview { display: flex; gap: 10px; overflow-x: auto; max-width: 100%; padding: 8px 0; }
    .loe-card-page { flex: 0 0 170px; min-width: 0; padding: 8px; border: 1px solid #cbd5e1; border-radius: 10px; overflow-wrap: anywhere; }
    .loe-card-page img { width: 100%; height: 150px; object-fit: contain; border-radius: 6px; background: #f1f5f9; }
    .loe-card-page p { margin: 6px 0; white-space: pre-wrap; }
    .loe-customers-preview-text { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 180px; overflow: auto; }
    .loe-customers-notice { padding: 9px 12px; margin: 12px 0; background: #fff7ed; color: #9a3412; border-radius: 8px; font-size: 12px; }
    .loe-message-toast { position: fixed; right: 20px; bottom: 20px; width: min(360px, calc(100vw - 32px)); max-height: min(480px, 70vh); overflow: auto; padding: 14px; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; color: #1f2937; box-shadow: 0 8px 32px #0f172a33; z-index: 2147483647; overflow-wrap: anywhere; }
    .loe-message-toast-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .loe-message-toast progress { width: 100%; height: 6px; accent-color: ${BLUE}; }
    .loe-message-toast .loe-customers-toolbar { margin: 8px 0 0; }
    .loe-message-toast details { margin-top: 8px; }
    .loe-message-toast summary { cursor: pointer; color: ${BLUE}; font-size: 12px; }
    .loe-message-results { max-height: 240px; overflow: auto; }
    .loe-message-result { padding: 8px 0; border-bottom: 1px solid #e2e8f0; white-space: pre-wrap; }
    @media (max-width: 720px) { .loe-customers-layout { grid-template-columns: 1fr; } .loe-customers-compose { border-left: 0; border-top: 1px solid #e2e8f0; } .loe-customers-list { height: 240px; } }
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
    /* $ 餘額紀錄按鈕（工具列，與快速回覆 icon 對齊） */
    .loe-ledger-button {
      font-weight: 800; font-size: 14px; line-height: 1;
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 22px; border-radius: 6px; padding: 0 5px;
      color: ${BLUE}; text-decoration: none; white-space: nowrap;
    }
    .loe-ledger-button:hover { background: ${BLUE_SOFT}; color: ${BLUE_HOVER}; }
    .loe-ledger-balance { font-size: 16px; font-weight: 800; margin-bottom: 10px; }
    .loe-ledger-row { display: flex; justify-content: space-between; gap: 10px;
      padding: 8px 12px; border: 1px solid rgba(15,23,42,0.08); border-radius: 8px; background: #fafbfc; }
    .loe-ledger-row .loe-amt-pos { color: #16a34a; font-weight: 700; }
    .loe-ledger-row .loe-amt-neg { color: #dc2626; font-weight: 700; }
    .loe-ledger-date { color: #94a3b8; font-size: 12px; margin-left: 8px; }
    .loe-ledger-formrow { display: flex; gap: 8px; align-items: center; }
    .loe-ledger-formrow select.loe-input { width: 64px; flex: none; }
    .loe-ledger-formrow input.loe-amt { flex: 1; }
    /* 車隊統一模板 chip：琥珀色系，與個人（白底）區隔 */
    .loe-qr-chip-fleet {
      background: #fff7e6;
      border-color: rgba(217,119,6,0.35);
      color: #92400e;
    }
    .loe-qr-chip-fleet:hover { background: #ffedcc; }
    .loe-mgr-fleet-note { color: #92400e; font-size: 12px; margin: 2px 0 8px; }
    .loe-row-fleet { background: #fff7e6; border-color: rgba(217,119,6,0.25); }
    .loe-ledger-del {
      margin-left: 8px; border: none; background: none; cursor: pointer;
      color: #cbd5e1; font-size: 14px; line-height: 1; padding: 2px 4px; border-radius: 4px;
    }
    .loe-ledger-del:hover { color: #dc2626; background: rgba(220,38,38,0.08); }

    /* 轉發按鈕（放在複製按鈕左邊，樣式與複製一致） */
    .${FORWARD_BUTTON_CLASS} {
      position: absolute;
      top: 7px;
      right: 39px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.94);
      color: #64748b;
      cursor: pointer;
      opacity: 0.55;
      box-shadow: 0 1px 3px rgba(16,24,40,.12), 0 0 0 1px rgba(16,24,40,.06);
      transition: opacity .15s ease, color .15s ease, box-shadow .15s ease, transform .12s ease;
    }
    .${BUBBLE_CLASS}:hover .${FORWARD_BUTTON_CLASS} { opacity: 1; }
    .${FORWARD_BUTTON_CLASS}:hover,
    .${FORWARD_BUTTON_CLASS}:focus-visible {
      color: ${BLUE}; opacity: 1; outline: none;
      box-shadow: 0 2px 7px rgba(28,108,243,.28), 0 0 0 1px rgba(28,108,243,.40);
      transform: translateY(-1px);
    }
    .${FORWARD_BUTTON_CLASS}.${COPIED_CLASS} {
      color: #06c755; background: #effaf1; opacity: 1;
      box-shadow: 0 1px 4px rgba(6,199,85,.25), 0 0 0 1px rgba(6,199,85,.45);
    }
    /* 有轉發按鈕的泡泡需要更多右側留白 */
    .loe-has-forward.${TEXT_PAD_CLASS} { padding-right: 70px !important; }
    /* 位置訊息：泡泡右側留白，固定顯示的轉發/複製鈕不會蓋住箭頭 */
    .loe-loc-pad { padding-right: 72px !important; }

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
    .loe-console-button:disabled { opacity: .6; cursor: progress; }
    .loe-import-btn > svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
    .loe-advanced-menu {
      position: fixed; z-index: 2147483647; box-sizing: border-box;
      width: 160px; max-width: calc(100vw - 16px); padding: 5px;
      background: #fff; border: 1px solid rgba(15,23,42,.12);
      border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.18);
    }
    .loe-advanced-menu[hidden] { display: none !important; }
    .loe-advanced-menu > button {
      display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; border: 0; border-radius: 6px;
      background: transparent; color: #1f2937; font: inherit; font-size: 13px;
      line-height: 1.4; text-align: left; cursor: pointer;
    }
    .loe-advanced-menu > button:hover,
    .loe-advanced-menu > button:focus-visible { background: ${BLUE_SOFT}; color: ${BLUE_HOVER}; outline: none; }

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

    /* Toast（左上角：右上角會擋住 chat.line.biz 的搜尋/帳號區） */
    .loe-toast {
      position: fixed; top: 16px; left: 16px;
      z-index: 2147483647;
      background: rgba(15,23,42,.92); color: #fff;
      padding: 10px 16px; border-radius: 10px; font-size: 13px;
      box-shadow: 0 10px 30px rgba(15,23,42,.3);
      max-width: 80vw; white-space: pre-wrap; text-align: left;
      opacity: 0; transition: opacity .18s ease;
    }
    .loe-toast.show { opacity: 1; }
    .loe-toast.ok  { background: rgba(5,102,54,.95); }
    .loe-toast.err { background: rgba(153,27,27,.95); }
    .loe-toast.warn { background: rgba(146,64,14,.95); }

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

    /* 懶惰蟲版本號（工具列末端，灰色小字）
       跟 .loe-import-btn 膠囊同高(28px)同間距(margin-left:6px)，垂直置中對齊 */
    .loe-version-chip {
      display: inline-flex; align-items: center;
      height: 28px; margin-left: 6px;
      font: inherit; font-size: 11px; font-weight: 600; line-height: 1;
      color: #9aa0a6; white-space: nowrap; user-select: none;
    }

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
  function getFleetReplies() {
    const v = storeGet(FLEET_STORE_KEY, null);
    return Array.isArray(v) ? v : [];
  }
  // 是否曾匯入車隊模板（匯入後常駐；沒匯入過＝純個人模式，開頁不自動抓）
  function hasImportedFleetReplies() {
    return Array.isArray(storeGet(FLEET_STORE_KEY, null));
  }
  function setReplies(arr) {
    storeSet(STORE_KEY, arr);
    refreshAllQuickMenus();
    renderQuickBar();
    // ext 為主：本地改動（新增/編輯/刪除/排序）即時推回雲端個人副本，
    // 「匯入自己的模板」才拿得到最新內容（沒設帳號不推、離線靜默）
    pushRepliesToBackend(getDispatcher(), arr);
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

  /* ---------------------------------------------------------------------- *\
   * Python 發送參數：只在按鈕／選單點擊時擷取，列印 url 與三個必要 Cookie。
   * 手動擷取；身份授權按鈕送到指定後端帳號，不列印憑證。
   * 不將 Cookie 寫入 GM 設定儲存或其他同步管道。
   * document.cookie 看不到 HttpOnly；GM_cookie 是否支援取決於擴充版本與權限。
   * https://www.tampermonkey.net/documentation.php?q=GM_cookie
   * ---------------------------------------------------------------------- */
  const LINE_API_COOKIE_NAMES = ["ses", "__Host-chat-ses", "XSRF-TOKEN"];
  let lineApiDebugRun = 0;

  async function readLineApiCookies(url) {
    let cookies = [];
    let cookieReadError = "";
    try {
      if (
        typeof GM_cookie === "undefined" ||
        typeof GM_cookie.list !== "function"
      )
        throw new Error("GM_cookie.list 不可用");
      const items = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("讀取 Cookie 逾時")), 3000);
        try {
          // 不指定 partitionKey 時會漏掉分區 Cookie。
          // HttpOnly 仍須使用者在 Tampermonkey 的 Cookie 存取設定中允許。
          GM_cookie.list({ url, partitionKey: {} }, (items, error) => {
            clearTimeout(timer);
            if (error) reject(new Error(String(error)));
            else if (!Array.isArray(items))
              reject(new Error("Cookie 回傳格式不符"));
            else resolve(items);
          });
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      });
      // 空 partitionKey 會包含其他頂層網站的分區；只保留 LINE 本頁適用的。
      cookies = items.filter((cookie) => {
        const key = cookie.partitionKey;
        return (
          LINE_API_COOKIE_NAMES.includes(cookie.name) &&
          (!key ||
            (["https://line.biz", "https://chat.line.biz"].includes(key.topLevelSite) &&
              key.hasCrossSiteAncestor !== true))
        );
      });
    } catch (error) {
      cookieReadError = String(error.message || error);
    }
    try {
      const readableCookies = document.cookie.split(";").flatMap((part) => {
        const pair = part.trim();
        const eq = pair.indexOf("=");
        return eq > 0
          ? [{ name: pair.slice(0, eq), value: pair.slice(eq + 1) }]
          : [];
      });
      // GM 回傳部分結果時也補讀可見的登入欄位，不覆蓋 API URL 的 Cookie。
      const missingReadable = readableCookies.filter(
        ({ name }) =>
          LINE_API_COOKIE_NAMES.includes(name) &&
          !cookies.some((cookie) => cookie.name === name),
      );
      cookies.push(...missingReadable);
    } catch (error) {
      cookieReadError = [cookieReadError, "document.cookie：" + String(error.message || error)]
        .filter(Boolean)
        .join("；");
    }
    return { cookies, cookieReadError };
  }

  async function captureLineApiParams() {
    if (location.hostname !== "chat.line.biz" || window.top !== window.self) return;
    const pathname = location.pathname;
    const botId = getOaId();
    const chatId = getChatId();
    if (!/^U[0-9a-f]{32}$/i.test(botId)) return;
    const run = ++lineApiDebugRun;
    try {
      const requestUrl = chatId
        ? `${location.origin}/api/v1/bots/${botId}/chats/${encodeURIComponent(chatId)}/messages/send`
        : `${location.origin}/api/v2/bots/${botId}/chats`;
      const { cookies, cookieReadError } = await readLineApiCookies(requestUrl);
      // 讀 Cookie 是非同步的，期間換人或重新擷取就丟棄舊結果。
      if (run !== lineApiDebugRun || pathname !== location.pathname) return;
      const cookieValue = (name) => {
        const cookie = cookies.find((item) => item.name === name);
        return cookie ? cookie.value : "";
      };
      const missingCookies = LINE_API_COOKIE_NAMES.filter(
        (name) => !cookieValue(name),
      );
      const snapshot = {
        params: {
          url: chatId
            ? `${location.origin}/${botId}/chat/${encodeURIComponent(chatId)}`
            : null,
          Cookie: LINE_API_COOKIE_NAMES.filter((name) => cookieValue(name))
            .map((name) => `${name}=${cookieValue(name)}`)
            .join("; "),
        },
        cookieReadError,
        missingCookies,
      };
      return snapshot;
    } catch (_) { return; }
  }

  /* ---------------------------------------------------------------------- *\
   * 目前官方帳號的名稱、chatId、頭像網址：逐頁讀到沒有 next。
   * 每次載入／切換官方帳號讀一次；同帳號切換對話不重抓。
   * ---------------------------------------------------------------------- */
  let lineChatDirectoryRun = null;

  async function fetchLineDirectoryPage(url, run) {
    const timer = setTimeout(() => {
      run.timedOut = true;
      run.controller.abort();
    }, 15000);
    try {
      const response = await fetch(url.href, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: {
          Accept: "application/json",
          "x-oa-chat-client-version": "20240513144702",
        },
        signal: run.controller.signal,
      });
      if (response.status === 401 || response.status === 403)
        throw new Error("登入已失效或沒有此官方帳號的讀取權限");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!(response.headers.get("Content-Type") || "").includes("application/json"))
        throw new Error("回應不是 JSON，請確認 LINE 登入狀態");
      const page = await response.json();
      if (!page || !Array.isArray(page.list))
        throw new Error("回應缺少清單，無法確認是否讀取完整");
      if (page.next != null && typeof page.next !== "string")
        throw new Error("下一頁游標格式不符，無法繼續讀取");
      return page;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadLineChatDirectory(force = false) {
    if (location.hostname !== "chat.line.biz" || window.top !== window.self) return;
    const botId = getOaId();
    if (!force && lineChatDirectoryRun && lineChatDirectoryRun.botId === botId)
      return;
    if (lineChatDirectoryRun) lineChatDirectoryRun.controller.abort();
    lineChatDirectoryRun = null;
    if (!/^U[0-9a-f]{32}$/i.test(botId)) return;

    const run = { botId, controller: new AbortController(), rows: null };
    lineChatDirectoryRun = run;
    const isCurrent = () =>
      lineChatDirectoryRun === run && getOaId() === botId;
    const rows = new Map();
    const cursors = new Set();
    let next = "";
    try {
      do {
        if (!isCurrent()) return;
        const url = new URL(`/api/v2/bots/${botId}/chats`, location.origin);
        url.searchParams.set("folderType", "ALL");
        url.searchParams.set("limit", "25");
        url.searchParams.set("prioritizePinnedChat", "true");
        if (next) url.searchParams.set("next", next);
        const page = await fetchLineDirectoryPage(url, run);
        if (!isCurrent()) return;
        for (const chat of page.list) {
          if (!chat || typeof chat.chatId !== "string" || !chat.chatId)
            throw new Error("對話資料缺少 chatId，無法確認是否讀取完整");
          const profile = chat.profile || {};
          rows.set(chat.chatId, {
            lineName: profile.name || profile.nickname || "（未提供名稱）",
            chatId: chat.chatId,
            // 與 LINE 前端 ProfileIcon 使用相同的頭像預覽網址。
            avatarUrl:
              profile.iconHash && profile.iconHash !== "biz-app"
                ? `https://profile.line-scdn.net/${encodeURIComponent(profile.iconHash)}/preview`
                : "",
          });
        }
        next = page.next || "";
        if (next && cursors.has(next))
          throw new Error("下一頁游標重複，停止讀取以避免無限循環");
        if (next) cursors.add(next);
      } while (next);
      if (!isCurrent()) return;
      run.rows = Array.from(rows.values());
      return run.rows;
    } catch (error) {
      if (!isCurrent()) return;
      run.error = run.timedOut ? "讀取逾時" : String(error.message || error);
    }
  }

  function initLineChatDirectory() {
    if (location.hostname !== "chat.line.biz" || window.top !== window.self) return;
    void loadLineChatDirectory();
  }

  /* ---------------------------------------------------------------------- *\
   * 後端 Cookie／名單同步與客戶選取。只有使用者點擊才寫入後端。
   * 選圖先上傳原圖；文字、圖片、優惠券、多頁訊息按傳送後才建立作業。
   * ---------------------------------------------------------------------- */
  const LINE_CUSTOMER_PAGE_SIZE = 50;
  const LINE_RECIPIENT_LIMIT = 50000;
  let lineCustomerDialog = null;

  // LINE 原生選擇器使用 page=1 起算、每頁 25 張，沒有 next 游標。
  async function fetchLineCoupons(groupId, controller) {
    const coupons = new Map();
    const run = { controller };
    for (let page = 1; page <= 200; page++) {
      const url = new URL(`/api/v1/bots/${encodeURIComponent(groupId)}/coupons`, location.origin);
      url.search = new URLSearchParams({ page: String(page), pageSize: "25" });
      const data = await fetchLineDirectoryPage(url, run);
      if (data.list.length > 25) throw new Error("優惠券分頁格式不符，請重新讀取");
      for (const coupon of data.list) {
        if (!Number.isSafeInteger(coupon?.couponId) || coupon.couponId <= 0 ||
            typeof coupon.title !== "string" || typeof coupon.status !== "string" ||
            !Number.isFinite(coupon.startTime) || !Number.isFinite(coupon.endTime) ||
            coupons.has(coupon.couponId))
          throw new Error("優惠券清單不完整或有重複資料，請重新讀取");
        coupons.set(coupon.couponId, coupon);
      }
      if (data.list.length < 25) return [...coupons.values()];
    }
    throw new Error("優惠券分頁超過讀取上限，未套用清單");
  }

  function lineCouponAvailable(coupon) {
    return coupon?.status === "AVAILABLE" && coupon.startTime <= Date.now() && coupon.endTime > Date.now();
  }

  function lineCardPages(card) {
    const contents = card?.messageObject?.contents;
    if (card?.messageObject?.type !== "flex") return [];
    if (contents?.type === "bubble") return [contents];
    return contents?.type === "carousel" && Array.isArray(contents.contents) &&
      contents.contents.every(page => page?.type === "bubble") ? contents.contents : [];
  }

  async function fetchLineCardMessages(groupId, controller) {
    const cards = new Map(), cursors = new Set();
    let next = "", total = null;
    for (let page = 0; page < 2000; page++) {
      const url = new URL(`/api/v1/bots/${encodeURIComponent(groupId)}/cardTypeMessages`, location.origin);
      url.searchParams.set("limit", "25");
      if (next) url.searchParams.set("next", next);
      const data = await fetchLineDirectoryPage(url, { controller });
      if (data.list.length > 25 || !Number.isSafeInteger(data.total) || data.total < 0 ||
          (total !== null && total !== data.total) || (data.next != null && typeof data.next !== "string"))
        throw new Error("多頁訊息分頁資料已變動或格式不符，請重新讀取");
      total = data.total;
      for (const card of data.list) {
        if (!Number.isSafeInteger(card?.id) || card.id <= 0 || typeof card.title !== "string" ||
            !lineCardPages(card).length || cards.has(card.id))
          throw new Error("多頁訊息清單不完整或有重複資料，請重新讀取");
        cards.set(card.id, card);
      }
      // 實測最後一筆仍可能帶 next；不能因短頁或已達 total 就停止。
      next = data.next || "";
      if (!next) {
        if (cards.size !== total) throw new Error("多頁訊息總數不符，請重新讀取");
        return [...cards.values()];
      }
      if (!data.list.length || cards.size > total || cursors.has(next))
        throw new Error("多頁訊息分頁未前進，請重新讀取");
      cursors.add(next);
    }
    throw new Error("多頁訊息分頁超過讀取上限，未套用清單");
  }

  // 僅產生安全的圖片／文字摘要；不執行卡片中的 action 或插入 HTML。
  function lineCardPageSummary(page) {
    const texts = [], images = [];
    const visit = (node, depth = 0) => {
      if (!node || typeof node !== "object" || depth > 30) return;
      if (node.type === "text" && typeof node.text === "string") texts.push(node.text);
      if (node.type === "image" && typeof node.url === "string") {
        try { const url = new URL(node.url); if (url.protocol === "https:") images.push(url.href); } catch (_) {}
      }
      if (Array.isArray(node.contents)) node.contents.forEach(child => visit(child, depth + 1));
      for (const key of ["header", "hero", "body", "footer"]) visit(node[key], depth + 1);
    };
    visit(page);
    return { text: [...new Set(texts)].join("\n"), image: images[0] || "" };
  }

  function lineRequestError(message, status = 0, code = "", uncertain = false) {
    return Object.assign(new Error(message), { status, code, uncertain });
  }

  function lineDisplayMessage(value) {
    // 後端錯誤也可能夾帶識別碼；保留可操作的說明，隱藏原始值。
    return String(value || "")
      .replace(/\bU[0-9a-f]{32}\b/gi, "（已隱藏）")
      .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "（已隱藏）")
      .replace(/\b(?:img_)?[0-9a-f]{24}\b/gi, "（已隱藏）")
      .replace(/\b(couponId|cardTypeMessageId|ID)\s*[:：=]?\s*\d+\b/gi, "$1（已隱藏）");
  }

  function lineBackendRequest(method, path, body, signal, extraHeaders = {}) {
    const multipart = body instanceof FormData;
    return new Promise((resolve, reject) => {
      let request;
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        if (signal) signal.removeEventListener("abort", abort);
        callback(value);
      };
      const abort = () => {
        finish(reject, new DOMException("已取消", "AbortError"));
        if (request) request.abort();
      };
      if (signal?.aborted) return abort();
      if (typeof GM_xmlhttpRequest !== "function")
        return finish(reject, new Error("Tampermonkey 網路請求功能不可用"));
      if (signal) signal.addEventListener("abort", abort, { once: true });
      try {
        request = GM_xmlhttpRequest({
          method,
          url: API_BASE + path,
          headers: {
            Accept: "application/json, application/problem+json",
            ...(body === undefined || multipart ? {} : { "Content-Type": "application/json" }),
            ...extraHeaders,
          },
          // GM_xmlhttpRequest 支援 FormData，由 Tampermonkey 產生 multipart boundary。
          data: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
          timeout: multipart ? 120000 : 30000,
          onload: (response) => {
            if (response.status < 200 || response.status >= 300) {
              let problem;
              try { problem = JSON.parse(response.responseText); } catch (_) {}
              const fallback = response.status === 404
                ? (path.startsWith("/line-ext-cookie")
                  ? "後台帳號不存在，請檢查轉發設定裡的後台帳號"
                  : "此官方帳號尚未列入懶惰蟲配置，請聯絡後台確認")
                : response.status === 413 ? (multipart ? "圖片超過後端可接收的大小，請縮小後重新選圖" : "請求超過後端可接收的大小")
                : response.status === 422 ? "資料格式不符，後端未接受這次請求"
                : `後端回應 HTTP ${response.status}`;
              const message = lineDisplayMessage(typeof problem?.detail === "string" && problem.detail ? problem.detail : fallback);
              return finish(reject, lineRequestError(message, response.status,
                typeof problem?.code === "string" ? problem.code : "", response.status >= 500 || !response.status));
            }
            try {
              finish(resolve, response.status === 204 && !response.responseText ? null : JSON.parse(response.responseText));
            } catch (_) {
              finish(reject, lineRequestError("後端回應不是有效 JSON，尚未確認是否完成", response.status, "", true));
            }
          },
          onerror: () => finish(reject, lineRequestError("無法連線到後端，尚未確認是否完成", 0, "", true)),
          ontimeout: () => finish(reject, lineRequestError("請求逾時，尚未確認後端是否完成", 0, "", true)),
          onabort: () => finish(reject, new DOMException("已取消", "AbortError")),
        });
      } catch (_) {
        // 不將含 Cookie 的請求物件或例外細節寫入 Console。
        finish(reject, new Error("無法建立後端請求"));
      }
    });
  }

  const SEND_KEY_PATTERN = /^[\x21-\x7e]{1,512}$/;
  const sendKeyStoreKey = (account) => SEND_KEY_STORE_PREFIX + encodeURIComponent(account);
  // 身份授權通過後存的發送 KEY；沒有或格式不符回空字串。
  function storedSendKey(account) {
    const key = account ? storeGet(sendKeyStoreKey(account), "") : "";
    return typeof key === "string" && SEND_KEY_PATTERN.test(key) ? key : "";
  }

  // 身份授權時輸入發送 KEY（預填此帳號已存的 KEY，可直接確認）；取消回 null。
  function askSendKey(account) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "loe-customers-dialog loe-key-dialog";
      dialog.setAttribute("aria-labelledby", "loe-auth-title");
      dialog.innerHTML = `
        <div class="loe-modal-head"><span id="loe-auth-title">身份授權</span><button type="button" class="loe-modal-close" aria-label="取消身份授權">×</button></div>
        <form class="loe-modal-body">
          <label for="loe-auth-key">後台帳號 <strong data-role="account"></strong> 的發送 KEY</label>
          <div class="loe-send-key-row"><input id="loe-auth-key" class="loe-input" type="password" autocomplete="off" spellcheck="false" autocapitalize="none" placeholder="貼上後台發放的 KEY"><button class="loe-mini" type="button" data-role="toggle" aria-label="顯示發送 KEY" aria-pressed="false">顯示</button></div>
          <div class="loe-customers-muted">KEY 由後台發放，有效期一個月。授權後會記在此瀏覽器，傳送時自動帶入，不必再輸入。</div>
          <div class="loe-customers-muted" data-role="error" role="alert"></div>
          <button class="loe-btn-primary" type="submit">授權</button>
        </form>`;
      const input = dialog.querySelector("#loe-auth-key");
      const toggle = dialog.querySelector('[data-role="toggle"]');
      dialog.querySelector('[data-role="account"]').textContent = account;
      input.value = storedSendKey(account);
      let result = null;
      toggle.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        toggle.textContent = show ? "隱藏" : "顯示";
        toggle.setAttribute("aria-label", `${show ? "隱藏" : "顯示"}發送 KEY`);
        toggle.setAttribute("aria-pressed", String(show));
      });
      dialog.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        const key = input.value.trim();
        if (!SEND_KEY_PATTERN.test(key)) {
          dialog.querySelector('[data-role="error"]').textContent = key ? "KEY 格式不符，請重新貼上後台發放的 KEY。" : "請輸入後台發放的發送 KEY。";
          return;
        }
        result = key;
        dialog.close();
      });
      dialog.querySelector(".loe-modal-close").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => { input.value = ""; dialog.remove(); resolve(result); }, { once: true });
      document.body.appendChild(dialog);
      dialog.showModal();
      input.focus();
    });
  }

  // 身份授權：輸入發送 KEY → 擷取 LINE cookie → 後端驗 KEY 通過才存 cookie → KEY 記在本機。取消回 { cancelled: true }。
  async function saveLineCookie() {
    const account = getDispatcher();
    const groupId = getOaId();
    if (!account) throw new Error("請先在轉發設定填寫後台帳號");
    const key = await askSendKey(account);
    if (key === null) return { cancelled: true };
    if (getDispatcher() !== account || getOaId() !== groupId)
      throw new Error("帳號已變更，請在目前帳號重新操作");
    const snapshot = await captureLineApiParams();
    if (!snapshot) throw new Error("Cookie 未擷取完成，請重試");
    if (getDispatcher() !== account || getOaId() !== groupId)
      throw new Error("帳號已變更，請在目前帳號重新操作");
    if (snapshot.missingCookies.length)
      throw new Error("缺少 " + snapshot.missingCookies.join(", ") +
        "；請在 Tampermonkey 進階設定將 Allow scripts to access cookies 設為 All，儲存後重新整理");
    const result = await lineBackendRequest("PUT",
      `/line-ext-cookie?account=${encodeURIComponent(account)}`,
      { extCookie: snapshot.params.Cookie }, undefined, { "X-Line-Send-Key": key });
    if (!result || result.account !== account || result.updated !== true)
      throw new Error("後端尚未確認 Cookie 儲存成功");
    storeSet(sendKeyStoreKey(account), key);
    return result;
  }

  async function syncLineCustomers() {
    const groupId = getOaId();
    // 只有完整讀完 LINE 所有分頁，才允許整份取代後端清單。
    const rows = await loadLineChatDirectory(true);
    if (!Array.isArray(rows)) throw new Error("LINE 名單未讀取完整，未上傳後端" + (lineChatDirectoryRun?.error ? `：${lineChatDirectoryRun.error}` : ""));
    if (getOaId() !== groupId) throw new Error("官方帳號已變更，未上傳名單");
    if (new Blob([JSON.stringify(rows)]).size > 8000000)
      throw new Error("完整名單超過 8 MB，未上傳；需要後端提供分批匯入功能");
    const result = await lineBackendRequest("POST",
      `/line-oa/${encodeURIComponent(groupId)}/customers`, rows);
    if (!result || result.groupId !== groupId || !Number.isInteger(result.count) ||
        result.count < 0 || typeof result.replaced !== "boolean" ||
        (rows.length > 0 && (!result.replaced || result.count !== rows.length)) ||
        (rows.length === 0 && result.replaced))
      throw new Error("後端回傳的名單結果不符，請重新讀取名單確認");
    return result;
  }

  async function fetchSavedLineCustomers(groupId, pageNum, pageSize, search, signal) {
    const query = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(pageSize) });
    if (search) query.set("search", search);
    const data = await lineBackendRequest("GET",
      `/line-oa/${encodeURIComponent(groupId)}/customers?${query}`, undefined, signal);
    const p = data?.pagination;
    if (data?.groupId !== groupId || !Array.isArray(data.customers) || !p ||
        p.currentPage !== pageNum || !Number.isInteger(p.pageSize) || p.pageSize < 1 || p.pageSize > 500 ||
        !Number.isInteger(p.totalItems) || p.totalItems < 0 ||
        !Number.isInteger(p.totalPages) || p.totalPages < 0 ||
        (p.totalItems > 0 && p.totalPages !== Math.ceil(p.totalItems / p.pageSize)) ||
        (p.totalItems === 0 && p.totalPages > 1) ||
        data.customers.length > p.pageSize)
      throw new Error("客戶清單或分頁資料格式不符");
    const seen = new Set();
    const customers = data.customers.map((row) => {
      if (!row || typeof row.chatId !== "string" || !row.chatId.trim() || seen.has(row.chatId))
        throw new Error("客戶清單缺少 chatId 或包含重複資料");
      seen.add(row.chatId);
      return { chatId: row.chatId, lineName: String(row.lineName || "（未提供名稱）"),
        avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : "" };
    });
    return { ...data, customers };
  }

  const LINE_JOB_TERMINAL = new Set(["completed", "completed_with_errors", "failed", "needs_review", "cancelled"]);
  const LINE_JOB_LABELS = {
    queued: "已入隊，等待傳送", running: "傳送中", cancelling: "正在取消", waiting_credentials: "等待更新 Cookie",
    completed: "全部傳送成功", completed_with_errors: "傳送完成，部分失敗", failed: "傳送失敗",
    needs_review: "有結果不明的訊息，請人工確認", cancelled: "已取消",
  };
  const LINE_DELIVERY_LABELS = { pending: "待處理", sending: "傳送中", sent: "成功", failed: "失敗", unknown: "結果不明", cancelled: "已取消" };
  const LINE_DELIVERY_ERRORS = {
    LINE_COOKIE_INVALID: "Cookie 失效", LINE_RATE_LIMITED: "發送頻率受限", LINE_NETWORK_ERROR: "連線失敗",
    LINE_REJECTED: "LINE 拒絕發送", LINE_RESULT_UNKNOWN: "無法確認是否已送出", WORKER_INTERRUPTED: "發送途中服務重新啟動",
    PRECEDING_MESSAGE_NOT_SENT: "前一則未送出，這則未發送",
    IMAGE_ASSET_UNAVAILABLE: "後端讀不到原圖", LINE_IMAGE_UPLOAD_FAILED: "圖片上傳失敗，這則未發送",
    COUPON_NOT_FOUND: "優惠券不存在或不屬於此官方帳號", COUPON_EXPIRED: "優惠券已到期",
    COUPON_UNAVAILABLE: "優惠券目前不可發送",
    CARD_TYPE_MESSAGE_NOT_FOUND: "多頁訊息已刪除或不屬於此官方帳號",
  };
  const LINE_INVALID_IMAGE_CODES = new Set(["IMAGE_ASSET_EXPIRED", "IMAGE_ASSET_NOT_FOUND"]);
  const LINE_SELECTION_ERROR_TYPES = {
    __proto__: null,
    INVALID_COUPON: "coupon", COUPON_NOT_FOUND: "coupon", COUPON_EXPIRED: "coupon", COUPON_UNAVAILABLE: "coupon",
    INVALID_CARD_TYPE_MESSAGE: "cardType", CARD_TYPE_MESSAGE_NOT_FOUND: "cardType",
  };
  // 這些素材驗證在 requestId 冪等查找後（發送 KEY 在查找前），明確表示原作業尚未建立。
  const LINE_INVALID_CONTENT_CODES = new Set(["COUPON_NOT_FOUND", "COUPON_EXPIRED", "COUPON_UNAVAILABLE", "CARD_TYPE_MESSAGE_NOT_FOUND"]);
  const lineMessageJobEntries = new Map();

  function createLineMessageJobView(container, groupId, account, isCurrent, onChange, sendAccess) {
    const key = `loe_message_job_v1::${encodeURIComponent(account)}::${groupId}`;
    if (!lineMessageJobEntries.has(key)) {
      const saved = storeGet(key, null);
      lineMessageJobEntries.set(key, { value: saved?.account === account && saved?.groupId === groupId ? saved : null,
        busy: false, notice: "", listeners: new Set() });
    }
    const entry = lineMessageJobEntries.get(key);
    // 已結束的作業保留結果供查看，不再鎖住下一次訊息的編輯區。
    const finished = value => !!value?.jobId && LINE_JOB_TERMINAL.has(value.status);
    const editable = value => !value || finished(value) || (value.rejected && !value.uncertain && !value.retrySameRequest);
    const locked = () => entry.busy || !editable(entry.value);
    const rootPath = `/line-oa/${encodeURIComponent(groupId)}/message-jobs`;
    let closed = false, timer = null, hideTimer = null, pollController = null, resultController = null;
    let toastVisible = !!entry.value && !finished(entry.value);
    let resultPage = 1, resultPages = 0, resultFilter = "failed", autoResultsJobId = "";
    const active = () => !closed && isCurrent();
    const persist = (value) => {
      storeSet(key, value);
      if (JSON.stringify(storeGet(key, null)) !== JSON.stringify(value)) throw new Error("無法保存傳送紀錄，尚未送出，請檢查瀏覽器儲存空間");
    };
    const notify = () => { for (const listener of entry.listeners) listener(); };
    const update = (value) => {
      entry.value = value;
      try { persist(value); } catch (_) { entry.notice = "無法保存目前進度，請保持此視窗開啟並聯絡後台協助"; }
      notify();
    };
    const jobPath = (value = entry.value) => `${rootPath}/${encodeURIComponent(value.jobId)}`;
    const statusPath = (value) => {
      const fallback = `${jobPath(value)}?account=${encodeURIComponent(account)}`;
      try {
        const url = new URL(value.statusUrl || fallback, API_BASE);
        if (url.origin === new URL(API_BASE).origin && url.pathname === jobPath(value) && url.searchParams.get("account") === account)
          return url.pathname + url.search;
      } catch (_) {}
      return fallback;
    };
    const validJob = (data, value) => {
      const names = ["total", "pending", "sending", "sent", "failed", "unknown", "cancelled"];
      if (!data || data.jobId !== value.jobId || data.groupId !== groupId ||
          data.requestId !== value.requestId || !Object.hasOwn(LINE_JOB_LABELS, data.status) ||
          !Number.isInteger(data.recipientCount) || data.recipientCount < 1 ||
          !Number.isInteger(data.excludedCount) || data.excludedCount < 0 || data.excludedCount > LINE_RECIPIENT_LIMIT ||
          !names.every(name => Number.isInteger(data.counts?.[name]) && data.counts[name] >= 0) ||
          names.slice(1).reduce((sum, name) => sum + data.counts[name], 0) !== data.counts.total)
        throw new Error("傳送進度格式不符，請重新整理進度");
      return data;
    };
    container.className = "loe-message-toast";
    container.setAttribute("aria-label", "訊息傳送通知");
    container.innerHTML = `
      <div class="loe-message-toast-head"><strong data-job="title" role="status" aria-live="polite"></strong><button class="loe-mini" type="button" data-job="dismiss" aria-label="關閉傳送通知">×</button></div>
      <progress data-job="progress" aria-label="傳送處理進度" max="1" value="0" hidden></progress>
      <div data-job="recipients" aria-live="polite" hidden></div>
      <div data-job="counts" aria-live="polite"></div>
      <div class="loe-customers-notice" data-job="notice" role="status" aria-live="polite" hidden></div>
      <div class="loe-customers-muted" data-job="send-gate" role="status" aria-live="polite" hidden></div>
      <div class="loe-customers-toolbar">
        <button type="button" class="loe-mini" data-job="retry">重試同一次傳送</button>
        <button type="button" class="loe-mini" data-job="refresh">重新整理進度</button>
        <button type="button" class="loe-mini" data-job="save-cookie">身份授權</button>
        <button type="button" class="loe-mini" data-job="resume">恢復傳送</button>
        <button type="button" class="loe-mini" data-job="cancel">取消尚未傳送</button>
      </div>
      <details data-job="details"><summary>查看詳情</summary>
      <div class="loe-customers-muted" data-job="id"></div>
      <p class="loe-customers-preview-text" data-job="pending-text" hidden></p>
      <div data-job="results" hidden>
        <div class="loe-customers-toolbar"><label>收件結果 <select data-job="filter" aria-label="收件結果篩選"><option value="failed">失敗</option><option value="unknown">結果不明</option><option value="sent">成功</option><option value="cancelled">已取消</option><option value="pending">待處理</option><option value="sending">傳送中</option></select></label><button class="loe-mini" type="button" data-job="results-reload">重新讀取結果</button></div>
        <div data-job="results-status" class="loe-customers-muted" role="status"></div>
        <div class="loe-message-results" data-job="results-list"></div>
        <div class="loe-customers-toolbar"><button class="loe-mini" type="button" data-job="results-prev">結果上一頁</button><span data-job="results-pages"></span><button class="loe-mini" type="button" data-job="results-next">結果下一頁</button></div>
      </div></details>`;
    const find = name => container.querySelector(`[data-job="${name}"]`);
    const refreshSendGate = () => {
      const value = entry.value;
      const needed = !!value?.payload || value?.status === "waiting_credentials";
      const error = needed ? sendAccess.error(value) : "";
      find("send-gate").textContent = error;
      find("send-gate").hidden = !error;
      for (const name of ["retry", "resume"]) find(name).disabled = entry.busy || !!pollController || !!error;
    };
    const schedule = () => {
      clearTimeout(timer); timer = null;
      const value = entry.value;
      if (active() && value?.jobId && !entry.busy && !pollController &&
          !LINE_JOB_TERMINAL.has(value.status) && value.status !== "waiting_credentials")
        timer = setTimeout(() => { timer = null; void refresh(); }, 2500);
    };
    const render = () => {
      if (!active()) return;
      const value = entry.value;
      container.hidden = !toastVisible || (!value && !entry.notice);
      find("title").textContent = value?.jobId ? LINE_JOB_LABELS[value.status] || "正在讀取進度" :
        value ? (entry.busy ? "正在提交傳送" : value.retrySameRequest ? "暫時無法建立作業" : value.rejected ? "傳送未受理" : "尚未確認是否已入隊") : "傳送提示";
      find("id").textContent = value ? `收件人：${(value.recipientCount || value.payload?.chatIds.length || 0).toLocaleString()} 位` : "";
      find("recipients").hidden = !value?.jobId;
      find("recipients").textContent = value?.jobId && Number.isInteger(value.recipientCount) ? `實際收件 ${value.recipientCount.toLocaleString()} 位` +
        (Number.isInteger(value.excludedCount) ? ` · 過濾名單 ${value.excludedCount.toLocaleString()} 位` : "") : "";
      const errorCode = value?.actionErrorCode || value?.errorCode;
      const missingFilter = value?.status === "waiting_credentials" && errorCode === "MESSAGE_JOB_FILTER_MISSING";
      const help = missingFilter ? "後台缺少此作業的過濾設定紀錄，無法恢復。請先確認已送結果並取消剩餘訊息，再重新建立作業。" :
        errorCode === "EXCLUSION_LIST_REQUIRED" ? "過濾名單已改為選填；目前後台仍要求至少一位，請聯絡管理員更新後再傳送。" :
        errorCode === "SEND_KEY_TOO_MANY_ATTEMPTS" ? "KEY 驗證失敗次數過多，請確認 KEY 正確後稍候一分鐘再試。" :
        errorCode?.startsWith("SEND_KEY_") ? (value.uncertain ? "請點「身份授權」輸入有效的發送 KEY，再重試同一次傳送以確認原作業結果。" :
          ["SEND_KEY_EXPIRED", "SEND_KEY_REVOKED"].includes(errorCode) ? "請向後台申請新的 KEY，點「身份授權」輸入後再傳送或恢復。" :
          "請點「身份授權」重新輸入屬於目前後台帳號的 KEY，再傳送或恢復。") :
        errorCode === "MESSAGE_JOB_SUBMIT_TOO_OFTEN" ? "請稍候一分鐘再手動重試；先前結果不明時，仍須沿用原本那次傳送。" :
        value?.status === "waiting_credentials" ? "請重新點「身份授權」，再按「恢復傳送」。只會繼續尚未傳送的訊息。" :
        value?.status === "needs_review" ? "請檢查結果不明的客戶，確認對方是否已收到；系統不會自動重送。" :
        value?.retrySameRequest ? "作業尚未建立。請稍後按「重試同一次傳送」，會沿用原本的內容與收件人。" :
        !value?.jobId && ["LINE_COOKIE_MISSING", "LINE_COOKIE_INVALID"].includes(value?.errorCode) ?
          (value.uncertain ? "請重新點「身份授權」，再重試同一次傳送以確認結果。" : "請重新點「身份授權」，再按「傳送」。") :
        value?.rejected && LINE_SELECTION_ERROR_TYPES[value.errorCode] ?
          `請重新讀取${LINE_SELECTION_ERROR_TYPES[value.errorCode] === "coupon" ? "優惠券" : "多頁訊息"}清單並重新選擇，再按「傳送」。` :
        value?.rejected && LINE_INVALID_IMAGE_CODES.has(value.errorCode) ? "請重新選圖或重新上傳，再按「傳送」。" :
        value?.rejected ? "可直接修改內容後，再按「傳送」。" :
        value?.payload && !entry.busy && !value.rejected ? "重試會沿用同一筆傳送與收件人，不會重複建立作業。" : "";
      find("notice").textContent = lineDisplayMessage([entry.notice || value?.actionErrorDetail || value?.errorDetail, help].filter(Boolean).join("\n"));
      find("notice").hidden = !find("notice").textContent;
      find("pending-text").hidden = !value?.payload;
      find("pending-text").textContent = value?.payload ? value.payload.messages.map(message =>
        message.type === "image" ? "圖片 1 張（已上傳，重試會使用同一張圖片）" :
        message.type === "coupon" ? "優惠券 1 張（重試會使用原優惠券）" :
        message.type === "cardType" ? "多頁訊息 1 組（重試會使用原多頁訊息）" : message.text).join("\n") : "";
      const counts = value?.counts;
      find("progress").hidden = !counts;
      find("counts").textContent = counts ? `共 ${counts.total.toLocaleString()} 則 · 成功 ${counts.sent}` +
        (counts.failed ? ` · 失敗 ${counts.failed}` : "") + (counts.unknown ? ` · 結果不明 ${counts.unknown}` : "") +
        (counts.cancelled ? ` · 已取消 ${counts.cancelled}` : "") +
        (counts.pending + counts.sending ? ` · 待完成 ${counts.pending + counts.sending}` : "") : "";
      if (counts) { find("progress").max = counts.total || 1; find("progress").value = counts.sent + counts.failed + counts.unknown + counts.cancelled; }
      const ended = LINE_JOB_TERMINAL.has(value?.status);
      find("retry").hidden = !value?.payload || (!!value.rejected && !value.retrySameRequest);
      find("refresh").hidden = !value?.jobId || (!entry.notice && Number.isInteger(value.excludedCount));
      const keyRejected = !!errorCode?.startsWith("SEND_KEY_") && errorCode !== "SEND_KEY_TOO_MANY_ATTEMPTS";
      find("save-cookie").hidden = !(value?.status === "waiting_credentials" || keyRejected || ["LINE_COOKIE_MISSING", "LINE_COOKIE_INVALID"].includes(value?.errorCode));
      find("resume").hidden = value?.status !== "waiting_credentials";
      find("cancel").hidden = !value?.jobId || ended || value.status === "cancelling";
      find("dismiss").hidden = locked();
      for (const name of ["retry", "save-cookie", "resume", "cancel"]) find(name).disabled = entry.busy || !!pollController;
      refreshSendGate();
      find("refresh").disabled = entry.busy || !!pollController;
      find("results").hidden = !value?.jobId;
      if (value?.jobId && ended && counts && autoResultsJobId !== value.jobId) {
        resultFilter = counts?.unknown ? "unknown" : counts?.failed ? "failed" : counts?.sent ? "sent" : "cancelled";
        find("filter").value = resultFilter;
        if (find("details").open) void loadResults(1);
      }
      clearTimeout(hideTimer);
      if (toastVisible && ["completed", "cancelled"].includes(value?.status) && !entry.notice && !find("details").open)
        hideTimer = setTimeout(() => { toastVisible = false; container.hidden = true; }, 6000);
      onChange();
      schedule();
    };
    async function refresh() {
      const value = entry.value;
      if (!active() || !value?.jobId || entry.busy || pollController) return;
      clearTimeout(timer); timer = null;
      const controller = pollController = new AbortController();
      render();
      try {
        const data = await lineBackendRequest("GET", statusPath(value), undefined, controller.signal);
        if (!active() || entry.value?.jobId !== value.jobId) return;
        const job = validJob(data, value);
        entry.notice = "";
        update({ ...value, ...job, ...(finished(job) ? { actionErrorCode: "", actionErrorDetail: "" } : {}) });
      } catch (error) {
        if (active() && error.name !== "AbortError") { entry.notice = error.message; }
      } finally {
        if (pollController === controller) pollController = null;
        render();
      }
    }
    async function submit() {
      const value = entry.value;
      if (!active() || entry.busy || !value?.payload) return;
      const accessError = sendAccess.error(value);
      if (accessError) { entry.notice = accessError; notify(); return; }
      const wasUncertain = value.uncertain;
      try { persist({ ...value, uncertain: true }); }
      catch (error) { entry.notice = error.message; notify(); return; }
      entry.busy = true; entry.notice = ""; notify();
      try {
        const data = await lineBackendRequest("POST", rootPath, value.payload, undefined, { "X-Line-Send-Key": sendAccess.key() });
        if (!data || typeof data.jobId !== "string" || !data.jobId || data.jobId.length > 128 ||
            !Object.hasOwn(LINE_JOB_LABELS, data.status) || !Number.isInteger(data.recipientCount) || data.recipientCount < 1 ||
            !Number.isInteger(data.excludedCount) || data.excludedCount < 0 || data.excludedCount > LINE_RECIPIENT_LIMIT)
          throw lineRequestError("作業回應格式不符，請重試同一次傳送以確認結果", 202, "", true);
        update({ account, groupId, requestId: value.requestId, jobId: data.jobId, statusUrl: data.statusUrl,
          status: data.status, recipientCount: data.recipientCount, messageCount: data.messageCount, reused: data.reused,
          excludedCount: data.excludedCount, excludedChatIds: value.payload.excludedChatIds });
        entry.notice = data.reused ? "已接回原本的傳送作業，沒有重複建立。" : "";
      } catch (error) {
        entry.notice = error.message;
        // 後端順序：提交限流 → 發送 KEY → 依 requestId 找既有作業 → 驗證素材。素材明確失效時可重新選擇並建立新作業；
        // KEY 在冪等查找之前，KEY 失效時無法確認原作業，換有效 KEY 重試同一次即可接回（KEY 不參與內容比對）。
        const invalidImage = (error.status === 404 && error.code === "IMAGE_ASSET_NOT_FOUND") ||
          (error.status === 409 && error.code === "IMAGE_ASSET_EXPIRED");
        const invalidContent = error.status === 422 && LINE_INVALID_CONTENT_CODES.has(error.code);
        // LINE_UNAVAILABLE 明確未建立作業，但契約要求保留原 requestId/body 重試。
        const retrySameRequest = error.status === 503 && error.code === "LINE_UNAVAILABLE";
        const storageRejected = error.status === 503 && error.code === "IMAGE_STORAGE_UNAVAILABLE";
        const uncertain = !invalidImage && !invalidContent && !retrySameRequest &&
          (!!wasUncertain || (!storageRejected && error.uncertain === true));
        update({ ...value, uncertain, rejected: !uncertain, retrySameRequest, errorCode: error.code || "", errorDetail: error.message });
      } finally { entry.busy = false; notify(); if (active() && entry.value?.jobId) void refresh(); }
    }
    async function action(kind) {
      const value = entry.value;
      if (!active() || entry.busy || !value?.jobId) return;
      if (kind === "resume" && value.status !== "waiting_credentials") return;
      if (kind === "resume" && sendAccess.error(value)) { entry.notice = sendAccess.error(value); notify(); return; }
      if (kind === "cancel" && (LINE_JOB_TERMINAL.has(value.status) || value.status === "cancelling")) return;
      clearTimeout(timer); timer = null;
      if (pollController) { pollController.abort(); pollController = null; }
      entry.busy = true; entry.notice = ""; notify();
      try {
        const data = await lineBackendRequest("POST", `${jobPath(value)}/${kind}`, { account }, undefined,
          kind === "resume" ? { "X-Line-Send-Key": sendAccess.key() } : {});
        // 恢復端點未承諾回傳完整進度，成功後以 GET 的結果為準。
        if (kind === "resume" && !data?.counts) {
          update({ ...value, actionErrorCode: "", actionErrorDetail: "" });
          entry.notice = "已要求恢復，正在更新進度…";
        } else update({ ...value, ...validJob(data, value), actionErrorCode: "", actionErrorDetail: "" });
      } catch (error) {
        entry.notice = error.message;
        update({ ...value, actionErrorCode: error.code || "", actionErrorDetail: error.message });
      }
      finally { entry.busy = false; notify(); if (active()) void refresh(); }
    }
    async function loadResults(page = 1) {
      const value = entry.value;
      if (!active() || !value?.jobId) return;
      autoResultsJobId = value.jobId;
      if (resultController) resultController.abort();
      const controller = resultController = new AbortController();
      find("results-status").textContent = "正在讀取收件結果…";
      find("results-list").replaceChildren();
      find("results-prev").disabled = find("results-next").disabled = true;
      const query = new URLSearchParams({ account, pageNum: String(page), pageSize: "50", status: resultFilter });
      try {
        const data = await lineBackendRequest("GET", `${jobPath(value)}/deliveries?${query}`, undefined, controller.signal);
        if (!active() || resultController !== controller || entry.value?.jobId !== value.jobId) return;
        const p = data?.pagination;
        if (data?.jobId !== value.jobId || !Array.isArray(data.deliveries) || !p || p.currentPage !== page ||
            !Number.isInteger(p.pageSize) || p.pageSize < 1 || p.pageSize > 500 || !Number.isInteger(p.totalItems) || p.totalItems < 0)
          throw new Error("收件結果格式不符，請重新讀取");
        resultPage = page; resultPages = Math.ceil(p.totalItems / p.pageSize);
        for (const row of data.deliveries) {
          const item = document.createElement("div"); item.className = "loe-message-result";
          item.textContent = `${row.lineName || "（未提供名稱）"}\n第 ${Number(row.messageIndex) + 1} 則 ${{ image: "圖片", text: "文字", coupon: "優惠券", cardType: "多頁訊息" }[row.messageType] || row.messageType} · ${LINE_DELIVERY_LABELS[row.status] || row.status}` +
            (row.errorCode ? ` · ${Object.hasOwn(LINE_DELIVERY_ERRORS, row.errorCode) ? LINE_DELIVERY_ERRORS[row.errorCode] : "發送失敗"}` : "") +
            (Number.isInteger(row.uploadAttempts) && row.uploadAttempts >= 0 ? ` · 上傳嘗試 ${row.uploadAttempts} 次` : "") +
            (Number.isInteger(row.attempts) && row.attempts >= 0 ? ` · 發送嘗試 ${row.attempts} 次` : "") +
            (typeof row.upstreamCode === "string" && row.upstreamCode ? ` · LINE 回應：${lineDisplayMessage(row.upstreamCode)}` : "");
          find("results-list").appendChild(item);
        }
        find("results-status").textContent = p.totalItems ? `共 ${p.totalItems.toLocaleString()} 則` : "沒有這類結果";
        find("results-pages").textContent = `第 ${resultPages ? page : 0} / ${resultPages} 頁`;
      } catch (error) {
        if (active() && resultController === controller && error.name !== "AbortError") {
          resultPages = 0; find("results-status").textContent = error.message; find("results-pages").textContent = "";
        }
      } finally {
        if (resultController === controller) {
          resultController = null;
          if (active()) {
            find("results-prev").disabled = resultPage <= 1 || !resultPages;
            find("results-next").disabled = resultPage >= resultPages;
          }
        }
      }
    }
    find("retry").addEventListener("click", () => void submit());
    find("refresh").addEventListener("click", () => void refresh());
    find("cancel").addEventListener("click", () => void action("cancel"));
    find("resume").addEventListener("click", () => void action("resume"));
    find("save-cookie").addEventListener("click", async () => {
      if (!active() || entry.busy) return;
      entry.busy = true; entry.notice = ""; notify();
      try {
        if ((await saveLineCookie()).cancelled) return;
        entry.notice = entry.value?.rejected && !entry.value.retrySameRequest ? "已授權，可直接按「傳送」。" : "已授權，請按恢復傳送；若尚未入隊，請重試同一次傳送。";
      } catch (error) { entry.notice = error.message; }
      finally { entry.busy = false; notify(); }
    });
    function clearPreviousView() {
      if (pollController) { pollController.abort(); pollController = null; }
      if (resultController) { resultController.abort(); resultController = null; }
      clearTimeout(timer); timer = null; clearTimeout(hideTimer);
      entry.notice = ""; autoResultsJobId = "";
      find("results-list").replaceChildren();
      find("details").open = false;
    }
    find("dismiss").addEventListener("click", () => {
      if (locked()) return;
      toastVisible = false; container.hidden = true; clearTimeout(hideTimer);
    });
    find("details").addEventListener("toggle", () => {
      if (!active()) return;
      if (find("details").open && entry.value?.jobId && autoResultsJobId !== entry.value.jobId) void loadResults(1);
      render();
    });
    find("filter").addEventListener("change", () => { resultFilter = find("filter").value; void loadResults(1); });
    find("results-reload").addEventListener("click", () => void loadResults(1));
    find("results-prev").addEventListener("click", () => { if (resultPage > 1) void loadResults(resultPage - 1); });
    find("results-next").addEventListener("click", () => { if (resultPage < resultPages) void loadResults(resultPage + 1); });
    entry.listeners.add(render);
    render();
    if (entry.value?.jobId) void refresh();
    return {
      locked,
      refreshSendGate,
      value: () => entry.value,
      invalidImageId: () => entry.value?.rejected && LINE_INVALID_IMAGE_CODES.has(entry.value.errorCode)
        ? entry.value.payload?.messages.find(message => message.type === "image")?.mediaId : null,
      begin(payload) {
        if (!active() || locked()) return;
        const other = storeGet(key, null);
        // 允許接續已結束的同一筆紀錄；其他分頁若建立新作業，先接回它而不另送。
        if (other && (other.requestId !== entry.value?.requestId || !editable(other))) {
          entry.value = other; toastVisible = true; render(); if (other.jobId) void refresh(); return;
        }
        const requestId = crypto.randomUUID();
        const body = { account, requestId, chatIds: [...payload.chatIds], excludedChatIds: [...payload.excludedChatIds],
          messages: payload.messages.map(message => ({ ...message })) };
        if (new Blob([JSON.stringify(body)]).size > 8000000) { toast("傳送內容超過可接收的大小"); return; }
        const value = { account, groupId, requestId, payload: body, uncertain: false };
        const accessError = sendAccess.error(value);
        if (accessError) { toast(accessError); return; }
        try { persist(value); } catch (error) { toast(error.message); return; }
        clearPreviousView();
        entry.value = value; toastVisible = true;
        void submit();
        return requestId;
      },
      close() {
        closed = true; clearTimeout(timer); clearTimeout(hideTimer);
        if (pollController) pollController.abort();
        if (resultController) resultController.abort();
        entry.listeners.delete(render);
        // 已提交的 POST 繼續等待結果並保存；關閉視窗不代表取消作業。
      },
    };
  }

  function closeLineCustomers() {
    if (lineCustomerDialog) lineCustomerDialog.close();
  }

  function openLineCustomers() {
    closeLineCustomers();
    const groupId = getOaId();
    const account = getDispatcher();
    if (!/^U[0-9a-f]{32}$/i.test(groupId)) throw new Error("請先選擇 LINE 官方帳號");
    const opener = document.activeElement;
    const state = { groupId, rows: [], selected: new Map(), files: [], page: 1, search: "",
      total: 0, pages: 0, loading: false, seq: 0, closed: false, pageController: null,
      allController: null, searchTimer: null, updatedAt: null, pendingRequestId: null,
      coupons: [], coupon: null, couponController: null, couponTimer: null, couponsLoaded: false,
      cards: [], card: null, cardController: null, cardsLoaded: false, messageType: "text", pendingType: null,
      handledSelectionError: null, excluded: new Map(), restoredFilterRequestId: null, syncing: false,
      skipGroups: storeGet(SKIP_GROUP_CHATS_KEY, true) !== false };
    let jobView = null;
    const dialog = document.createElement("dialog");
    dialog.className = "loe-customers-dialog";
    dialog.setAttribute("aria-labelledby", "loe-customers-title");
    dialog.innerHTML = `
      <div class="loe-modal-head"><span id="loe-customers-title">群發訊息 - 懶惰蟲</span><button type="button" class="loe-modal-close" aria-label="關閉群發訊息">×</button></div>
      <div class="loe-customers-layout">
        <section class="loe-customers-panel">
          <div class="loe-customers-account-head"><div class="loe-customers-section-title" data-role="account-name"></div><button class="loe-mini loe-customers-sync" type="button" data-role="reload">${ic("refresh")}<span data-role="sync-label">同步客戶</span></button></div>
          <form class="loe-customers-search"><input class="loe-input" type="search" aria-label="搜尋客戶名稱" placeholder="搜尋 LINE 名稱"><button class="loe-mini" type="submit">搜尋</button></form>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="all">全選所有人</button>
            <button class="loe-mini" type="button" data-role="clear">清除已選</button>
          </div>
          <div class="loe-customers-muted">全選所有人會選取此官方帳號的全部客戶，包含所有分頁，不受搜尋條件影響。</div>
          <div class="loe-customers-muted">不想發送的客戶，請點右側「過濾」；全選也會保留過濾設定。</div>
          <div class="loe-customers-status" role="status" aria-live="polite"></div>
          <div class="loe-customers-list" aria-label="客戶列表"></div>
          <div class="loe-customers-toolbar"><button class="loe-mini" type="button" data-role="prev">上一頁</button><span data-role="pages" class="loe-customers-muted"></span><button class="loe-mini" type="button" data-role="next">下一頁</button></div>
          <div class="loe-customers-muted" data-role="updated"></div>
        </section>
        <section class="loe-customers-panel loe-customers-compose">
          <div class="loe-customers-section-title">編輯訊息</div>
          <div class="loe-customers-selection" data-role="selected" aria-live="polite">已選 0 位客戶</div>
          <div class="loe-customers-muted">翻頁或搜尋會保留已勾選的客戶。</div>
          <div class="loe-message-types" role="radiogroup" aria-label="發送類型">
            ${[["text", "文字"], ["image", "圖片"], ["coupon", "優惠券"], ["cardType", "多頁訊息"]].map(([value, label]) =>
              `<label><input type="radio" name="loe-message-type" value="${value}" ${value === "text" ? "checked" : ""}><span>${label}</span></label>`).join("")}
          </div>
          <div data-message-panel="text">
          <label for="loe-customers-text">文字訊息</label>
          <textarea id="loe-customers-text" class="loe-textarea" maxlength="5000" placeholder="輸入要傳送的文字"></textarea>
          <div class="loe-customers-muted" data-role="text-count">0 / 5000 字</div>
          </div>
          <div data-message-panel="image" hidden>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="image-pick" aria-describedby="loe-customers-file-name">選擇圖片</button>
            <span id="loe-customers-file-name" class="loe-customers-muted" data-role="image-name">尚未選擇圖片</span>
            <input id="loe-customers-files" type="file" accept="image/jpeg,image/png" aria-label="選擇圖片" hidden>
          </div>
          <div class="loe-customers-muted">每次最多一張 JPG／PNG 圖片，重新選圖會替換原圖。</div>
          <div class="loe-customers-images" data-role="images"></div>
          <div class="loe-customers-notice" data-role="image-status" role="status" aria-live="polite" hidden></div>
          <button class="loe-mini" type="button" data-role="image-retry" hidden>重新上傳圖片</button>
          <div class="loe-customers-muted">選圖後會先上傳，按「傳送」即發送給已勾選的客戶。</div>
          </div>
          <div data-message-panel="coupon" hidden>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="coupon-load">重新讀取優惠券</button>
            <button class="loe-mini" type="button" data-role="coupon-remove" hidden>移除優惠券</button>
          </div>
          <div class="loe-customers-muted" data-role="coupon-status" role="status" aria-live="polite">切換至優惠券時會自動讀取清單。</div>
          <div class="loe-customers-selection" data-role="coupon-selected" aria-live="polite"></div>
          <div class="loe-coupon-list" data-role="coupons" role="radiogroup" aria-label="選擇一張優惠券" hidden></div>
          </div>
          <div data-message-panel="cardType" hidden>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="card-load">重新讀取多頁訊息</button>
            <button class="loe-mini" type="button" data-role="card-remove" hidden>移除多頁訊息</button>
          </div>
          <div class="loe-customers-muted" data-role="card-status" role="status" aria-live="polite">切換至多頁訊息時會自動讀取清單。</div>
          <div class="loe-customers-selection" data-role="card-selected" aria-live="polite"></div>
          <div class="loe-coupon-list" data-role="cards" role="radiogroup" aria-label="選擇一組多頁訊息" hidden></div>
          <div class="loe-card-preview" data-role="card-preview" role="region" aria-label="多頁訊息內容預覽" tabindex="0" hidden></div>
          <div class="loe-customers-muted" data-role="card-preview-note" hidden>可左右捲動查看圖片與文字摘要，實際版面以 LINE 顯示為準。</div>
          </div>
          <label class="loe-customers-muted"><input type="checkbox" data-role="skip-groups"> 群組不發送（過濾所有 C 開頭的群組聊天）</label>
          <div class="loe-send-requirements" role="group" aria-label="發送設定">
            <div class="loe-send-requirement">
              <div class="loe-send-requirement-head"><strong>1. 過濾名單 <small>（選填・不發送）</small></strong><span class="loe-send-badge" data-role="filter-badge">未設定（選填）</span></div>
              <div class="loe-customers-muted">有不想發送的對象再加入；留空不另行排除客戶。可從客戶列表點「過濾」，或貼上後台提供的名單。</div>
              <div class="loe-excluded-list" data-role="excluded-list" aria-label="不發送的客戶"></div>
              <button class="loe-mini" type="button" data-role="filter-clear" hidden>清空過濾名單</button>
              <details data-role="filter-import"><summary>貼上過濾名單</summary>
                <input class="loe-input" type="password" data-role="filter-input" aria-label="匯入過濾名單" autocomplete="off" spellcheck="false" placeholder="貼上名單，內容將隱藏">
                <button class="loe-mini" type="button" data-role="filter-add">加入過濾名單</button>
              </details>
              <div class="loe-customers-muted" data-role="filter-status" role="status" aria-live="polite"></div>
            </div>
            <div class="loe-send-requirement">
              <div class="loe-send-requirement-head"><strong>2. 發送 KEY</strong><span class="loe-send-badge" data-role="key-badge">尚未授權</span></div>
              <div class="loe-customers-muted">在「身份授權」輸入後台發放的 KEY（有效期一個月），傳送時自動帶入。</div>
              <button class="loe-mini" type="button" data-role="authorize">身份授權</button>
            </div>
          </div>
          <div class="loe-send-ready" data-role="send-ready" role="status" aria-live="polite"></div>
          <button class="loe-btn-primary" type="button" data-role="send">傳送</button>
        </section>
      </div>
      <div data-role="job" hidden></div>`;
    const find = (role) => dialog.querySelector(`[data-role="${role}"]`);
    const searchInput = dialog.querySelector('input[type="search"]');
    const textInput = dialog.querySelector("#loe-customers-text");
    const fileInput = dialog.querySelector('input[type="file"]');
    const status = dialog.querySelector(".loe-customers-status");
    const list = dialog.querySelector(".loe-customers-list");
    find("account-name").textContent = getOaName() || "目前官方帳號";
    const current = () => !state.closed && getOaId() === groupId && getDispatcher() === account;
    // LINE chatId：U＝個人、C＝群組聊天、R＝多人聊天室；「群組不發送」開啟時剔除 C 開頭
    const isGroupChat = id => id.startsWith("C");
    const effectiveChatIds = () => [...state.selected.keys()]
      .filter(id => !state.excluded.has(id) && !(state.skipGroups && isGroupChat(id)));
    const sendKey = () => storedSendKey(account);
    const sendGateError = (job) => {
      const ids = job ? (job.payload?.excludedChatIds || job.excludedChatIds) : [...state.excluded.keys()];
      if (job?.jobId) {
        if (job.actionErrorCode === "MESSAGE_JOB_FILTER_MISSING")
          return "後台缺少此作業的過濾設定紀錄，請先確認已送結果並取消剩餘訊息，再重新建立作業。";
        if (!Number.isInteger(job.excludedCount) || job.excludedCount < 0 || job.excludedCount > LINE_RECIPIENT_LIMIT)
          return "請先重新整理進度，確認後台已保存過濾名單。";
      } else if (!Array.isArray(ids))
        return "這筆作業缺少原始過濾設定紀錄，請先向後台確認原作業結果，再重新建立作業。";
      if (!job?.jobId && (ids.length > LINE_RECIPIENT_LIMIT || ids.some(id => !/^U[0-9a-f]{32}$/.test(id)))) return "過濾名單格式不符，請重新設定。";
      if (!job && find("filter-input").value.trim()) return "貼上的名單尚未加入，請按「加入過濾名單」或清除輸入。";
      if (!sendKey()) return "請先點「身份授權」輸入後台發放的發送 KEY。";
      return "";
    };
    const renderExcluded = () => {
      const container = find("excluded-list");
      container.replaceChildren();
      // 大量匯入時保持畫面可操作；完整名單仍參與過濾。
      for (const [index, [id, customer]] of [...state.excluded].slice(0, 100).entries()) {
        const button = document.createElement("button");
        button.type = "button"; button.className = "loe-mini";
        const name = customer.lineName || `未命名客戶 ${index + 1}`;
        button.textContent = `${name} ×`;
        button.setAttribute("aria-label", `移除過濾 ${name}`);
        button.addEventListener("click", () => {
          if (!current() || jobView?.locked() || state.allController || state.syncing) return;
          state.excluded.delete(id); renderExcluded(); updateControls();
        });
        container.appendChild(button);
      }
      if (state.excluded.size > 100) {
        const more = document.createElement("span"); more.className = "loe-customers-muted";
        more.textContent = `另有 ${(state.excluded.size - 100).toLocaleString()} 位，全部都會過濾。`;
        container.appendChild(more);
      }
    };
    const setStatus = (message, error = false) => {
      status.textContent = lineDisplayMessage(message);
      status.dataset.error = String(error);
    };
    const imageReady = () => !state.files.length || (state.files[0].status === "ready" &&
      state.files[0].asset?.mediaId && Date.parse(state.files[0].asset.expiresAt) > Date.now());
    const updateControls = () => {
      const job = jobView?.value();
      const rejectedType = job?.rejected && !job.uncertain && LINE_SELECTION_ERROR_TYPES[job.errorCode];
      if (rejectedType && state.handledSelectionError !== job.requestId &&
          job.payload?.messages.some(message => message.type === rejectedType)) {
        state.handledSelectionError = job.requestId;
        if (rejectedType === "coupon") {
          state.couponController?.abort(); state.couponController = null;
          state.coupon = null; state.coupons = []; state.couponsLoaded = false; clearTimeout(state.couponTimer);
          find("coupons").replaceChildren(); find("coupons").hidden = true;
          find("coupon-status").textContent = "優惠券未受理，請重新讀取清單並重新選擇。";
        } else {
          state.cardController?.abort(); state.cardController = null;
          state.card = null; state.cards = []; state.cardsLoaded = false; renderCardPreview();
          find("cards").replaceChildren(); find("cards").hidden = true;
          find("card-status").textContent = "多頁訊息未受理，請重新讀取清單並重新選擇。";
        }
      }
      if (state.pendingRequestId && job?.requestId === state.pendingRequestId && job.status === "completed") {
        state.pendingRequestId = null;
        if (state.pendingType === "text") textInput.value = "";
        if (state.pendingType === "image") {
          for (const item of state.files) releaseImage(item);
          state.files = []; renderImages();
        }
        if (state.pendingType === "coupon") { state.coupon = null; clearTimeout(state.couponTimer); }
        if (state.pendingType === "cardType") { state.card = null; renderCardPreview(); }
        state.pendingType = null;
      }
      const allBusy = !!state.allController || state.syncing;
      const locked = jobView?.locked() || false;
      if (locked && job?.requestId && state.restoredFilterRequestId !== job.requestId) {
        const ids = job.payload?.excludedChatIds || job.excludedChatIds;
        state.excluded = new Map((Array.isArray(ids) ? ids : []).map(id => [id, state.excluded.get(id) || { chatId: id }]));
        state.restoredFilterRequestId = job.requestId;
        find("filter-input").value = "";
        renderExcluded();
      }
      if (locked && job?.jobId && job.excludedCount === 0 && state.excluded.size) {
        state.excluded.clear(); renderExcluded();
      }
      const item = state.files[0];
      if (item?.asset && jobView?.invalidImageId() === item.asset.mediaId) {
        item.asset = null; item.status = "error";
        item.error = "圖片已失效，請重新選圖或重新上傳。";
        clearTimeout(item.expiryTimer);
      }
      if (!locked && item?.status === "ready" && !imageReady()) {
        item.status = "expired"; item.error = "圖片已過期，請重新選圖或重新上傳。";
      }
      find("selected").textContent = `已選 ${state.selected.size.toLocaleString()} 位客戶`;
      const effective = effectiveChatIds();
      const filteredCount = state.selected.size - effective.length;
      const skippedGroups = state.skipGroups ? [...state.selected.keys()].filter(id => isGroupChat(id) && !state.excluded.has(id)).length : 0;
      const filterCount = locked && job?.jobId && Number.isInteger(job.excludedCount) ? job.excludedCount : state.excluded.size;
      const filterReady = filterCount > 0;
      find("filter-badge").textContent = filterReady ? `已設定 ${filterCount.toLocaleString()} 位` : "未設定（選填）";
      find("filter-badge").dataset.ready = filterReady ? "true" : "optional";
      const keyReady = !!sendKey();
      find("key-badge").textContent = keyReady ? "已授權" : "尚未授權";
      find("key-badge").dataset.ready = String(keyReady);
      find("filter-input").disabled = find("filter-add").disabled = locked || allBusy;
      find("filter-clear").hidden = !state.excluded.size;
      find("skip-groups").checked = state.skipGroups;
      find("skip-groups").disabled = locked || allBusy;
      find("filter-clear").disabled = locked || allBusy;
      find("excluded-list").querySelectorAll("button").forEach(button => { button.disabled = locked || allBusy; });
      find("prev").disabled = state.loading || allBusy || state.page <= 1;
      find("next").disabled = state.loading || allBusy || state.page >= state.pages;
      find("pages").textContent = `第 ${state.pages ? state.page : 0} / ${state.pages} 頁 · 符合 ${state.total.toLocaleString()} 人`;
      find("all").disabled = locked || state.syncing || (!allBusy && state.loading);
      find("all").textContent = state.allController ? "取消全選讀取" : "全選所有人";
      find("clear").disabled = locked || state.syncing || (!state.selected.size && !allBusy);
      find("reload").disabled = locked || allBusy || state.loading;
      find("sync-label").textContent = state.syncing ? "同步中…" : "同步客戶";
      searchInput.disabled = dialog.querySelector('.loe-customers-search button').disabled = state.syncing;
      const hasContent = state.messageType === "text" ? !!textInput.value.trim() :
        state.messageType === "image" ? !!state.files.length && imageReady() :
        state.messageType === "coupon" ? lineCouponAvailable(state.coupon) : !!state.card;
      const gateError = sendGateError();
      find("send").disabled = locked || allBusy || !effective.length || !hasContent || !!gateError;
      find("send-ready").textContent = locked ? "目前作業使用提交時的收件人與過濾名單，編輯暫時鎖定。" :
        `已選 ${state.selected.size.toLocaleString()} 位 − 過濾 ${filteredCount.toLocaleString()} 位` +
        (skippedGroups ? `（含群組 ${skippedGroups.toLocaleString()} 個）` : "") + ` = 實際發送 ${effective.length.toLocaleString()} 位。` +
        (gateError ? ` ${gateError}` : !effective.length ? " 請選擇至少一位未被過濾的客戶。" : !hasContent ? " 請完成訊息內容。" : " 可以傳送。KEY 將交由後台驗證。");
      jobView?.refreshSendGate();
      dialog.querySelectorAll('[name="loe-message-type"]').forEach(input => {
        input.checked = input.value === state.messageType; input.disabled = locked;
      });
      dialog.querySelectorAll('[data-message-panel]').forEach(panel => {
        panel.hidden = panel.dataset.messagePanel !== state.messageType;
      });
      find("card-load").disabled = locked || !!state.cardController;
      find("card-remove").hidden = !state.card;
      find("card-remove").disabled = locked;
      find("card-selected").textContent = state.card ? `已選：${state.card.title}（${lineCardPages(state.card).length} 張卡片）` : "";
      find("cards").querySelectorAll('input[type="radio"]').forEach(input => {
        input.checked = String(state.card?.id) === input.value;
        input.disabled = locked;
      });
      find("coupon-load").disabled = locked || !!state.couponController;
      find("coupon-remove").hidden = !state.coupon;
      find("coupon-remove").disabled = locked;
      find("coupon-selected").textContent = state.coupon ? `已選：${state.coupon.title}` +
        (lineCouponAvailable(state.coupon) ? "" : " — 目前不可發送，請移除或重新選擇") : "";
      find("coupons").querySelectorAll('input[type="radio"]').forEach(input => {
        const coupon = state.coupons.find(item => String(item.couponId) === input.value);
        input.checked = state.coupon?.couponId === coupon?.couponId;
        input.disabled = locked || !lineCouponAvailable(coupon);
      });
      textInput.disabled = fileInput.disabled = find("image-pick").disabled = locked;
      find("image-pick").textContent = item ? "更換圖片" : "選擇圖片";
      find("image-name").textContent = item ? item.file.name : "尚未選擇圖片";
      find("images").querySelectorAll("button").forEach(button => { button.disabled = locked; });
      find("image-status").hidden = !item;
      find("image-status").textContent = !item ? "" : item.status === "uploading" ? "圖片上傳中…" :
        item.status === "ready" ? "圖片已上傳，按「傳送」即可發給客戶。" : item.error;
      find("image-status").dataset.error = String(!!item && ["error", "expired"].includes(item.status));
      find("image-retry").hidden = !item || !["error", "expired"].includes(item.status);
      find("image-retry").disabled = locked;
      find("text-count").textContent = `${textInput.value.length} / 5000 字`;
      list.querySelectorAll('input[type="checkbox"]').forEach((box) => {
        box.checked = state.selected.has(box.value);
        box.disabled = locked || allBusy;
        const excluded = state.excluded.has(box.value);
        const row = box.closest(".loe-customer-row"); row.dataset.excluded = String(excluded);
        const button = row.querySelector("button");
        button.textContent = excluded ? "取消過濾" : "過濾";
        button.setAttribute("aria-pressed", String(excluded));
        button.disabled = locked || allBusy;
      });
    };
    const renderRows = () => {
      list.replaceChildren();
      if (!state.rows.length) {
        const empty = document.createElement("div");
        empty.className = "loe-customers-empty";
        empty.textContent = state.loading ? "讀取客戶清單中…" :
          (state.search ? "沒有符合的客戶" : "尚無客戶清單，請點上方「同步客戶」");
        list.appendChild(empty);
      }
      for (const customer of state.rows) {
        const row = document.createElement("div");
        row.className = "loe-customer-row";
        const select = document.createElement("label"); select.className = "loe-customer-select";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.value = customer.chatId;
        check.setAttribute("aria-label", `選擇 ${customer.lineName}`);
        check.addEventListener("change", () => {
          if (!current() || jobView?.locked() || state.allController || state.syncing) { updateControls(); return; }
          if (check.checked) state.selected.set(customer.chatId, customer);
          else state.selected.delete(customer.chatId);
          updateControls();
        });
        const avatar = document.createElement("img");
        avatar.className = "loe-customer-avatar";
        avatar.alt = "";
        avatar.loading = "lazy";
        avatar.referrerPolicy = "no-referrer";
        try {
          const url = new URL(customer.avatarUrl);
          if (url.protocol === "https:") avatar.src = url.href;
        } catch (_) {}
        avatar.addEventListener("error", () => avatar.removeAttribute("src"), { once: true });
        const info = document.createElement("span");
        info.className = "loe-customer-info";
        const name = document.createElement("div");
        name.className = "loe-customer-name";
        name.textContent = customer.lineName;
        info.appendChild(name);
        select.append(check, avatar, info);
        const filter = document.createElement("button"); filter.type = "button"; filter.className = "loe-mini";
        filter.setAttribute("aria-label", `過濾 ${customer.lineName}`);
        filter.addEventListener("click", () => {
          if (!current() || jobView?.locked() || state.allController || state.syncing) return;
          if (state.excluded.has(customer.chatId)) state.excluded.delete(customer.chatId);
          else if (state.excluded.size >= LINE_RECIPIENT_LIMIT) { toast("過濾名單最多 50,000 位"); return; }
          else state.excluded.set(customer.chatId, customer);
          renderExcluded(); updateControls();
        });
        row.append(select, filter);
        list.appendChild(row);
      }
      updateControls();
    };
    const stopAll = () => {
      if (state.allController) state.allController.abort();
      state.allController = null;
    };
    async function loadPage(page = 1) {
      stopAll();
      if (state.pageController) state.pageController.abort();
      const controller = state.pageController = new AbortController();
      const seq = ++state.seq;
      state.loading = true;
      state.rows = [];
      renderRows();
      setStatus("正在讀取後端客戶清單…");
      try {
        const data = await fetchSavedLineCustomers(groupId, page, LINE_CUSTOMER_PAGE_SIZE, state.search, controller.signal);
        if (!current() || seq !== state.seq) return;
        state.rows = data.customers;
        state.page = data.pagination.currentPage;
        state.pages = data.pagination.totalPages;
        state.total = data.pagination.totalItems;
        state.updatedAt = data.updatedAt || null;
        find("updated").textContent = data.updatedAt ? `清單更新時間：${new Date(data.updatedAt).toLocaleString()}` : "尚未同步過客戶清單";
        setStatus(`本頁 ${state.rows.length} 位客戶`);
        return true;
      } catch (error) {
        if (!current() || seq !== state.seq || error.name === "AbortError") return;
        state.total = state.pages = 0;
        setStatus(error.message, true);
        return false;
      } finally {
        if (current() && seq === state.seq) {
          state.loading = false;
          renderRows();
        }
      }
    }
    async function selectAll() {
      if (!current() || jobView?.locked() || state.syncing) return;
      if (state.allController) { stopAll(); updateControls(); setStatus("已取消，保留原本勾選"); return; }
      const controller = state.allController = new AbortController();
      const collected = new Map();
      let total, pages, updatedAt;
      updateControls();
      try {
        for (let page = 1; ; page++) {
          const data = await fetchSavedLineCustomers(groupId, page, 500, "", controller.signal);
          if (!current() || state.allController !== controller) return;
          if (page === 1) {
            total = data.pagination.totalItems;
            pages = data.pagination.totalPages;
            updatedAt = data.updatedAt || null;
            if (total > LINE_RECIPIENT_LIMIT) throw new Error("一次最多選 50,000 位客戶，請改為手動勾選收件人");
          } else if (total !== data.pagination.totalItems || pages !== data.pagination.totalPages || updatedAt !== (data.updatedAt || null)) {
            throw new Error("讀取期間客戶名單已更新，請重新全選");
          }
          for (const row of data.customers) collected.set(row.chatId, row);
          setStatus(`正在全選：已讀 ${collected.size.toLocaleString()} / ${total.toLocaleString()} 人`);
          if (page >= pages) break;
          if (!data.customers.length) throw new Error("分頁資料不完整，未套用全選");
        }
        if (collected.size !== total) throw new Error("客戶總數不符，未套用全選，請重新讀取");
        state.selected = collected;
        setStatus(`已全選所有 ${total.toLocaleString()} 位客戶`);
      } catch (error) {
        if (current() && state.allController === controller && error.name !== "AbortError")
          setStatus(error.message, true);
      } finally {
        if (state.allController === controller) { state.allController = null; updateControls(); }
      }
    }
    const runSearch = () => {
      if (!current() || state.syncing) return;
      clearTimeout(state.searchTimer);
      state.search = searchInput.value.trim();
      void loadPage(1);
    };
    dialog.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); runSearch(); });
    searchInput.addEventListener("input", () => {
      if (!current() || state.syncing) return;
      clearTimeout(state.searchTimer);
      stopAll();
      if (state.pageController) state.pageController.abort();
      ++state.seq;
      state.loading = true;
      state.rows = [];
      renderRows();
      state.searchTimer = setTimeout(runSearch, 300);
    });
    find("prev").addEventListener("click", () => void loadPage(state.page - 1));
    find("next").addEventListener("click", () => void loadPage(state.page + 1));
    find("reload").addEventListener("click", async () => {
      if (!current() || jobView?.locked() || state.syncing || state.allController || state.loading) return;
      state.syncing = true; clearTimeout(state.searchTimer);
      setStatus("正在同步 LINE 客戶清單…"); updateControls();
      try {
        const result = await syncLineCustomers();
        if (!current()) return;
        state.search = searchInput.value.trim();
        const refreshed = await loadPage(1);
        if (current() && refreshed) setStatus(result.replaced ? `已同步 ${result.count.toLocaleString()} 位客戶` :
          `LINE 清單為空，保留原本 ${result.count.toLocaleString()} 位客戶`);
      } catch (error) {
        if (current()) setStatus(error.message || "同步失敗，請稍後重試", true);
      } finally {
        state.syncing = false;
        if (current()) updateControls();
      }
    });
    find("all").addEventListener("click", () => void selectAll());
    find("clear").addEventListener("click", () => {
      if (!current() || jobView?.locked()) return;
      stopAll(); state.selected.clear(); updateControls();
    });
    find("filter-input").addEventListener("input", () => { find("filter-status").textContent = ""; updateControls(); });
    // 密碼欄位隱藏匯入內容；貼上多行名單時先保留分隔，避免換行被 input 移除。
    find("filter-input").addEventListener("paste", event => {
      if (!event.clipboardData || find("filter-input").disabled) return;
      event.preventDefault();
      const input = find("filter-input");
      input.setRangeText(event.clipboardData.getData("text").replace(/[\r\n]+/g, ","), input.selectionStart, input.selectionEnd, "end");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    find("filter-add").addEventListener("click", () => {
      if (!current() || jobView?.locked() || state.allController || state.syncing) return;
      const raw = find("filter-input").value.trim();
      if (!raw) { find("filter-status").textContent = "請先貼上要過濾的名單。"; return; }
      const ids = raw.split(/[\s,，;；]+/).filter(Boolean);
      if (ids.some(id => !/^U[0-9a-f]{32}$/i.test(id))) {
        find("filter-status").textContent = "名單格式不符，尚未加入任何資料。請使用後台提供的名單，或直接從客戶列表選擇。"; return;
      }
      const normalized = [...new Set(ids.map(id => `U${id.slice(1).toLowerCase()}`))];
      const combined = new Set([...state.excluded.keys(), ...normalized]);
      if (combined.size > LINE_RECIPIENT_LIMIT) { find("filter-status").textContent = "過濾名單最多 50,000 位，尚未加入。"; return; }
      const known = new Map([...state.selected, ...state.rows.map(row => [row.chatId, row])]);
      for (const id of normalized) if (!state.excluded.has(id)) state.excluded.set(id, known.get(id) || { chatId: id });
      find("filter-input").value = "";
      find("filter-status").textContent = `已加入名單，重複對象自動合併。共 ${state.excluded.size.toLocaleString()} 位不發送。`;
      renderExcluded(); updateControls();
    });
    find("skip-groups").addEventListener("change", (event) => {
      state.skipGroups = event.target.checked;
      storeSet(SKIP_GROUP_CHATS_KEY, state.skipGroups);
      updateControls();
    });
    find("filter-clear").addEventListener("click", () => {
      if (!current() || jobView?.locked() || state.allController || state.syncing) return;
      state.excluded.clear(); find("filter-status").textContent = ""; renderExcluded(); updateControls();
    });
    find("authorize").addEventListener("click", async () => {
      if (!current()) return;
      find("authorize").disabled = true;
      try {
        const result = await saveLineCookie();
        if (!result.cancelled) toast(`已授權至 ${result.account}`);
      } catch (error) { toast(error.message || "身份授權失敗", "error", 6000); }
      finally { find("authorize").disabled = false; updateControls(); }
    });
    textInput.addEventListener("input", updateControls);
    function releaseImage(item) {
      clearTimeout(item.expiryTimer);
      item.controller?.abort(); item.controller = null;
      URL.revokeObjectURL(item.url);
    }
    async function uploadImage(item) {
      if (!current() || jobView?.locked() || state.files[0] !== item) return;
      item.controller?.abort(); clearTimeout(item.expiryTimer);
      const controller = item.controller = new AbortController();
      item.status = "uploading"; item.asset = null; item.error = "";
      updateControls();
      try {
        const form = new FormData();
        form.append("file", item.file);
        const data = await lineBackendRequest("POST",
          `/line-oa/${encodeURIComponent(groupId)}/message-assets?account=${encodeURIComponent(account)}`,
          form, controller.signal);
        if (!current() || state.files[0] !== item || item.controller !== controller) return;
        const expiry = Date.parse(data?.expiresAt);
        if (!data || typeof data.mediaId !== "string" || !data.mediaId.trim() ||
            !["image/png", "image/jpeg"].includes(data.contentType) ||
            !Number.isInteger(data.byteSize) || data.byteSize <= 0 || !Number.isFinite(expiry))
          throw new Error("圖片上傳回應格式不符，請重新上傳");
        if (expiry <= Date.now()) throw new Error("圖片已過期，請重新上傳");
        item.asset = data; item.status = "ready";
        item.expiryTimer = setTimeout(() => {
          if (current() && state.files[0] === item) updateControls();
        }, Math.min(expiry - Date.now() + 1, 2147483647));
      } catch (error) {
        if (!current() || state.files[0] !== item || item.controller !== controller || error.name === "AbortError") return;
        item.status = "error"; item.error = error.message;
      } finally {
        if (item.controller === controller) {
          item.controller = null;
          if (current() && state.files[0] === item) updateControls();
        }
      }
    }
    find("image-retry").addEventListener("click", () => {
      if (state.files[0]) void uploadImage(state.files[0]);
    });
    dialog.querySelectorAll('[name="loe-message-type"]').forEach(input => {
      input.addEventListener("change", () => {
        if (!current() || jobView?.locked()) { updateControls(); return; }
        state.messageType = input.value; updateControls();
        // 同視窗已載入的清單保留選擇；失敗後切回可重試，讀取中不重複請求。
        if (state.messageType === "coupon" && !state.couponsLoaded) void loadCoupons();
        if (state.messageType === "cardType" && !state.cardsLoaded) void loadCards();
      });
    });
    find("coupon-load").addEventListener("click", () => { void loadCoupons(); });
    async function loadCoupons() {
      if (!current() || jobView?.locked() || state.couponController) return;
      const controller = state.couponController = new AbortController();
      state.coupon = null; state.coupons = []; state.couponsLoaded = false;
      clearTimeout(state.couponTimer);
      find("coupons").replaceChildren(); find("coupons").hidden = true;
      find("coupon-status").textContent = "正在讀取此官方帳號的全部優惠券…";
      updateControls();
      try {
        const coupons = await fetchLineCoupons(groupId, controller);
        if (!current() || state.couponController !== controller) return;
        state.coupons = coupons;
        for (const coupon of coupons) {
          const card = document.createElement("label"); card.className = "loe-coupon-card";
          const input = document.createElement("input");
          input.type = "radio"; input.name = "loe-coupon"; input.value = String(coupon.couponId);
          input.setAttribute("aria-label", coupon.title);
          input.addEventListener("change", () => {
            if (!current() || jobView?.locked() || !lineCouponAvailable(coupon)) { updateControls(); return; }
            state.coupon = coupon;
            clearTimeout(state.couponTimer);
            // 計時器分段處理遠期到期時間，按傳送時仍再檢查一次。
            const checkExpiry = () => {
              if (!current() || state.coupon !== coupon) return;
              updateControls();
              if (lineCouponAvailable(coupon)) state.couponTimer = setTimeout(checkExpiry,
                Math.min(coupon.endTime - Date.now() + 1, 2147483647));
            };
            checkExpiry();
          });
          const image = document.createElement("img");
          image.alt = coupon.title; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
          try {
            const url = new URL(coupon.imageUrl);
            if (url.protocol === "https:") image.src = url.href;
          } catch (_) {}
          const missing = document.createElement("span"); missing.className = "loe-customers-muted";
          missing.textContent = "無法顯示預覽圖片"; missing.hidden = !!image.getAttribute("src");
          image.hidden = !image.getAttribute("src");
          image.addEventListener("error", () => { image.hidden = true; missing.hidden = false; }, { once: true });
          const title = document.createElement("strong"); title.textContent = coupon.title;
          const detail = document.createElement("span"); detail.className = "loe-customers-muted";
          detail.textContent = `${lineCouponAvailable(coupon) ? "有效" : "目前不可發送"}\n` +
            `${new Date(coupon.startTime).toLocaleString()} ～ ${new Date(coupon.endTime).toLocaleString()}`;
          card.append(image, missing, input, title, detail); find("coupons").appendChild(card);
        }
        find("coupons").hidden = !coupons.length;
        find("coupon-status").textContent = coupons.length ? `共 ${coupons.length} 張，請選一張優惠券。` : "此官方帳號目前沒有優惠券。";
        state.couponsLoaded = true;
      } catch (error) {
        if (current() && state.couponController === controller)
          find("coupon-status").textContent = `優惠券讀取失敗：${error.name === "AbortError" ? "讀取逾時，請重新讀取" : error.message}`;
      } finally {
        if (state.couponController === controller) state.couponController = null;
        if (current()) updateControls();
      }
    }
    find("coupon-remove").addEventListener("click", () => {
      if (!current() || jobView?.locked()) return;
      state.coupon = null; clearTimeout(state.couponTimer); updateControls();
    });
    function appendCardImage(container, summary, title) {
      if (!summary.image) return;
      const image = document.createElement("img");
      image.src = summary.image; image.alt = title; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => { image.hidden = true; }, { once: true });
      container.appendChild(image);
    }
    function renderCardPreview() {
      const preview = find("card-preview"); preview.replaceChildren();
      preview.hidden = find("card-preview-note").hidden = !state.card;
      if (!state.card) return;
      lineCardPages(state.card).forEach((page, index) => {
        const summary = lineCardPageSummary(page);
        const card = document.createElement("div"); card.className = "loe-card-page";
        const title = document.createElement("strong"); title.textContent = `第 ${index + 1} 張`;
        card.appendChild(title); appendCardImage(card, summary, `${state.card.title} 第 ${index + 1} 張`);
        const text = document.createElement("p"); text.textContent = summary.text || "（此卡片沒有文字摘要）";
        card.appendChild(text); preview.appendChild(card);
      });
      preview.scrollLeft = 0;
    }
    find("card-load").addEventListener("click", () => { void loadCards(); });
    async function loadCards() {
      if (!current() || jobView?.locked() || state.cardController) return;
      const controller = state.cardController = new AbortController();
      state.card = null; state.cards = []; state.cardsLoaded = false; renderCardPreview();
      find("cards").replaceChildren(); find("cards").hidden = true;
      find("card-status").textContent = "正在讀取此官方帳號的全部多頁訊息…";
      updateControls();
      try {
        const cards = await fetchLineCardMessages(groupId, controller);
        if (!current() || state.cardController !== controller) return;
        state.cards = cards;
        for (const card of cards) {
          const label = document.createElement("label"); label.className = "loe-coupon-card loe-card-choice";
          const input = document.createElement("input");
          input.type = "radio"; input.name = "loe-card-type"; input.value = String(card.id);
          input.setAttribute("aria-label", card.title);
          input.addEventListener("change", () => {
            if (!current() || jobView?.locked()) { updateControls(); return; }
            state.card = card; renderCardPreview(); updateControls();
          });
          const pages = lineCardPages(card);
          appendCardImage(label, lineCardPageSummary(pages[0]), card.title);
          const title = document.createElement("strong"); title.textContent = card.title;
          const detail = document.createElement("span"); detail.className = "loe-customers-muted";
          detail.textContent = `${pages.length} 張卡片`;
          label.append(input, title, detail); find("cards").appendChild(label);
        }
        find("cards").hidden = !cards.length;
        find("card-status").textContent = cards.length ? `共 ${cards.length} 組，請選一組多頁訊息。` : "此官方帳號目前沒有多頁訊息。";
        state.cardsLoaded = true;
      } catch (error) {
        if (current() && state.cardController === controller)
          find("card-status").textContent = `多頁訊息讀取失敗：${error.name === "AbortError" ? "讀取逾時，請重新讀取" : error.message}`;
      } finally {
        if (state.cardController === controller) state.cardController = null;
        if (current()) updateControls();
      }
    }
    find("card-remove").addEventListener("click", () => {
      if (!current() || jobView?.locked()) return;
      state.card = null; renderCardPreview(); updateControls();
    });
    function renderImages() {
      find("images").replaceChildren();
      state.files.forEach((item) => {
        const card = document.createElement("div");
        card.className = "loe-customers-image";
        const image = document.createElement("img");
        image.src = item.url;
        image.alt = item.file.name;
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "loe-mini"; remove.textContent = "移除";
        remove.setAttribute("aria-label", `移除 ${item.file.name}`);
        remove.addEventListener("click", () => {
          if (jobView?.locked()) return;
          releaseImage(item);
          state.files = state.files.filter((entry) => entry !== item);
          renderImages(); updateControls();
        });
        card.append(image, remove);
        find("images").appendChild(card);
      });
    }
    find("image-pick").addEventListener("click", () => {
      if (current() && !jobView?.locked()) fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      const files = Array.from(fileInput.files || []);
      // 允許再次選取同一檔案；畫面上的檔名與按鈕由 state.files 維護。
      fileInput.value = "";
      if (!current() || jobView?.locked()) return;
      if (!files.length) return;
      if (!account) { toast("請先在轉發設定填寫後台帳號"); return; }
      if (files.length > 1) { toast("每次最多選擇一張圖片"); return; }
      const file = files[0];
      if (!file.size) { toast("請選擇非空白的 JPG／PNG 圖片"); return; }
      // 格式由後端讀取實際內容判定，不以瀏覽器 MIME 或副檔名拒絕有效圖片。
      const replacement = { file, url: URL.createObjectURL(file), status: "uploading", asset: null, controller: null };
      for (const item of state.files) releaseImage(item);
      state.files = [replacement];
      renderImages(); updateControls();
      void uploadImage(replacement);
    });
    find("send").addEventListener("click", (event) => {
      if (!current()) { closeLineCustomers(); return; }
      if (event.detail > 1 || jobView?.locked() || state.allController || state.syncing) return;
      const gateError = sendGateError();
      if (gateError) { updateControls(); toast(gateError); return; }
      if (state.messageType === "image" && (!state.files.length || !imageReady())) { updateControls(); toast("請先完成圖片上傳"); return; }
      if (state.messageType === "coupon" && !lineCouponAvailable(state.coupon)) { updateControls(); toast("請選擇有效的優惠券"); return; }
      if (state.messageType === "cardType" && !state.card) { toast("請選擇多頁訊息"); return; }
      if (!account) { toast("請先在轉發設定填寫後台帳號"); return; }
      const text = textInput.value.trim();
      const chatIds = effectiveChatIds();
      if (!chatIds.length) { toast("請選擇至少一位未被過濾的客戶"); return; }
      if (state.messageType === "text" && !text) { toast("請填寫訊息"); return; }
      if (state.selected.size > LINE_RECIPIENT_LIMIT) { toast("一次最多選取 50,000 位客戶"); return; }
      if (state.files.length > 1) { toast("每次最多一張圖片"); return; }
      if (state.messageType === "text" && text.length > 5000) { toast("文字最多 5,000 字"); return; }
      const payload = { chatIds, excludedChatIds: [...state.excluded.keys()], messages: [
        ...(state.messageType === "text" ? [{ type: "text", text }] : []),
        ...(state.messageType === "image" ? [{ type: "image", mediaId: state.files[0].asset.mediaId }] : []),
        ...(state.messageType === "coupon" ? [{ type: "coupon", couponId: state.coupon.couponId }] : []),
        ...(state.messageType === "cardType" ? [{ type: "cardType", cardTypeMessageId: state.card.id }] : []),
      ] };
      const requestId = jobView.begin(payload);
      if (requestId) { state.pendingRequestId = requestId; state.pendingType = state.messageType; }
    });
    const close = () => {
      if (state.closed) return;
      state.closed = true;
      clearTimeout(state.searchTimer);
      clearTimeout(state.couponTimer);
      state.couponController?.abort();
      state.cardController?.abort();
      if (state.pageController) state.pageController.abort();
      stopAll();
      jobView?.close();
      for (const item of state.files) releaseImage(item);
      dialog.close(); dialog.remove();
      if (lineCustomerDialog?.dialog === dialog) lineCustomerDialog = null;
      if (opener?.isConnected) opener.focus();
    };
    dialog.querySelector(".loe-modal-close").addEventListener("click", close);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    dialog.addEventListener("click", (event) => event.stopPropagation());
    lineCustomerDialog = { groupId, account, dialog, close };
    document.body.appendChild(dialog);
    dialog.showModal(); searchInput.focus();
    jobView = createLineMessageJobView(find("job"), groupId, account, current, updateControls,
      { key: sendKey, error: sendGateError });
    updateControls(); void loadPage();
    return true;
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
        `${API_BASE}/line-ext-config?fleet=${encodeURIComponent(fleet)}&t=${Date.now()}`,
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

  /* ---------------------------------------------------------------------- *
   * Toast
   * ---------------------------------------------------------------------- */
  function toast(msg, kind, durationMs) {
    const t = document.createElement("div");
    t.className = "loe-toast" + (kind ? " " + kind : "");
    t.textContent = msg;
    (document.querySelector(".loe-customers-dialog[open]") || document.body).appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 250);
    }, durationMs || 2200);
  }

  /* ---------------------------------------------------------------------- *
   * Copy
   * ---------------------------------------------------------------------- */
  function getMessageText(chatBody) {
    const node =
      chatBody.querySelector("[data-copy-target].chat-item-text") ||
      chatBody.querySelector(".chat-item-text") ||
      chatBody.querySelector(".chat-item-loc .small"); // 位置訊息：地址在這
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
    window.setTimeout(() => {
      button.innerHTML = COPY_ICON;
      button.classList.remove(COPIED_CLASS);
    }, 1000);
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
    const addChip = (r, isFleet) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = QR_CHIP_CLASS + (isFleet ? " loe-qr-chip-fleet" : "");
      chip.textContent = r.name || r.text;
      chip.title = (isFleet ? "【車隊統一】" : "") + r.text;
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillReplyTextarea(r.text);
      });
      bar.appendChild(chip);
    };
    // 顯示模式：同步個人=只顯示個人、同步車隊=只顯示車隊、同步個人＋車隊=並存
    const mode = storeGet(QR_MODE_KEY, "both") || "both";
    if (mode !== "personal") getFleetReplies().forEach((r) => addChip(r, true));
    if (mode !== "fleet") getReplies().forEach((r) => addChip(r, false));
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
    // 點擊直接開「快捷回覆管理」modal（原本先彈一層只有一個選項的選單）
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openManager();
    });
    phoneLink.insertAdjacentElement("afterend", button);
  }
  /* ---------------------------------------------------------------------- *
   * $ 餘額紀錄（聊天窗帳本）——以 chatId 為鍵存在後端，所有操作員共享。
   * ---------------------------------------------------------------------- */
  const LEDGER_BUTTON_CLASS = "loe-ledger-button";
  function httpSendJson(method, url, bodyObj) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function")
        return reject(new Error("no GM_xmlhttpRequest"));
      GM_xmlhttpRequest({
        method,
        url,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        data: bodyObj == null ? undefined : JSON.stringify(bodyObj),
        timeout: 15000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            try {
              resolve(JSON.parse(res.responseText));
            } catch (e) {
              reject(e);
            }
          } else reject(new Error("HTTP " + res.status));
        },
        onerror: () => reject(new Error("network")),
        ontimeout: () => reject(new Error("timeout")),
      });
    });
  }
  // $ 按鈕直接顯示當前對話餘額（延遲載入，不卡主 render；失敗保持 "$" 不重試轟炸）
  let ledgerBalSeq = 0;
  let ledgerBalNextTryAt = 0;
  function updateLedgerButtonsText(chatId, balance) {
    document.querySelectorAll(`.${LEDGER_BUTTON_CLASS}`).forEach((b) => {
      b.dataset.loeChat = chatId;
      b.dataset.loeLoaded = "1";
      b.textContent =
        typeof balance === "number" ? `$${balance.toLocaleString()}` : "$";
    });
  }
  function refreshLedgerBalance(force) {
    const btn = document.querySelector(`.${LEDGER_BUTTON_CLASS}`);
    if (!btn) return;
    const chatId = getChatId();
    if (!chatId) return;
    if (!force && btn.dataset.loeChat === chatId && btn.dataset.loeLoaded === "1")
      return;
    if (!force && Date.now() < ledgerBalNextTryAt) return;
    // 換了對話先退回 "$"，避免短暫顯示上一個客戶的餘額
    if (btn.dataset.loeChat !== chatId) {
      document.querySelectorAll(`.${LEDGER_BUTTON_CLASS}`).forEach((b) => {
        b.dataset.loeChat = chatId;
        delete b.dataset.loeLoaded;
        b.textContent = "$";
      });
    }
    ledgerBalNextTryAt = Date.now() + 10000;
    const seq = ++ledgerBalSeq;
    httpGetJson(
      `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}&t=${Date.now()}`,
    )
      .then((data) => {
        if (seq !== ledgerBalSeq || getChatId() !== chatId) return;
        ledgerBalNextTryAt = 0;
        updateLedgerButtonsText(
          chatId,
          data && typeof data.balance === "number" ? data.balance : 0,
        );
      })
      .catch(() => {
        /* 失敗保持 "$"，10 秒後才允許再試 */
      });
  }
  function scheduleLedgerBalanceRefresh() {
    if (typeof requestIdleCallback === "function")
      requestIdleCallback(() => refreshLedgerBalance(), { timeout: 2000 });
    else setTimeout(() => refreshLedgerBalance(), 800);
  }
  function closeLedger() {
    const m = document.querySelector(".loe-ledger-mask");
    if (m) m.remove();
    document.removeEventListener("keydown", ledgerEscHandler, true);
  }
  function ledgerEscHandler(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeLedger();
    }
  }
  function fmtLedgerDate(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function openLedger() {
    const chatId = getChatId();
    if (!chatId) {
      toast("請先進入某個對話再開啟餘額紀錄");
      return;
    }
    closeLedger();
    const mask = document.createElement("div");
    mask.className = "loe-modal-mask loe-ledger-mask";
    mask.addEventListener("click", (e) => {
      if (e.target === mask) closeLedger();
    });
    const modal = document.createElement("div");
    modal.className = "loe-modal";
    modal.addEventListener("click", (e) => e.stopPropagation());
    const head = document.createElement("div");
    head.className = "loe-modal-head";
    const custName = getCustomerName();
    head.innerHTML = "<span></span>";
    head.querySelector("span").textContent = custName
      ? `餘額紀錄｜${custName}`
      : "餘額紀錄";
    const closeBtn = document.createElement("button");
    closeBtn.className = "loe-modal-close";
    closeBtn.textContent = "×";
    closeBtn.title = "關閉";
    closeBtn.addEventListener("click", closeLedger);
    head.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "loe-modal-body";

    const balanceEl = document.createElement("div");
    balanceEl.className = "loe-ledger-balance";
    balanceEl.textContent = "當前餘額：載入中…";
    const list = document.createElement("div");
    list.className = "loe-list";

    function render(data) {
      balanceEl.textContent = `當前餘額：${data.balance}`;
      updateLedgerButtonsText(chatId, data.balance);
      list.textContent = "";
      (data.records || []).forEach((r) => {
        const row = document.createElement("div");
        row.className = "loe-ledger-row";
        const left = document.createElement("span");
        left.textContent = r.item;
        const right = document.createElement("span");
        right.style.display = "inline-flex";
        right.style.alignItems = "center";
        const amt = document.createElement("span");
        amt.className = r.amount >= 0 ? "loe-amt-pos" : "loe-amt-neg";
        amt.textContent = (r.amount > 0 ? "+" : "") + r.amount;
        const date = document.createElement("span");
        date.className = "loe-ledger-date";
        date.textContent =
          fmtLedgerDate(r.createdAt) + (r.by ? ` ${r.by}` : "");
        const del = document.createElement("button");
        del.type = "button";
        del.className = "loe-ledger-del";
        del.textContent = "×";
        del.title = "刪除此筆（會回沖餘額）";
        del.addEventListener("click", async () => {
          if (!confirm(`刪除「${r.item} ${r.amount > 0 ? "+" : ""}${r.amount}」？餘額將回沖。`)) return;
          try {
            const updated = await httpSendJson(
              "DELETE",
              `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}&recordId=${encodeURIComponent(r.id)}`,
            );
            render(updated);
            toast("已刪除並回沖餘額");
          } catch (err) {
            toast(`刪除失敗（${(err && err.message) || "網路錯誤"}）`);
          }
        });
        right.appendChild(amt);
        right.appendChild(date);
        right.appendChild(del);
        row.appendChild(left);
        row.appendChild(right);
        list.appendChild(row);
      });
      if (!(data.records || []).length) {
        const empty = document.createElement("div");
        empty.style.color = "#94a3b8";
        empty.textContent = "尚無紀錄";
        list.appendChild(empty);
      }
    }

    // 新增表單：項目 / 種類(+−) / 金額
    const form = document.createElement("div");
    form.className = "loe-form";
    const formTitle = document.createElement("div");
    formTitle.className = "loe-form-title";
    formTitle.textContent = "新增紀錄";
    const itemInput = document.createElement("input");
    itemInput.className = "loe-input";
    itemInput.placeholder = "項目（例如：儲值、乘車扣）";
    const rowEl = document.createElement("div");
    rowEl.className = "loe-ledger-formrow";
    const signSel = document.createElement("select");
    signSel.className = "loe-input";
    [["+", "+"], ["-", "−"]].forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      signSel.appendChild(o);
    });
    const amtInput = document.createElement("input");
    amtInput.className = "loe-input loe-amt";
    amtInput.type = "number";
    amtInput.min = "1";
    amtInput.placeholder = "金額（例如 100）";
    rowEl.appendChild(signSel);
    rowEl.appendChild(amtInput);
    const actions = document.createElement("div");
    actions.className = "loe-form-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "loe-btn-primary";
    saveBtn.textContent = "新增";
    actions.appendChild(saveBtn);
    form.appendChild(formTitle);
    form.appendChild(itemInput);
    form.appendChild(rowEl);
    form.appendChild(actions);

    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const item = itemInput.value.trim();
      const raw = Math.abs(Number(amtInput.value));
      if (!item) {
        toast("請填寫項目");
        return;
      }
      if (!raw || !isFinite(raw)) {
        toast("請填寫正確的金額");
        return;
      }
      const amount = signSel.value === "-" ? -raw : raw;
      saveBtn.disabled = true;
      try {
        const data = await httpSendJson(
          "POST",
          `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}`,
          { item, amount, by: getDispatcher() || "" },
        );
        render(data);
        itemInput.value = "";
        amtInput.value = "";
        toast(`已新增：${item} ${amount > 0 ? "+" : ""}${amount}`);
      } catch (err) {
        toast(`新增失敗（${(err && err.message) || "網路錯誤"}），請稍後再試`);
      } finally {
        saveBtn.disabled = false;
      }
    });

    body.appendChild(balanceEl);
    body.appendChild(list);
    body.appendChild(form);
    modal.appendChild(head);
    modal.appendChild(body);
    mask.appendChild(modal);
    document.body.appendChild(mask);
    document.addEventListener("keydown", ledgerEscHandler, true);

    httpGetJson(
      `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}&t=${Date.now()}`,
    )
      .then(render)
      .catch((err) => {
        balanceEl.textContent = `載入失敗（${(err && err.message) || "網路錯誤"}）`;
      });
  }
  function addLedgerButton(phoneLink) {
    if (
      !phoneLink ||
      phoneLink.parentElement.querySelector(`.${LEDGER_BUTTON_CLASS}`)
    )
      return;
    const button = document.createElement("a");
    button.href = "#";
    button.role = "button";
    button.className = `mr-2 ${LEDGER_BUTTON_CLASS}`;
    button.setAttribute("aria-label", "餘額紀錄");
    button.title = "餘額紀錄（此對話）";
    button.textContent = "$";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLedger();
    });
    phoneLink.insertAdjacentElement("afterend", button);
    scheduleLedgerBalanceRefresh();
  }

  function enhanceQuickReplyToolbars(root = document) {
    root.querySelectorAll("i.lar.la-chat-phone.la-fw.la-lg").forEach((icon) => {
      const a = icon.closest("a");
      addQuickReplyButton(a);
      // $ 放在快速回覆按鈕右邊
      const quickBtn = a && a.parentElement.querySelector(`.${QUICK_BUTTON_CLASS}`);
      addLedgerButton(quickBtn || a);
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
    head.innerHTML = `<span>快捷回覆管理（個人模板）</span>`;
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
      // 車隊統一模板（後台維護，唯讀）——僅展示，不能編輯/刪除
      const fleetReps = getFleetReplies();
      if (fleetReps.length) {
        const note = document.createElement("div");
        note.className = "loe-mgr-fleet-note";
        note.textContent = "車隊統一模板（後台維護，唯讀）";
        list.appendChild(note);
        fleetReps.forEach((r) => {
          const row = document.createElement("div");
          row.className = "loe-row loe-row-fleet";
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
          row.appendChild(info);
          list.appendChild(row);
        });
        const sep = document.createElement("div");
        sep.className = "loe-mgr-fleet-note";
        sep.textContent = "個人模板（可編輯）";
        list.appendChild(sep);
      }
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
  /* 直接派單（API 優先）：後端同步建單、返回即結果。
   * 回 null = 後端不可達（網路錯誤 / 404 舊後端 / 5xx）→ caller fallback 到 webhook 老路；
   * 回物件（含 success:false 業務失敗）= 明確結果，不再 fallback（避免失敗單被 webhook 重複派出）。 */
  async function tryApiDispatch(payload) {
    try {
      return await httpSendJson("POST", `${API_BASE}/line-dispatch`, {
        text: payload,
        dispatcher: getDispatcher(),
      });
    } catch (e) {
      return null;
    }
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
  }

  /* ---------------------------------------------------------------------- *
   * Per-message copy button + address linkify
   * ---------------------------------------------------------------------- */
  function addCopyButton(chatBody) {
    // 已處理過就先返回：observer 對同一則訊息會重複觸發，這裡是熱路徑
    if (chatBody.querySelector(`.${BUTTON_CLASS}`)) return;
    const bubble = chatBody.querySelector(".chat-item");
    if (!bubble) return;
    const textNode =
      chatBody.querySelector("[data-copy-target].chat-item-text") ||
      chatBody.querySelector(".chat-item-text");
    // 位置訊息（LINE location）：沒有 .chat-item-text，地址在 .chat-item-loc .small
    const locNode = textNode ? null : bubble.querySelector(".chat-item-loc .small");
    const srcNode = textNode || locNode;
    if (!srcNode) return;
    addForwardButton(bubble, srcNode);
    bubble.classList.add(BUBBLE_CLASS);
    if (textNode) textNode.classList.add(TEXT_PAD_CLASS); // 預留右側空間，固定顯示的按鈕不會蓋到文字
    else bubble.classList.add("loe-loc-pad");            // 位置訊息：泡泡右側留白，按鈕不蓋住箭頭
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
    whoHint.textContent = "UTurn後台帳號（Email，全部帳號共用，設定一次即可）：";
    const whoInput = document.createElement("input");
    whoInput.type = "email";
    whoInput.placeholder = "例如：dispatcher@uturn.com";
    whoInput.value = getDispatcher();

    // 車隊 — 設定後台帳號後，依此向後端拉該車隊的 Webhook 與官方/店配設定
    const fleetHint = document.createElement("div");
    fleetHint.className = "loe-pop-hint";
    fleetHint.style.marginTop = "4px";
    fleetHint.textContent = "請輸入您的車隊代碼或名稱";
    const fleetInput = document.createElement("input");
    fleetInput.type = "text";
    fleetInput.placeholder = "請輸入您的車隊代碼或名稱";
    fleetInput.setAttribute("aria-label", "車隊代碼或名稱");
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

    // 同步群編設定（向後端拉目前車隊的群編/店配/webhook 設定並套用）
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "loe-import-btn";
    importBtn.insertAdjacentHTML("beforeend", ic("download"));
    const importLabel = document.createElement("span");
    importLabel.textContent = "同步群編";
    importBtn.appendChild(importLabel);
    importBtn.title = "向後端拉目前車隊（設定面板）的群編/店配設定並套用";
    importBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const fleet = getFleet();
      if (!fleet) {
        toast("請先在設定面板填寫車隊（如 HELLO）");
        return;
      }
      try {
        const data = await httpGetJson(
          `${API_BASE}/line-ext-config?fleet=${encodeURIComponent(fleet)}&t=${Date.now()}`,
        );
        const r = applyFleetConfig(data);
        // toast 帶出車隊名：車隊填錯（拉到別隊設定）時一眼可見
        toast(
          `已同步 ${fleet}：${r.gidCount} 個帳號群編、${r.chatCount} 筆店配覆寫`,
        );
      } catch (err) {
        // 失敗原因直接呈現（HTTP 4xx/5xx、timeout、network）
        toast(`同步失敗（${(err && err.message) || "網路錯誤"}），請稍後再試`);
      }
    });
    chip.insertAdjacentElement("afterend", importBtn);

    // 同步快捷回覆（選單：車隊統一模板 / 自己的模板；匯入＝整組取代本地）
    const replySyncBtn = document.createElement("button");
    replySyncBtn.type = "button";
    replySyncBtn.className = "loe-import-btn";
    replySyncBtn.insertAdjacentHTML("beforeend", ic("download"));
    const replySyncLabel = document.createElement("span");
    replySyncLabel.textContent = "同步快捷";
    replySyncBtn.appendChild(replySyncLabel);
    replySyncBtn.title =
      "匯入/更新車隊統一模板＋同步自己的個人模板（並存顯示，車隊模板匯入後常駐）";
    replySyncBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleReplySyncMenu(replySyncBtn);
    });
    importBtn.insertAdjacentElement("afterend", replySyncBtn);

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
    replySyncBtn.insertAdjacentElement("afterend", estBtn); // 順序：同步群編設定 → 同步快捷 → 估價

    // 版本號放在工具列末端，進階功能按鈕會插在它前面。
    const verChip = document.createElement("span");
    verChip.className = "loe-version-chip";
    verChip.textContent = "v" + UTURN_BUILD;
    verChip.title = "懶惰蟲版本 v" + UTURN_BUILD;
    estBtn.insertAdjacentElement("afterend", verChip);

    renderPrefixChip();
  }

  let lineAdvancedMenu = null;
  function closeLineAdvancedMenu(restoreFocus = false) {
    const entry = lineAdvancedMenu;
    if (!entry) return;
    entry.menu.hidden = true;
    entry.anchor.setAttribute("aria-expanded", "false");
    entry.cleanup?.();
    entry.cleanup = null;
    if (restoreFocus && entry.anchor.isConnected) entry.anchor.focus();
  }

  function enhanceLineAdvancedMenu() {
    if (location.hostname !== "chat.line.biz" || window.top !== window.self) return;
    if (lineAdvancedMenu && !lineAdvancedMenu.anchor.isConnected) {
      closeLineAdvancedMenu();
      lineAdvancedMenu.menu.remove();
      lineAdvancedMenu = null;
    }
    const version = document.querySelector("header .loe-version-chip");
    if (!version || lineAdvancedMenu) return;
    const anchor = document.createElement("button");
    anchor.id = "loe-line-advanced-button";
    anchor.type = "button";
    anchor.className = "loe-import-btn";
    anchor.innerHTML = ic("settings") + "<span>進階功能</span>";
    const arrow = document.createElement("span");
    arrow.textContent = "▾"; arrow.setAttribute("aria-hidden", "true");
    anchor.appendChild(arrow);
    anchor.setAttribute("aria-haspopup", "menu");
    anchor.setAttribute("aria-expanded", "false");
    anchor.setAttribute("aria-controls", "loe-line-advanced-menu");
    const menu = document.createElement("div");
    menu.id = "loe-line-advanced-menu";
    menu.className = "loe-advanced-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-labelledby", anchor.id);
    menu.hidden = true;
    menu.addEventListener("click", (event) => event.stopPropagation());
    lineAdvancedMenu = { anchor, menu, cleanup: null, groupId: "", account: "" };
    const availableItems = () => [...menu.querySelectorAll("button:not(:disabled)")];
    const show = (last = false) => {
      if (!menu.hidden) { const items = availableItems(); (last ? items.at(-1) : items[0])?.focus(); return; }
      closePrefixPopover();
      menu.hidden = false;
      anchor.setAttribute("aria-expanded", "true");
      lineAdvancedMenu.groupId = getOaId(); lineAdvancedMenu.account = getDispatcher();
      const rect = anchor.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 8))}px`;
      const outside = (event) => {
        if (!menu.contains(event.target) && !anchor.contains(event.target)) closeLineAdvancedMenu();
      };
      const dismiss = () => closeLineAdvancedMenu();
      document.addEventListener("pointerdown", outside, true);
      document.addEventListener("focusin", outside, true);
      window.addEventListener("resize", dismiss);
      window.addEventListener("scroll", dismiss, true);
      lineAdvancedMenu.cleanup = () => {
        document.removeEventListener("pointerdown", outside, true);
        document.removeEventListener("focusin", outside, true);
        window.removeEventListener("resize", dismiss);
        window.removeEventListener("scroll", dismiss, true);
      };
      const items = availableItems(); (last ? items.at(-1) : items[0])?.focus();
    };
    anchor.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation();
      if (menu.hidden) show(); else closeLineAdvancedMenu(true);
    });
    anchor.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); show(event.key === "ArrowUp");
      }
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeLineAdvancedMenu(true); return; }
      if (event.key === "Tab") { closeLineAdvancedMenu(true); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = availableItems(), index = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
        (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    const actions = [
      {
        id: "loe-line-cookie-button",
        label: "身份授權",
        icon: "shield-check",
        title: "授權設定中的後台帳號使用目前的 LINE 登入狀態",
        run: saveLineCookie,
        done: (result) => result.cancelled ? null :
          `已授權至 ${result.account}` + (result.keyExpiresAt ? `（KEY 到期 ${new Date(result.keyExpiresAt).toLocaleDateString("zh-TW")}）` : ""),
      },
      {
        id: "loe-line-directory-button",
        label: "同步客戶",
        icon: "refresh",
        title: "讀完 LINE 全部對話，整份更新目前官方帳號的後端客戶清單",
        run: syncLineCustomers,
        done: (result) => result.replaced
          ? `已同步 ${result.count} 位客戶`
          : `LINE 清單為空，後端保留原本 ${result.count} 位客戶`,
      },
      {
        id: "loe-line-customers-button",
        label: "群發訊息",
        icon: "send",
        title: "選擇客戶並編輯要傳送的訊息",
        run: openLineCustomers,
        done: () => null,
      },
    ];
    for (const action of actions) {
      const button = document.createElement("button");
      button.id = action.id;
      button.type = "button";
      button.className = "loe-console-button";
      button.setAttribute("role", "menuitem");
      button.tabIndex = -1;
      button.title = action.title;
      button.insertAdjacentHTML("beforeend", ic(action.icon));
      const label = document.createElement("span"); label.textContent = action.label;
      button.appendChild(label);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        closeLineAdvancedMenu(true);
        if (!/^U[0-9a-f]{32}$/i.test(getOaId())) {
          toast("請先選擇 LINE 官方帳號");
          return;
        }
        const pathname = location.pathname;
        button.disabled = true;
        label.textContent = "處理中…";
        try {
          const result = await action.run();
          if (location.pathname === pathname) {
            const message = result ? action.done(result) : "讀取未完成，請稍後重試";
            if (message) toast(message);
          }
        } catch (error) {
          if (location.pathname === pathname)
            toast(error.message || "操作失敗，請稍後重試", "error", 6000);
        } finally {
          button.disabled = false;
          label.textContent = action.label;
        }
      });
      menu.appendChild(button);
    }
    document.body.appendChild(menu);
    version.insertAdjacentElement("beforebegin", anchor);
  }

  /* ---------------------------------------------------------------------- *
   * 派單 (dispatch) — 手動填寫上車地址＋備註，加上前綴送到 Discord，
   * 並把「尋車中」訊息填入輸入框
   * ---------------------------------------------------------------------- */
  const TRUCK_ICON = ic("truck");
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
  function dispatchEscHandler(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeDispatchPopover();
    }
  }
  function closeDispatchPopover() {
    if (openDispatchPopover._pop) {
      openDispatchPopover._pop.remove();
      openDispatchPopover._pop = null;
    }
    document.removeEventListener("keydown", dispatchEscHandler, true);
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
  // 實際 DOM（2026/07 在 chat.line.biz live 驗證）：
  //   <a class="btn btn-sm btn-outline-info"><i class="las la-chats"></i>待處理</a>
  //   已標記時 btn-outline-info 變 btn-outline-success，其餘不變（無 title/active/aria-pressed）。
  // 另有一種只剩 icon 沒文字的版型（使用者截圖，滑過顯示 tooltip「設為『待處理』」，
  // 桌機縮到 552px 重現不出來，疑似平板/手機版），所以認按鈕不能只靠文字：
  // 用 icon（la-chats／la-chat-check）＋文字＋tooltip 屬性三重保險。
  // 按鈕的 tooltip 文案（title / aria-label / data-original-title 都可能放）
  function followUpHintText(el) {
    return (
      (el.getAttribute("title") || "") +
      " " +
      (el.getAttribute("aria-label") || "") +
      " " +
      (el.getAttribute("data-original-title") || "")
    );
  }
  function findFollowUpBtn() {
    const hintText = followUpHintText;
    const isFollowUpEl = (el) =>
      !!el.querySelector(".la-chats") ||
      (el.textContent || "").trim() === "待處理" ||
      hintText(el).includes("待處理");
    const isDoneEl = (el) =>
      !!el.querySelector(".la-chat-check") ||
      (el.textContent || "").trim() === "處理完畢" ||
      hintText(el).includes("處理完畢");
    // 排除本擴充自己的元素（loe-*）與下拉切換鈕（左側篩選停在「待處理」時，下拉鈕文字也是「待處理」）
    const btns = [...document.querySelectorAll("a.btn, button.btn")].filter(
      (el) =>
        !/(^|\s)loe-|dropdown-toggle/.test(String(el.className || "")) &&
        el.getAttribute("data-toggle") !== "dropdown" &&
        !el.getAttribute("aria-haspopup"),
    );
    // 最可靠的定位：旁邊有「處理完畢」兄弟按鈕的「待處理」才是聊天室頂端的狀態列
    //（左側清單的「待處理」篩選不會跟「處理完畢」成對出現，不會誤點）。
    const paired = btns.find(
      (el) =>
        isFollowUpEl(el) &&
        el.parentElement &&
        [...el.parentElement.children].some(
          (sib) => sib !== el && isDoneEl(sib),
        ),
    );
    if (paired) return paired;
    // 沒找到成對的（LINE 又改版？）：退回舊法，只在聊天室頂端區域用文字找
    return (
      [
        ...document.querySelectorAll(
          ".sub-header a, .sub-header button, header a, header button",
        ),
      ].find((b) => (b.textContent || "").trim().includes("待處理")) || null
    );
  }
  function isFollowUpMarked(btn) {
    // 實際觀察：未標記是 btn-outline-info（藍）、標記後轉 success（綠）。
    const cls = String(btn.className || "");
    return (
      /btn-outline-success|\bbtn-success\b|\bactive\b/.test(cls) ||
      btn.getAttribute("aria-pressed") === "true"
    );
  }
  // 穩健標記：輪詢等待按鈕就緒（送出/換頁後可能還沒 render）。點下去後持續確認，
  // 被 LINE 切回未標記（例如自動回覆送達後 LINE 重設狀態）就補點，最多點 3 次、
  // 每次點完等 ~900ms 再判斷（避免連點把標記切掉）。連續 3 輪都已標記才算完成，
  // 整體最多 ~10 秒；到時停止重試。
  function markFollowUp() {
    const STEP = 300,
      MAX = 10000,
      MAX_CLICKS = 3;
    let waited = 0,
      clicks = 0,
      cooldown = 0,
      stable = 0;
    (function loop() {
      let btn = null;
      try {
        btn = findFollowUpBtn();
      } catch (_) {}
      if (btn && isFollowUpMarked(btn)) {
        stable++;
        if (stable >= 3) return; // 已標記且狀態穩定，完成
      } else {
        stable = 0;
        if (btn) {
          if (cooldown > 0) cooldown--;
          else if (clicks < MAX_CLICKS) {
            try {
              btn.click();
            } catch (_) {}
            clicks++;
            cooldown = 3;
          }
        }
      }
      waited += STEP;
      if (waited < MAX) {
        window.setTimeout(loop, STEP);
        return;
      }
    })();
  }
  function openDispatchPopover(prefillAddress) {
    closeDispatchPopover();
    // 對話連結綁定「開啟面板當下」的對話（#39435：面板掛在 body、切對話不會關，
    // 送出時才讀 location 會抓到別人的對話）；開啟時拍不到快照才退回送出當下的網址
    const chatIdAtOpen = getChatId();
    const oaIdAtOpen = getOaId();
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
    // 對話連結（linechaturl:）— 送出時加在最後；預覽不顯示。
    // 用開啟面板當下的快照，切過對話再送出也指向原本的客人
    const lineUrlSuffix = () => {
      const chat = chatIdAtOpen || getChatId();
      const oa = chatIdAtOpen ? oaIdAtOpen : getOaId();
      if (!chat) return "";
      return ` linechaturl:https://chat.line.biz/${oa}/chat/${chat}`;
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
        // 1) 直接派單 API：返回即建單結果（成功=綠、失敗=紅，失敗不回覆客人不標記）
        const api = await tryApiDispatch(payload);
        if (api) {
          closeDispatchPopover();
          if (api.success) {
            if (auto) autoSendReply(selectedReplyText());
            toast(
              `✅ 派單成功：${api.oriText || ""}` +
                (api.shortId ? `（單號 ${api.shortId}）` : "") +
                (auto ? "，已自動回覆客人" : ""),
              "ok",
              5000,
            );
            if (markChk.checked) window.setTimeout(markFollowUp, 500);
          } else {
            // 建單失敗：不自動回覆客人、不標記待處理，避免「已安排」卻沒單
            toast(
              `❌ 派單失敗：${api.message || "未知原因"}`,
              "err",
              8000,
            );
          }
          return;
        }

        // 2) 後端不可達 → fallback webhook 老路（後端掛了無從確認結果，誠實告知請去頻道看）
        const how = await sendForward(payload);
        closeDispatchPopover();
        if (auto) {
          autoSendReply(selectedReplyText());
          toast(
            how === "discord"
              ? "⚠️ 已送出到 Discord，但後端暫時無法確認建單結果，請至頻道確認（已自動回覆客人）"
              : "已複製（未設定 Webhook），並已自動回覆客人",
            how === "discord" ? "warn" : undefined,
            how === "discord" ? 6000 : undefined,
          );
        } else {
          // 不勾選：只送派單，不在輸入框帶入任何訊息
          toast(
            how === "discord"
              ? "⚠️ 已送出到 Discord，但後端暫時無法確認建單結果，請至頻道確認"
              : "已複製（未設定 Webhook）",
            how === "discord" ? "warn" : undefined,
            how === "discord" ? 6000 : undefined,
          );
        }
        // 有勾選「標記待處理」才標記目前這個對話（在自動回覆送出之後）
        if (markChk.checked) window.setTimeout(markFollowUp, 500);
      } catch (err) {
        sendBtn.disabled = false;
        toast("派單失敗：" + (err && err.message ? err.message : "未知錯誤"), "err");
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
    // ESC 全域可關（不需焦點在窗內）；capture 搶在 LINE 頁面自身的 ESC 行為前
    document.addEventListener("keydown", dispatchEscHandler, true);
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
  async function syncRemoteQuickReplies(account, force) {
    if (!account) return;
    try {
      const data = await httpGetJson(
        `${API_BASE}/line-quick-replies?account=${encodeURIComponent(account)}&t=${Date.now()}`,
      );
      const replies = data && data.replies;
      // 自動同步：雲端空清單不覆蓋本地（防帳號打錯/新裝置誤清）；
      // 手動「同步個人」(force)：完全以雲端為準，空清單也套用
      if (Array.isArray(replies) && (replies.length || force)) {
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
  /* ---- 「同步快捷回覆」：手動匯入模板（整組取代本地清單） ---- */
  // 把快捷回覆清單推回後端個人副本（依帳號，無 auth）；沒帳號不推、離線靜默。
  function pushRepliesToBackend(account, arr) {
    if (!account || typeof GM_xmlhttpRequest !== "function") return;
    GM_xmlhttpRequest({
      method: "PUT",
      url: `${API_BASE}/line-quick-replies?account=${encodeURIComponent(account)}`,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ replies: Array.isArray(arr) ? arr : [] }),
    });
  }
  // 匯入/更新車隊統一模板：抓雲端最新 → 存本地常駐（與個人並存、唯讀）。
  async function importFleetQuickReplies() {
    const fleet = getFleet();
    if (!fleet) {
      toast("請先在設定面板填寫車隊（如 HELLO）");
      return null;
    }
    const data = await httpGetJson(
      `${API_BASE}/line-fleet-quick-replies?fleet=${encodeURIComponent(fleet)}&t=${Date.now()}`,
    );
    const replies = (data && data.replies) || [];
    storeSet(FLEET_STORE_KEY, replies); // 常駐（含空清單——後台清空要跟著清）
    refreshAllQuickMenus();
    renderQuickBar();
    return replies;
  }
  // 已匯入者開頁自動刷新最新版；從未匯入（純個人模式）不動。
  async function refreshFleetRepliesIfImported() {
    if (!hasImportedFleetReplies()) return;
    try {
      await importFleetQuickReplies();
    } catch (_) {
      /* 離線沿用本地常駐副本 */
    }
  }
  // 同步快捷（mode: "personal" | "fleet" | "both"）——同步對應來源並切換顯示模式：
  // 個人=只顯示個人、車隊=只顯示車隊、個人＋車隊=並存（資料都保留，只影響顯示）
  async function syncQuickReplies(mode) {
    const fleet = getFleet();
    const account = getDispatcher();
    const wantFleet = mode === "fleet" || mode === "both";
    const wantPersonal = mode === "personal" || mode === "both";
    if (wantPersonal && !account) {
      toast("請先在設定面板填寫後台帳號");
      return;
    }
    if (wantFleet && !fleet) {
      toast("請先在設定面板填寫車隊（如 HELLO）");
      return;
    }
    try {
      let fleetReplies = null;
      if (wantFleet) fleetReplies = await importFleetQuickReplies();
      if (wantPersonal) await syncRemoteQuickReplies(account, true); // 手動：以雲端為準
      storeSet(QR_MODE_KEY, mode); // 切換顯示模式
      renderQuickBar();
      const parts = [];
      if (wantFleet) parts.push(`車隊統一 ${fleetReplies ? fleetReplies.length : 0} 則`);
      if (wantPersonal) parts.push(`個人 ${getReplies().length} 則`);
      toast(`已同步快捷：${parts.join("、")}`);
    } catch (err) {
      toast(`同步失敗（${(err && err.message) || "網路錯誤"}），請稍後再試`);
    }
  }
  // 同步快捷小選單：同步個人 / 同步個人＋車隊
  function toggleReplySyncMenu(anchor) {
    if (toggleReplySyncMenu._menu) {
      toggleReplySyncMenu._menu.remove();
      toggleReplySyncMenu._menu = null;
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "loe-prefix-pop";
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = "99999";
    menu.addEventListener("click", (e) => e.stopPropagation());
    [
      ["同步個人", "personal"],
      ["同步車隊", "fleet"],
      ["同步個人＋車隊", "both"],
    ].forEach(([label, mode]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "loe-import-btn";
      b.style.display = "block";
      b.style.width = "100%";
      b.style.marginBottom = "6px";
      b.textContent = label;
      b.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleReplySyncMenu._menu && toggleReplySyncMenu._menu.remove();
        toggleReplySyncMenu._menu = null;
        await syncQuickReplies(mode);
      });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    toggleReplySyncMenu._menu = menu;
    setTimeout(() => {
      document.addEventListener(
        "click",
        () => {
          if (toggleReplySyncMenu._menu) {
            toggleReplySyncMenu._menu.remove();
            toggleReplySyncMenu._menu = null;
          }
        },
        { once: true },
      );
    }, 0);
  }
  // 設定 account 後才驅動：沒帳號一律不動遠端設定。
  function syncRemoteConfig() {
    const account = getDispatcher();
    if (!account) return;
    syncRemoteQuickReplies(account);
    syncRemoteFleetConfig(getFleet());
    refreshFleetRepliesIfImported(); // 車隊模板常駐者自動更新到雲端最新
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
  let lastScrollIntentAt = 0;
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
  // 訊息搜尋模式偵測：聊天標題列（.sub-header）的搜尋列開啟時 input 才可見
  // （關閉後 input 留在 DOM 但 offsetParent 為 null）。
  // 搜尋中 LINE 會把訊息捲到命中處，貼底穩定器必須完全停手，
  // 否則 250ms 心跳會把定位硬拉回底部 → 搜尋跳轉等於不能用。
  function isChatSearchOpen() {
    const sh = document.querySelector(".sub-header");
    const inp = sh && sh.querySelector("input");
    return !!(inp && inp.offsetParent);
  }
  // 左側對話清單搜尋（結果列表模式）：點結果進聊天要停在命中訊息，
  // 換對話的強制貼底窗要跳過。
  function isChatlistSearchActive() {
    const inp = document.querySelector("input.chatlist-search");
    return !!(inp && inp.offsetParent && inp.value.trim());
  }
  // 換對話/進頁後的「強制貼底窗」：載入期不管貼底狀態一律拉到底，
  // 但讓給使用者的即時操作（400ms 內有捲動意圖就不強拉）。
  let forceStickUntil = 0;
  let chatSearchWasOpen = false;
  function stickToBottomIfPinned() {
    const searchOpen = isChatSearchOpen();
    if (searchOpen !== chatSearchWasOpen) {
      chatSearchWasOpen = searchOpen;
      if (!searchOpen) {
        // 搜尋剛關閉：使用者多半停在命中訊息看上下文，不能馬上拉底；
        // 只有本來就在底部才恢復貼底。
        forceStickUntil = 0;
        const sc = getScroller();
        pinnedToBottom = !!sc && nearBottom(sc);
      }
    }
    if (searchOpen) return; // 搜尋中：捲動定位權完全交給 LINE
    const sc = getScroller();
    if (!sc) return;
    const userJustScrolled = performance.now() - lastScrollIntentAt < 400;
    const force = performance.now() < forceStickUntil && !userJustScrolled;
    if ((force || pinnedToBottom) && !nearBottom(sc)) {
      sc.scrollTop = sc.scrollHeight;
    }
    if (force) pinnedToBottom = true; // 載入期結束前維持貼底狀態
  }
  // 獨立心跳：不依賴 MutationObserver/rAF 鏈路（圖片後載、背景分頁回前景、
  // LINE 內部重排等都接得住）。250ms 一次成本可忽略。
  setInterval(() => {
    // SPA 的 pushState / replaceState 不一定更新 DOM，也不會觸發 popstate。
    // 只在操作對象改變時排入維護，確保舊視窗與 KEY 一併清除。
    if (getOaId() !== lastOaId || getChatId() !== lastChatId ||
        (lineCustomerDialog && lineCustomerDialog.account !== getDispatcher())) scheduleMaintenance();
    stickToBottomIfPinned();
  }, 250);
  setInterval(() => refreshLedgerBalance(), 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) stickToBottomIfPinned();
  });
  // 只有「使用者主動操作」（滾輪/觸控/拖曳/鍵盤）造成的捲動才允許解除貼底。
  // LINE 載入舊訊息、瀏覽器 scroll anchoring 也會觸發 scroll 事件；
  // 若把那些誤判成使用者上翻，貼底會被永久解除（症狀：進聊天後捲動條自己往上跑、新訊息不貼底）。
  // 只有發生在「聊天捲動容器內」的操作才算捲動意圖：
  // 點左側對話列表（pointerdown）不會再誤判成上翻——那正是換對話後
  // 貼底被解除、卡在上面的 race 來源。容器未知時保守視為有意圖。
  const noteScrollIntent = (e) => {
    const sc = chatScroller;
    if (!sc || sc === e.target || (sc.contains && sc.contains(e.target))) {
      lastScrollIntentAt = performance.now();
    }
  };
  ["wheel", "touchstart", "touchmove", "pointerdown", "keydown"].forEach((ev) =>
    document.addEventListener(ev, noteScrollIntent, {
      capture: true,
      passive: true,
    }),
  );
  // 圖片/貼圖後載會把內容撐高但不觸發 childList mutation——
  // 載入完成時若仍貼底就補拉到底，避免停在半路
  document.addEventListener(
    "load",
    (e) => {
      const t = e.target;
      if (t && t.tagName === "IMG" && chatScroller && chatScroller.contains(t)) {
        stickToBottomIfPinned();
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "scroll",
    (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1) return;
      // 熱路徑：捲動每幀都會觸發，已知容器就不再掃 DOM
      if (t !== chatScroller) {
        if (!(t.querySelector && t.querySelector(".chat-body"))) return;
        chatScroller = t; // 學到真正的捲動容器
      }
      if (nearBottom(t)) pinnedToBottom = true;
      else if (performance.now() - lastScrollIntentAt < 400)
        pinnedToBottom = false; // 使用者剛操作過 → 真的往上翻
      // 其餘（程式/瀏覽器自己造成的捲動）不改變貼底狀態，rAF 迴圈會再拉回底部
    },
    { capture: true, passive: true },
  );

  /* ---------------------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------------------- */
  let lastOaId = getOaId();
  let lastChatId = getChatId();
  initLineChatDirectory();
  enhanceChatBodies();
  enhanceQuickReplyToolbars();
  enhancePrefixChip();
  enhanceLineAdvancedMenu();
  addDispatchButton();
  ensureQuickBar();
  checkSendToken();
  // 已設定後台帳號 → 拉雲端設定（快速回覆 + 該車隊 Webhook）覆蓋本地快取
  syncRemoteConfig();
  // 進頁面給 3 秒強制貼底窗，接住陸續載入的訊息（獨立心跳會持續拉底）
  forceStickUntil = performance.now() + 3000;
  window.addEventListener("popstate", checkSendToken);
  document.addEventListener("click", () => {
    closeQuickReplyMenus();
    closePrefixPopover();
    closeLineAdvancedMenu();
    // 派單窗不因點旁邊關閉（填單時常要點聊天內容對照）；由 ESC / × / 取消 / 送出關閉
  });

  // 全域維護工作（建立按鈕/前綴/氣泡列/圖示）以 rAF 去抖動，每幀最多執行一次，避免忙迴圈卡住主執行緒。
  let maintQueued = false;
  function scheduleMaintenance() {
    if (maintQueued) return;
    maintQueued = true;
    requestAnimationFrame(() => {
      maintQueued = false;
      enhanceChatBodies();
      enhanceQuickReplyToolbars();
      enhancePrefixChip();
      enhanceLineAdvancedMenu();
      addDispatchButton();
      ensureQuickBar();
      checkSendToken();
      const oa = getOaId();
      const chat = getChatId();
      const apiContextChanged = oa !== lastOaId || chat !== lastChatId;
      if (lineAdvancedMenu && !lineAdvancedMenu.menu.hidden &&
          (lineAdvancedMenu.groupId !== oa || lineAdvancedMenu.account !== getDispatcher())) closeLineAdvancedMenu();
      if (lineCustomerDialog && lineCustomerDialog.account !== getDispatcher()) closeLineCustomers();
      if (oa !== lastOaId) {
        closeLineCustomers();
        lastOaId = oa;
        void loadLineChatDirectory();
        renderPrefixChip();
        closePrefixPopover();
        closeDispatchPopover();
      }
      if (chat !== lastChatId) {
        // 換對話：關掉派單窗（第二道保險，見 chatIdAtOpen 快照）——面板掛在 body 不隨
        // 聊天區重繪消失，留著會讓「填的是 A 客人、人在 B 對話」有機會發生（#39435）
        closeDispatchPopover();
        // 重設成「貼底」並重新尋找捲動容器，接著幾次把它拉到底
        lastChatId = chat;
        chatScroller = null;
        // 例外：從搜尋（訊息搜尋列開啟中，或左側清單搜尋結果點進來）
        // 切換的對話要停在命中訊息，強制貼底窗必須跳過。
        const viaSearch = isChatSearchOpen() || isChatlistSearchActive();
        pinnedToBottom = !viaSearch;
        if (chat && !viaSearch) {
          forceStickUntil = performance.now() + 3000; // 載入期強制貼底
          stickToBottomIfPinned();
        }
      }
      // 換對話只讓進行中的 Cookie 擷取失效，不自動讀取。
      if (apiContextChanged) ++lineApiDebugRun;
      stickToBottomIfPinned();
    });
  }

  window.addEventListener("popstate", scheduleMaintenance);

  // 所有增強工作（含 stickToBottomIfPinned）都在 rAF 維護迴圈裡做，
  // callback 本身不讀 layout、不掃 DOM——LINE 大量載入訊息時才不會 layout thrashing。
  const observer = new MutationObserver(scheduleMaintenance);
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();
