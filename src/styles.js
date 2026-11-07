// 整支腳本的樣式（LINE 聊天室增強 + 收件匣 + 訂單看板），boot 時注入一次。
import { BLUE, BLUE_HOVER, BLUE_SOFT, BUBBLE_CLASS, BUTTON_CLASS, COPIED_CLASS, DISPATCH_BUTTON_CLASS, DISPATCH_POP_CLASS, ESTIMATE_BUTTON_CLASS, FORWARD_BUTTON_CLASS, ICON_CLASS, PREFIX_CHIP_CLASS, QR_BAR_CLASS, QR_CHIP_CLASS, QUICK_BUTTON_CLASS, QUICK_MENU_CLASS, QUICK_MENU_OPEN_CLASS, TEXT_PAD_CLASS } from "./core/constants.js";

/* ---------------------------------------------------------------------- *
 * Styles
 * ---------------------------------------------------------------------- */
const STYLE_CSS = `
    .${BUBBLE_CLASS} { position: relative !important; }
    .${TEXT_PAD_CLASS} { padding-right: 34px !important; }

    /* 每則訊息的複製按鈕（白底膠囊、淡陰影描邊、hover 微浮起變藍） */
    /* 泡泡右上角的複製／轉發鈕：共用外觀，只有位置不同 */
    .${BUTTON_CLASS}, .${FORWARD_BUTTON_CLASS} {
      position: absolute;
      top: 7px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: var(--loe-glass, rgba(255, 255, 255, 0.94));
      color: var(--loe-muted, #64748b);
      cursor: pointer;
      opacity: 0.55;
      user-select: none;
      box-shadow: 0 1px 3px rgba(16,24,40,.12), 0 0 0 1px rgba(16,24,40,.06);
      transition: opacity .15s ease, color .15s ease, box-shadow .15s ease, transform .12s ease;
    }
    .${BUTTON_CLASS} { right: 7px; }
    .${FORWARD_BUTTON_CLASS} { right: 39px; }
    .${BUBBLE_CLASS}:hover .${BUTTON_CLASS}, .${BUBBLE_CLASS}:hover .${FORWARD_BUTTON_CLASS} { opacity: 1; }
    .${BUTTON_CLASS}:hover, .${BUTTON_CLASS}:focus-visible,
    .${FORWARD_BUTTON_CLASS}:hover, .${FORWARD_BUTTON_CLASS}:focus-visible {
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
      color: var(--loe-primary, #06c755);
      background: var(--loe-primary-soft, #effaf1);
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
      border: 1px solid var(--loe-border, rgba(15, 23, 42, 0.12));
      border-radius: 10px;
      background: var(--loe-paper, #fff);
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    }
    .${QUICK_BUTTON_CLASS}.${QUICK_MENU_OPEN_CLASS} .${QUICK_MENU_CLASS} { display: block; }
    .${QUICK_MENU_CLASS} ul { list-style: none; margin: 0; padding: 0; }
    .${QUICK_MENU_CLASS} li { margin: 0; padding: 0; }
    .loe-qr-empty {
      padding: 10px;
      color: var(--loe-faint, #94a3b8);
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
      border-bottom: 1px solid var(--loe-line, rgba(15, 23, 42, 0.06));
      scrollbar-width: thin;
    }
    .${QR_BAR_CLASS}::-webkit-scrollbar { height: 5px; }
    .${QR_BAR_CLASS}::-webkit-scrollbar-thumb { background: rgba(15,23,42,.14); border-radius: 6px; }
    .${QR_BAR_CLASS}::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,.26); }
    .${QR_CHIP_CLASS} {
      flex-shrink: 0;
      display: inline-flex; align-items: center;
      padding: 6px 14px;
      border: 1px solid var(--loe-border, rgba(15, 23, 42, 0.10));
      border-radius: 999px;
      background: var(--loe-paper, #fff);
      color: var(--loe-fg, #334155);
      font: inherit; font-size: 12.5px; font-weight: 500;
      line-height: 1.25;
      cursor: pointer; white-space: nowrap;
      max-width: 220px; overflow: hidden; text-overflow: ellipsis;
      box-shadow: 0 1px 2px rgba(16,24,40,.06);
      transition: background .14s ease, border-color .14s ease, color .14s ease, box-shadow .14s ease, transform .1s ease;
    }
    .${QR_CHIP_CLASS}:hover {
      background: ${BLUE_SOFT};
      border-color: var(--loe-info-line, rgba(28,108,243,.50));
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
      position: fixed; inset: 0; z-index: 2147483000; /* 低於收件匣通知卡 */
      display: flex; align-items: center; justify-content: center;
      background: rgba(15, 23, 42, 0.45);
    }
    .loe-modal {
      width: min(480px, 92vw);
      max-height: 86vh;
      display: flex; flex-direction: column;
      background: var(--loe-paper, #fff);
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.32);
      overflow: hidden;
      font-size: 14px;
      color: var(--loe-fg, #1f2937);
    }
    .loe-modal-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--loe-line, rgba(15,23,42,0.08));
      font-size: 15px; font-weight: 700;
    }
    .loe-modal-close {
      border: 0; background: transparent; cursor: pointer;
      font-size: 20px; line-height: 1; color: var(--loe-muted, #64748b); padding: 2px 6px; border-radius: 6px;
    }
    .loe-modal-close:hover { background: var(--loe-raise2, #f1f5f9); color: var(--loe-fg, #1f2937); }
    .loe-modal-body { padding: 16px 18px; overflow-y: auto; }
    .loe-customers-dialog { width: min(1080px, 94vw); max-height: 90vh; padding: 0; border: 0; border-radius: 16px; color: var(--loe-fg, #1f2937); background: var(--loe-paper, #fff); box-shadow: 0 24px 80px #0f172a40; font: 14px/1.5 system-ui, sans-serif; }
    .loe-customers-dialog::backdrop { background: #0f172a80; }
    .loe-customers-dialog * { box-sizing: border-box; }
    .loe-customers-dialog [hidden] { display: none !important; }
    .loe-customers-dialog button:disabled { opacity: .45; cursor: not-allowed; }
    .loe-customers-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
    .loe-customers-panel { padding: 18px; min-width: 0; }
    .loe-customers-compose { background: var(--loe-raise, #f8fafc); border-left: 1px solid var(--loe-border, #e2e8f0); }
    .loe-customers-muted { color: var(--loe-muted, #64748b); font-size: 12px; overflow-wrap: anywhere; }
    .loe-customers-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .loe-customers-search { display: flex; gap: 8px; margin-top: 12px; }
    .loe-customers-search input { min-width: 0; flex: 1; }
    .loe-customers-account-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .loe-customers-account-head .loe-customers-section-title { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    .loe-customers-sync { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; }
    .loe-customers-sync svg, .loe-advanced-menu svg { width: 16px; height: 16px; flex-shrink: 0; }
    .loe-customers-list { height: 330px; overflow: auto; border: 1px solid var(--loe-border, #e2e8f0); border-radius: 10px; }
    .loe-customer-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--loe-line, #f1f5f9); cursor: pointer; }
    .loe-customer-row:has(input:checked) { background: ${BLUE_SOFT}; }
    .loe-customer-row[data-excluded="true"], .loe-customer-row[data-excluded="true"]:has(input:checked) { background: var(--loe-warn-soft, #fff7ed); }
    .loe-customer-row[data-excluded="true"] .loe-customer-name { text-decoration: line-through; color: var(--loe-faint, #94a3b8); }
    .loe-customer-row[data-excluded="true"] .loe-customer-name::after { content: " · 不發送"; color: var(--loe-warn, #b45309); font-size: 12px; display: inline-block; text-decoration: none; }
    .loe-customer-select { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; cursor: pointer; }
    .loe-send-requirements { margin: 14px 0; padding: 12px; border: 1px solid var(--loe-border, #cbd5e1); border-radius: 10px; background: var(--loe-paper, #fff); }
    .loe-send-requirement + .loe-send-requirement { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--loe-border, #e2e8f0); }
    .loe-send-requirement-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .loe-send-badge { font-size: 12px; color: var(--loe-warn, #92400e); background: var(--loe-warn-soft, #fff7ed); border-radius: 20px; padding: 2px 8px; white-space: nowrap; }
    .loe-send-badge[data-ready="true"] { color: var(--loe-primary-dark, #166534); background: var(--loe-primary-soft, #f0fdf4); }
    .loe-send-badge[data-ready="optional"] { color: var(--loe-muted, #64748b); background: var(--loe-raise2, #f1f5f9); }
    .loe-excluded-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 130px; overflow: auto; margin: 8px 0; }
    .loe-excluded-list button { max-width: 100%; overflow-wrap: anywhere; text-align: left; }
    .loe-send-key-row { display: flex; gap: 6px; }
    .loe-send-requirements .loe-rate-input { width: 76px; margin: 0 4px; display: inline-block; }
    .loe-key-dialog { width: min(440px, 92vw); }
    .loe-key-dialog form { display: flex; flex-direction: column; gap: 10px; }
    .loe-send-key-row input { flex: 1; min-width: 0; }
    .loe-send-ready { margin: 10px 0; font-size: 12px; color: var(--loe-muted, #64748b); }
    .loe-customer-row input, .loe-customers-toolbar input { accent-color: ${BLUE}; }
    .loe-customer-avatar { width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%; background: var(--loe-raise2, #e2e8f0); object-fit: cover; }
    .loe-customer-info { min-width: 0; flex: 1; }
    .loe-customer-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .loe-customers-empty { padding: 42px 16px; text-align: center; color: var(--loe-muted, #64748b); }
    .loe-customers-status { min-height: 22px; font-size: 12px; color: var(--loe-muted, #64748b); }
    .loe-customers-status[data-error="true"] { color: var(--loe-error, #b91c1c); }
    .loe-customers-selection { color: ${BLUE}; font-weight: 600; }
    .loe-customers-section-title { margin: 0 0 8px; font-size: 15px; font-weight: 700; }
    .loe-customers-compose textarea { min-height: 130px; }
    .loe-customers-images { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .loe-customers-image { width: 92px; padding: 5px; border: 1px solid var(--loe-border, #e2e8f0); background: var(--loe-paper, #fff); border-radius: 8px; }
    .loe-customers-image img { width: 80px; height: 72px; object-fit: contain; display: block; }
    .loe-customers-image button { margin-top: 4px; width: 100%; }
    .loe-coupon-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; max-height: 380px; overflow: auto; margin: 10px 0; }
    .loe-coupon-card { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--loe-border, #cbd5e1); border-radius: 10px; background: var(--loe-paper, #fff); cursor: pointer; min-width: 0; overflow-wrap: anywhere; }
    .loe-coupon-card:has(input:checked) { border-color: ${BLUE}; background: ${BLUE_SOFT}; }
    .loe-coupon-card:has(input:disabled) { opacity: .6; cursor: default; }
    .loe-coupon-card img { display: block; width: 100%; height: 100px; object-fit: contain; background: var(--loe-raise2, #f1f5f9); border-radius: 6px; }
    .loe-coupon-card input { accent-color: ${BLUE}; }
    .loe-message-types { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; margin: 14px 0; background: var(--loe-raise2, #eef2f7); border-radius: 10px; }
    .loe-message-types label { position: relative; display: flex; align-items: center; justify-content: center; min-width: 0; padding: 9px 2px; border-radius: 7px; cursor: pointer; font-size: 13px; white-space: nowrap; }
    .loe-message-types input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .loe-message-types label:has(input:checked) { color: ${BLUE}; background: var(--loe-paper, #fff); box-shadow: 0 1px 4px #0f172a18; font-weight: 700; }
    .loe-message-types label:has(input:focus-visible) { outline: 2px solid ${BLUE}; outline-offset: 1px; }
    .loe-message-types label:has(input:disabled) { cursor: default; opacity: .65; }
    [data-role="coupons"] .loe-coupon-card { padding: 10px; gap: 8px; }
    [data-role="coupons"] .loe-coupon-card img { height: auto; aspect-ratio: 1; }
    [data-role="coupons"] .loe-coupon-card .loe-customers-muted { font-size: 12px; line-height: 1.5; }
    .loe-card-preview { display: flex; gap: 10px; overflow-x: auto; max-width: 100%; padding: 8px 0; }
    .loe-card-page { flex: 0 0 170px; min-width: 0; padding: 8px; border: 1px solid var(--loe-border, #cbd5e1); border-radius: 10px; overflow-wrap: anywhere; }
    .loe-card-page img { width: 100%; height: 150px; object-fit: contain; border-radius: 6px; background: var(--loe-raise2, #f1f5f9); }
    .loe-card-page p { margin: 6px 0; white-space: pre-wrap; }
    .loe-customers-preview-text { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 180px; overflow: auto; }
    .loe-customers-notice { padding: 9px 12px; margin: 12px 0; background: var(--loe-warn-soft, #fff7ed); color: var(--loe-warn, #9a3412); border-radius: 8px; font-size: 12px; }
    .loe-message-toast { position: fixed; right: 20px; bottom: 20px; width: min(360px, calc(100vw - 32px)); max-height: min(480px, 70vh); overflow: auto; padding: 14px; border: 1px solid var(--loe-border, #cbd5e1); border-radius: 12px; background: var(--loe-paper, #fff); color: var(--loe-fg, #1f2937); box-shadow: 0 8px 32px #0f172a33; z-index: 2147483647; overflow-wrap: anywhere; }
    .loe-message-toast-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .loe-message-toast progress { width: 100%; height: 6px; accent-color: ${BLUE}; }
    .loe-message-toast .loe-customers-toolbar { margin: 8px 0 0; }
    .loe-message-toast details { margin-top: 8px; }
    .loe-message-toast summary { cursor: pointer; color: ${BLUE}; font-size: 12px; }
    .loe-message-results { max-height: 240px; overflow: auto; }
    .loe-message-result { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--loe-border, #e2e8f0); }
    .loe-message-result > span { flex: 1; min-width: 0; white-space: pre-wrap; }
    .loe-message-result > button { flex-shrink: 0; }
    @media (max-width: 720px) { .loe-customers-layout { grid-template-columns: 1fr; } .loe-customers-compose { border-left: 0; border-top: 1px solid var(--loe-border, #e2e8f0); } .loe-customers-list { height: 240px; } }
    .loe-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
    .loe-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--loe-border, rgba(15,23,42,0.10));
      border-radius: 10px;
      background: var(--loe-raise, #fafbfc);
    }
    .loe-row-info { flex: 1; min-width: 0; }
    .loe-row-name { font-weight: 600; }
    .loe-row-text {
      color: var(--loe-muted, #64748b); font-size: 12px; margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .loe-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .loe-mini {
      border: 1px solid var(--loe-border, rgba(15,23,42,0.14));
      background: var(--loe-paper, #fff); border-radius: 7px;
      padding: 5px 10px; font-size: 12px; cursor: pointer; color: var(--loe-fg, #334155);
    }
    .loe-mini:hover { background: var(--loe-raise2, #f1f5f9); }
    .loe-mini:disabled { opacity: 0.35; cursor: default; }
    .loe-mini:disabled:hover { background: var(--loe-paper, #fff); }
    .loe-mini.danger { color: var(--loe-error, #dc2626); border-color: rgba(220,38,38,0.3); }
    .loe-mini.danger:hover { background: var(--loe-error-soft, #fef2f2); }
    .loe-form { display: flex; flex-direction: column; gap: 10px;
      border-top: 1px dashed var(--loe-border, rgba(15,23,42,0.14)); padding-top: 16px; }
    .loe-form-title { font-weight: 700; font-size: 13px; color: var(--loe-fg, #334155); }
    .loe-input, .loe-textarea {
      width: 100%; box-sizing: border-box;
      border: 1px solid var(--loe-border, rgba(15,23,42,0.18));
      border-radius: 8px; padding: 9px 11px;
      font: inherit; font-size: 13px; color: var(--loe-fg, #1f2937); background: var(--loe-paper, #fff);
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
      border: 1px solid var(--loe-border, rgba(15,23,42,0.16)); border-radius: 8px; cursor: pointer;
      background: var(--loe-paper, #fff); color: var(--loe-fg, #334155); font: inherit; font-size: 13px;
      padding: 9px 14px;
    }
    .loe-btn-ghost:hover { background: var(--loe-raise2, #f1f5f9); }
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
      padding: 8px 12px; border: 1px solid var(--loe-line, rgba(15,23,42,0.08)); border-radius: 8px; background: var(--loe-raise, #fafbfc); }
    .loe-ledger-row .loe-amt-pos { color: var(--loe-primary-dark, #16a34a); font-weight: 700; }
    .loe-ledger-row .loe-amt-neg { color: var(--loe-error, #dc2626); font-weight: 700; }
    .loe-ledger-date { color: var(--loe-faint, #94a3b8); font-size: 12px; margin-left: 8px; }
    .loe-ledger-formrow { display: flex; gap: 8px; align-items: center; }
    .loe-ledger-formrow select.loe-input { width: 64px; flex: none; }
    .loe-ledger-formrow input.loe-amt { flex: 1; }
    /* 車隊統一模板 chip：琥珀色系，與個人（白底）區隔 */
    .loe-qr-chip-fleet {
      background: var(--loe-warn-soft, #fff7e6);
      border-color: rgba(217,119,6,0.35);
      color: var(--loe-warn, #92400e);
    }
    .loe-qr-chip-fleet:hover { background: var(--loe-warn-soft, #ffedcc); }
    .loe-mgr-fleet-note { color: var(--loe-warn, #92400e); font-size: 12px; margin: 2px 0 8px; }
    .loe-row-fleet { background: var(--loe-warn-soft, #fff7e6); border-color: rgba(217,119,6,0.25); }
    .loe-ledger-del {
      margin-left: 8px; border: none; background: none; cursor: pointer;
      color: var(--loe-faint, #cbd5e1); font-size: 14px; line-height: 1; padding: 2px 4px; border-radius: 4px;
    }
    .loe-ledger-del:hover { color: var(--loe-error, #dc2626); background: rgba(220,38,38,0.08); }

    /* 轉發按鈕（放在複製按鈕左邊，樣式與複製一致） */
    /* 轉發鈕的外觀與複製鈕共用（見上方 .${BUTTON_CLASS}） */
    .${FORWARD_BUTTON_CLASS}.${COPIED_CLASS} {
      color: var(--loe-primary, #06c755); background: var(--loe-primary-soft, #effaf1); opacity: 1;
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
      border: 1px solid var(--loe-info-line, rgba(28,108,243,.35));
      border-radius: 999px;
      background: ${BLUE_SOFT};
      color: ${BLUE_HOVER};
      font-size: 12px; font-weight: 600;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      max-width: 220px;
    }
    .${PREFIX_CHIP_CLASS}:hover { border-color: ${BLUE}; background: var(--loe-info-soft, #e0ecff); }
    .${PREFIX_CHIP_CLASS} .loe-prefix-text { overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
    .${PREFIX_CHIP_CLASS}.loe-prefix-empty { color: ${BLUE}; background: var(--loe-paper, #fff); }
    .${PREFIX_CHIP_CLASS} > svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }

    /* 一鍵匯入所有設定按鈕 */
    .loe-import-btn {
      display: inline-flex; align-items: center; gap: 5px;
      margin-left: 6px; height: 28px; padding: 0 12px;
      border: 1px solid var(--loe-info-line, rgba(28,108,243,.35)); border-radius: 999px;
      background: var(--loe-paper, #fff); color: ${BLUE};
      font-size: 12px; font-weight: 600; line-height: 1;
      cursor: pointer; white-space: nowrap;
    }
    .loe-import-btn:hover { background: ${BLUE_SOFT}; border-color: ${BLUE}; color: ${BLUE_HOVER}; }
    .loe-console-button:disabled { opacity: .6; cursor: progress; }
    .loe-import-btn > svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
    .loe-advanced-menu {
      position: fixed; z-index: 2147483647; box-sizing: border-box;
      width: 160px; max-width: calc(100vw - 16px); padding: 5px;
      background: var(--loe-paper, #fff); border: 1px solid var(--loe-border, rgba(15,23,42,.12));
      border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.18);
    }
    .loe-advanced-menu[hidden] { display: none !important; }
    .loe-advanced-menu > button {
      display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; border: 0; border-radius: 6px;
      background: transparent; color: var(--loe-fg, #1f2937); font: inherit; font-size: 13px;
      line-height: 1.4; text-align: left; cursor: pointer;
    }
    .loe-advanced-menu > button:hover,
    .loe-advanced-menu > button:focus-visible { background: ${BLUE_SOFT}; color: ${BLUE_HOVER}; outline: none; }

    /* 前綴設定彈出框 */
    .loe-prefix-pop {
      position: fixed; z-index: 2147483647;
      width: 280px; padding: 12px;
      background: var(--loe-paper, #fff); border: 1px solid var(--loe-border, rgba(15,23,42,.12));
      border-radius: 12px; box-shadow: 0 14px 40px rgba(15,23,42,.22);
      font-size: 13px; color: var(--loe-fg, #1f2937);
    }
    .loe-prefix-pop .loe-pop-title { font-weight: 700; margin-bottom: 8px; font-size: 13px; }
    .loe-prefix-pop .loe-pop-hint { color: var(--loe-faint, #94a3b8); font-size: 11px; margin-bottom: 8px; line-height: 1.4; }
    .loe-prefix-pop input {
      width: 100%; box-sizing: border-box; border: 1px solid var(--loe-border, rgba(15,23,42,.18));
      border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; margin-bottom: 10px;
    }
    .loe-prefix-pop .loe-fleet-picker { position: relative; }
    .loe-prefix-pop .loe-fleet-suggest {
      position: absolute; left: 0; right: 0; top: calc(100% - 8px); z-index: 1;
      max-height: 220px; overflow-y: auto; padding: 4px;
      background: var(--loe-paper, #fff); border: 1px solid var(--loe-border, rgba(15,23,42,.12)); border-radius: 8px;
      box-shadow: 0 10px 24px rgba(15,23,42,.16);
    }
    .loe-prefix-pop .loe-fleet-suggest[hidden] { display: none; }
    .loe-prefix-pop .loe-fleet-suggest > button {
      display: block; width: 100%; text-align: left; border: 0; background: none;
      padding: 7px 8px; border-radius: 6px; font: inherit; font-size: 13px; color: inherit; cursor: pointer;
    }
    .loe-prefix-pop .loe-fleet-suggest > button:hover { background: ${BLUE_SOFT}; }
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

    /* 身份授權失效：畫面上方固定紅條（auth-health.js） */
    .loe-auth-banner {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 2147483646; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      max-width: min(860px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 10px;
      background: #b91c1c; color: #fff; font-size: 13px; line-height: 1.5;
      box-shadow: 0 10px 30px rgba(127,29,29,.35);
    }
    .loe-auth-banner strong { font-size: 14px; white-space: nowrap; }
    .loe-auth-banner span { flex: 1 1 280px; }
    .loe-auth-banner button {
      border: 1px solid rgba(255,255,255,.7); background: transparent; color: #fff;
      border-radius: 8px; padding: 5px 12px; font: inherit; cursor: pointer; white-space: nowrap;
    }
    .loe-auth-banner button.primary { background: #fff; color: #b91c1c; border-color: #fff; font-weight: 600; }
    .loe-auth-banner button:disabled { opacity: .6; cursor: default; }
    .loe-inbox-btn.auth-invalid { background: #b91c1c; border-color: #b91c1c; color: #fff; }

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
      background: var(--loe-paper, #fff); color: ${BLUE};
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
      color: var(--loe-faint, #9aa0a6); white-space: nowrap; user-select: none;
    }

    /* 派單彈出視窗（精簡版，限制高度避免超出畫面） */
    .${DISPATCH_POP_CLASS} {
      position: fixed; z-index: 2147483000; /* 低於收件匣通知卡 */
      width: 326px; padding: 12px; box-sizing: border-box; /* border-box：maxHeight 含內距，拖到下緣不會超出畫面 */
      background: var(--loe-paper, #fff); border: 1px solid var(--loe-border, rgba(15,23,42,.12));
      border-radius: 12px; box-shadow: 0 16px 44px rgba(15,23,42,.24);
      font-size: 13px; color: var(--loe-fg, #1f2937);
      overflow-y: auto;
    }
    .${DISPATCH_POP_CLASS} { position: fixed; } /* 確保 X 以此為定位基準 */
    .${DISPATCH_POP_CLASS} .loe-pop-title { font-weight: 700; font-size: 14px; margin: -12px -12px 6px; padding: 12px 34px 6px 12px; cursor: move; user-select: none; touch-action: none; }
    .${DISPATCH_POP_CLASS}.dragging { opacity: .92; user-select: none; }
    .${DISPATCH_POP_CLASS} .loe-pop-close {
      position: absolute; top: 8px; right: 10px;
      border: 0; background: transparent; cursor: pointer;
      font-size: 20px; line-height: 1; color: var(--loe-faint, #94a3b8); padding: 2px 6px; border-radius: 6px;
    }
    .${DISPATCH_POP_CLASS} .loe-pop-close:hover { background: var(--loe-raise2, #f1f5f9); color: var(--loe-fg, #1f2937); }
    .${DISPATCH_POP_CLASS} label.loe-fld { display: block; font-size: 11px; color: var(--loe-fg2, #475569); margin: 6px 0 2px; }
    .${DISPATCH_POP_CLASS} input:not([type=checkbox]), .${DISPATCH_POP_CLASS} textarea {
      width: 100%; box-sizing: border-box; border: 1px solid var(--loe-border, rgba(15,23,42,.18));
      border-radius: 8px; padding: 7px 10px; font: inherit; font-size: 13px;
    }
    .${DISPATCH_POP_CLASS} textarea { resize: vertical; min-height: 34px; }
    .${DISPATCH_POP_CLASS} input:focus, .${DISPATCH_POP_CLASS} textarea:focus { outline: none; border-color: ${BLUE}; box-shadow: 0 0 0 3px rgba(28,108,243,.12); }
    .${DISPATCH_POP_CLASS} .loe-check { display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; font-size: 12px; color: var(--loe-fg, #334155); cursor: pointer; line-height: 1.35; }
    .${DISPATCH_POP_CLASS} .loe-check input { width: 16px; height: 16px; margin: 1px 0 0; flex-shrink: 0; }
    .${DISPATCH_POP_CLASS} .loe-preview { margin: 8px 0 2px; padding: 7px 10px; background: var(--loe-raise, #f8fafc); border-radius: 8px; color: var(--loe-fg, #334155); font-size: 12px; white-space: pre-wrap; word-break: break-all; min-height: 16px; }
    .${DISPATCH_POP_CLASS} .loe-pop-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .${DISPATCH_POP_CLASS} .loe-check { align-items: center; }
    .loe-tpl-select { flex: 1; min-width: 0; border: 1px solid var(--loe-border, rgba(15,23,42,.18)); border-radius: 8px; padding: 5px 8px; font: inherit; font-size: 12px; background: var(--loe-paper, #fff); color: var(--loe-fg, #1f2937); cursor: pointer; }
    .loe-tpl-select:focus { outline: none; border-color: ${BLUE}; }

    /* AI 客服切換（聊天室頂端「待處理」左邊）：[AI處理][轉人工] 分段按鈕 */
    /* 一顆切換鈕：顯示目前狀態（AI處理＝靛藍、轉人工＝橘），只留框線＋彩色字，點一下切到另一邊 */
    .loe-ai-toggle {
      display: inline-flex; align-items: center; vertical-align: middle;
      margin-right: 6px; font-size: 12px; font-weight: 700; line-height: 1; white-space: nowrap;
    }
    .loe-ai-toggle button {
      height: 28px; padding: 0 10px; border-radius: 8px; background: var(--loe-paper, #fff); font: inherit; cursor: pointer;
      color: var(--loe-ai, #4f46e5); border: 1px solid color-mix(in srgb, currentColor 55%, transparent);
    }
    .loe-ai-toggle button.on.human { color: var(--loe-warn, #c2410c); }
    .loe-ai-toggle button:hover:not(:disabled) { background: color-mix(in srgb, currentColor 8%, #fff); }
    .loe-ai-toggle button:disabled { opacity: .6; cursor: progress; }
    .loe-ai-toggle .loe-ai-note { display: inline-flex; align-items: center; height: 28px; padding: 0 10px; color: var(--loe-faint, #94a3b8); font-weight: 600; cursor: help; }

    /* 訂單列（收件匣訂單列、原生頁訂單面板共用） */
    .loe-ord { display: flex; align-items: center; gap: 8px 10px; min-width: 0; flex-wrap: wrap; font-size: 13px; color: var(--loe-fg, #1f2937); }
    .loe-ord a { color: ${BLUE}; }
    .loe-ord-src { padding: 1px 6px; border-radius: 4px; background: var(--loe-warn-soft, #fef3c7); color: var(--loe-warn, #92400e); font-size: 11px; font-weight: 600; }
    .loe-ord-text { color: var(--loe-fg2, #374151); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 420px; min-width: 0; }
    /* 上車地址行（同 admin）：整行獨佔，行政區底線，門牌不一致紅字＋提醒，筆記 */
    .loe-ord-addr { flex: 1 0 100%; display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 12px; color: var(--loe-fg2, #374151); min-width: 0; }
    .loe-ord-addr-pin { display: inline-flex; color: ${BLUE}; }
    .loe-ord-addr-pin svg, .loe-ord-note svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .loe-ord-addr.bad .loe-ord-addr-pin, .loe-ord-addr.bad .loe-ord-addr-text { color: var(--loe-error, #b91c1c); }
    .loe-ord-district { text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1px; }
    .loe-ord-mismatch { font-weight: 700; color: var(--loe-error, #b91c1c); }
    .loe-ord-addr-warn { font-size: 10px; padding: 1px 4px; background: var(--loe-error-soft, #fee2e2); color: var(--loe-error, #b91c1c); }
    .loe-ord-note { display: inline-flex; align-items: center; gap: 3px; color: var(--loe-warn, #b45309); }
    .loe-ord-col { padding: 1px 8px; border-radius: 4px; color: var(--loe-muted, #637381); font-weight: 700; font-size: 12px; background: transparent; border: 1px solid color-mix(in srgb, currentColor 55%, transparent); }
    .loe-ord-col.booking { color: var(--loe-ai, #6d28d9); }
    .loe-ord-col.pending { color: var(--loe-warn, #b45309); }
    .loe-ord-col.accepted { color: var(--loe-info, #2f5fd0); }
    .loe-ord-col.arrived { color: var(--loe-primary-dark, #1b806a); }
    .loe-ord-col.executing { color: var(--loe-teal, #0f766e); }
    .loe-ord-actions { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
    .loe-ord-btn { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--loe-border, #d5dbe5); background: var(--loe-paper, #fff); color: var(--loe-fg, #1f2937); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
    .loe-ord-btn:hover:not(:disabled) { background: var(--loe-raise, #f8fafc); border-color: var(--loe-border-strong, #b6c2d6); }
    .loe-ord-btn:disabled { opacity: .55; cursor: progress; }
    .loe-ord-btn.on { background: var(--loe-info-soft, #eef4ff); border-color: ${BLUE}; color: ${BLUE}; }
    .loe-ord-btn.noti { color: var(--loe-muted, #6b7280); }
    .loe-ord-btn.noti.on { background: var(--loe-primary-soft, #ecfdf3); border-color: var(--loe-primary, #16a34a); color: var(--loe-primary-dark, #15803d); font-weight: 600; }
    .loe-ord-btn.relay { color: var(--loe-muted, #6b7280); }
    .loe-ord-btn.relay.on { background: ${BLUE}; border-color: ${BLUE}; color: #fff; font-weight: 600; } /* 轉傳中：實心強調（關著＝外框） */
    .loe-ord-btn.relay.on:hover:not(:disabled) { background: ${BLUE_HOVER}; border-color: ${BLUE_HOVER}; }
    .loe-ord-btn.cancel { color: var(--loe-error, #b91c1c); border-color: var(--loe-error-line, #fecaca); }
    .loe-ord-btn.cancel:hover:not(:disabled) { background: var(--loe-error-soft, #fef2f2); border-color: var(--loe-error-line, #f87171); }
    .loe-ord-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* 司機對話面板（收件匣右欄；內容與記事本共用一欄） */
    .loe-dchat-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
    .loe-dchat-head { flex: 0 0 auto; padding: 10px 12px 8px; border-bottom: 1px solid var(--loe-border, #e3e7ee); display: flex; flex-direction: column; gap: 6px; background: var(--loe-paper, #fff); }
    .loe-dchat-title { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: move; touch-action: none; user-select: none; }
    .loe-dchat-grip { display: inline-flex; color: var(--loe-faint, #cbd5e1); }
    .loe-dchat-grip svg { width: 14px; height: 14px; fill: currentColor; stroke: currentColor; }
    .loe-dchat-spacer { flex: 1 1 auto; }
    .loe-dchat-x { width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--loe-muted, #6b7280); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .loe-dchat-x:hover { background: var(--loe-raise2, #f1f5f9); }
    .loe-dchat-x svg, .loe-dchat-icon-btn svg, .loe-dchat-send svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .loe-dchat-col { padding: 0 8px; line-height: 18px; border-radius: 4px; color: var(--loe-muted, #637381); font-size: 12px; font-weight: 700; background: transparent; border: 1px solid color-mix(in srgb, currentColor 55%, transparent); }
    .loe-dchat-col.booking { color: var(--loe-ai, #6d28d9); } .loe-dchat-col.pending { color: var(--loe-warn, #b45309); }
    .loe-dchat-col.accepted { color: var(--loe-info, #2f5fd0); } .loe-dchat-col.arrived { color: var(--loe-primary-dark, #1b806a); } .loe-dchat-col.executing { color: var(--loe-teal, #0f766e); }
    .loe-dchat-tabs { display: flex; gap: 6px; overflow-x: auto; padding-top: 4px; }
    .loe-dchat-tab { position: relative; flex: 1 1 0; min-width: 120px; min-height: 44px; display: flex; align-items: center; gap: 8px; padding: 4px 10px; border: 1px solid var(--loe-border, #d5dbe5); border-radius: 10px; background: var(--loe-paper, #fff); font: inherit; text-align: left; cursor: pointer; }
    .loe-dchat-tab.on { border: 2px solid ${BLUE}; background: ${BLUE_SOFT}; }
    .loe-dchat-tab-no { width: 22px; height: 22px; border-radius: 50%; background: #334155; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex: none; }
    .loe-dchat-tab.on .loe-dchat-tab-no { background: ${BLUE}; }
    .loe-dchat-tab-text { display: flex; flex-direction: column; min-width: 0; }
    .loe-dchat-tab-text strong { font-size: 13px; color: var(--loe-fg, #1f2937); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .loe-dchat-tab-status { font-size: 12px; color: var(--loe-muted, #64748b); }
    .loe-dchat-tab-status.arrived { color: var(--loe-primary-dark, #15803d); font-weight: 700; }
    .loe-dchat-dot { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; background: #ef4444; border: 2px solid var(--loe-paper, #fff); }
    .loe-dchat-info { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 6px; font-size: 12px; color: var(--loe-muted, #64748b); }
    .loe-dchat-info-item { border: 0; background: none; padding: 2px 0; font: inherit; color: var(--loe-fg, #334155); cursor: pointer; }
    .loe-dchat-info-item:hover { color: ${BLUE}; text-decoration: underline; }
    .loe-dchat-info-sep { color: var(--loe-faint, #cbd5e1); }
    .loe-dchat-quick { display: flex; gap: 6px; flex-wrap: wrap; }
    .loe-dchat-chip { height: 24px; padding: 0 8px; border: 1px solid var(--loe-border, #e3e7ee); border-radius: 6px; background: var(--loe-raise, #f8fafc); color: var(--loe-fg, #334155); font: inherit; font-size: 12px; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .loe-dchat-chip:hover { border-color: ${BLUE}; color: ${BLUE}; }
    .loe-dchat-msgs { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 12px; background: var(--loe-bg, #f4f6f8); display: flex; flex-direction: column; gap: 4px; }
    .loe-dchat-empty { margin: auto; color: var(--loe-faint, #94a3b8); text-align: center; padding: 16px; }
    .loe-dchat-empty.err { color: var(--loe-error, #dc2626); margin: 8px 0; }
    .loe-dchat-older { align-self: center; height: 26px; padding: 0 12px; border: 1px solid var(--loe-border, #d5dbe5); border-radius: 999px; background: var(--loe-paper, #fff); font: inherit; font-size: 12px; cursor: pointer; margin-bottom: 6px; }
    .loe-dchat-system { align-self: center; max-width: 90%; padding: 4px 10px; border-radius: 8px; background: var(--loe-raise2, #e2e8f0); color: var(--loe-fg2, #475569); font-size: 12px; text-align: center; white-space: pre-line; }
    .loe-dchat-msg { display: flex; flex-direction: column; max-width: 82%; }
    .loe-dchat-msg.in { align-self: flex-start; align-items: flex-start; }
    .loe-dchat-msg.out { align-self: flex-end; align-items: flex-end; }
    .loe-dchat-who { font-size: 11px; color: var(--loe-muted, #64748b); margin: 6px 4px 2px; }
    .loe-dchat-relay { display: inline-block; margin-left: 6px; padding: 0 6px; border: 1px solid ${BLUE}; border-radius: 4px; color: ${BLUE}; font-size: 11px; font-weight: 600; }
    .loe-dchat-relay.failed { margin: 0 4px 2px; border-color: var(--loe-error, #b91c1c); color: var(--loe-error, #b91c1c); align-self: flex-start; }
    .loe-dchat-bubble { padding: 7px 11px; border-radius: 14px; background: var(--loe-paper, #fff); color: var(--loe-fg, #1f2937); white-space: pre-wrap; word-break: break-word; line-height: 1.45; box-shadow: 0 1px 1px rgba(15,23,42,.05); }
    .loe-dchat-msg.out .loe-dchat-bubble { background: var(--loe-info-soft, #dbeafe); }
    .loe-dchat-msg.out.mine .loe-dchat-bubble { background: ${BLUE}; color: #fff; }
    .loe-dchat-msg.out.mine .loe-dchat-bubble a { color: #fff; }
    .loe-dchat-bubble.failed { outline: 2px solid #ef4444; cursor: pointer; }
    .loe-dchat-img { display: block; max-width: 220px; max-height: 260px; border-radius: 8px; }
    .loe-dchat-recalled { color: var(--loe-faint, #94a3b8); }
    .loe-dchat-meta-line { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--loe-faint, #94a3b8); margin: 2px 4px 0; }
    .loe-dchat-recall { border: 0; background: none; padding: 0; color: var(--loe-faint, #94a3b8); font: inherit; cursor: pointer; text-decoration: underline; }
    .loe-dchat-recall:hover { color: var(--loe-error, #ef4444); }
    /* 客人 ↔ 司機一鍵轉傳 */
    .loe-relay-btn { border: 1px solid #c7d7fb; background: ${BLUE_SOFT}; color: ${BLUE}; border-radius: 6px; padding: 1px 8px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; margin-left: 6px; }
    .loe-relay-btn:hover { background: ${BLUE}; color: #fff; border-color: ${BLUE}; }
    .loe-relay-status { margin-left: 6px; font-size: 11px; color: var(--loe-muted, #64748b); }
    .loe-relay-status.ok { color: var(--loe-primary-dark, #15803d); font-weight: 700; }
    .loe-relay-status.err { color: var(--loe-error, #b91c1c); font-weight: 700; }
    .loe-relay-retry { border: 1px solid var(--loe-error-line, #fca5a5); background: var(--loe-paper, #fff); color: var(--loe-error, #b91c1c); border-radius: 6px; padding: 0 6px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
    .loe-relay-menu { position: fixed; z-index: 2147483600; width: 290px; background: var(--loe-paper, #fff); border-radius: 12px; box-shadow: 0 10px 28px rgba(15,23,42,.2); padding: 6px; display: flex; flex-direction: column; gap: 2px; }
    .loe-relay-menu-title { padding: 6px 8px; font-size: 12px; font-weight: 700; color: var(--loe-muted, #64748b); }
    .loe-relay-menu-item { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 6px 8px; border: 0; border-radius: 8px; background: none; text-align: left; font: inherit; cursor: pointer; }
    .loe-relay-menu-item:hover { background: ${BLUE_SOFT}; }
    .loe-relay-menu-item.all { color: ${BLUE}; font-weight: 700; }
    .loe-relay-no { width: 22px; height: 22px; border-radius: 50%; background: #334155; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex: none; }
    .loe-relay-car { display: flex; flex-direction: column; font-size: 12px; color: var(--loe-muted, #64748b); }
    .loe-relay-car strong { font-size: 13px; color: var(--loe-fg, #1f2937); }
    .loe-relay-bar { position: fixed; z-index: 2147483600; display: flex; gap: 2px; padding: 4px; background: #1f2937; border-radius: 10px; box-shadow: 0 6px 16px rgba(15,23,42,.3); }
    .loe-relay-bar button { height: 30px; padding: 0 10px; border: 0; border-radius: 7px; background: none; color: #e2e8f0; font: inherit; font-size: 13px; cursor: pointer; }
    .loe-relay-bar button.primary { background: ${BLUE}; color: #fff; font-weight: 700; }
    .loe-dchat-quick { flex: 0 0 auto; padding: 8px 12px 0; background: var(--loe-paper, #fff); border-top: 1px solid var(--loe-border, #e3e7ee); }
    .loe-dchat-quick[hidden] { display: none; }
    .loe-dchat-composer { flex: 0 0 auto; display: flex; gap: 8px; align-items: flex-end; padding: 8px 12px 12px; background: var(--loe-paper, #fff); }
    .loe-dchat-quick:not([hidden]) + .loe-dchat-composer { border-top: 0; }
    .loe-dchat-quick[hidden] + .loe-dchat-composer { border-top: 1px solid var(--loe-border, #e3e7ee); }
    .loe-dchat-input { flex: 1 1 auto; min-height: 40px; max-height: 140px; resize: vertical; padding: 8px 10px; border: 1px solid var(--loe-border, #d5dbe5); border-radius: 8px; font: inherit; font-size: 13px; }
    .loe-dchat-input:focus { outline: none; border-color: ${BLUE}; box-shadow: 0 0 0 3px rgba(28,108,243,.12); }
    .loe-dchat-btns { display: flex; flex-direction: column; gap: 6px; }
    .loe-dchat-icon-btn, .loe-dchat-send { width: 38px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .loe-dchat-icon-btn { border: 1px solid var(--loe-border, #d5dbe5); background: var(--loe-paper, #fff); color: var(--loe-fg2, #475569); }
    .loe-dchat-send { border: 0; background: ${BLUE}; color: #fff; }
    .loe-dchat-send:hover { background: ${BLUE_HOVER}; }
  `;
function injectStyles() {
  const style = document.createElement("style");
  style.textContent = STYLE_CSS;
  document.head.appendChild(style);
}

export { injectStyles };
