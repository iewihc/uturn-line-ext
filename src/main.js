// 入口：一般聊天頁等 DOMContentLoaded 再增強；收件匣頁 document-start 就接管整頁。
import { closeLineAdvancedMenu, enhanceLineAdvancedMenu, lineAdvancedMenu } from "./advanced-menu.js";
import { initAiToggle, refreshAiToggle, renderAiToggle } from "./ai-toggle.js";
import { initBoard } from "./board.js";
import { INBOX_MODE } from "./core/env.js";
import { getChatId, getOaId } from "./core/page-context.js";
import { addDispatchButton, closeDispatchPopover } from "./dispatch.js";
import { initDriverChat } from "./driver-chat.js";
import { bootInbox } from "./inbox/boot.js";
import { inboxTakeover } from "./inbox/takeover.js";
import { refreshLedgerBalance } from "./ledger.js";
import { invalidateLineApiCapture } from "./line/api-capture.js";
import { closeLineCustomers, lineCustomerDialog } from "./line/broadcast.js";
import { probeNativeChat } from "./native-orders.js";
import { closePrefixPopover, enhancePrefixChip, renderPrefixChip } from "./prefix.js";
import { closeQuickReplyMenus, enhanceQuickReplyToolbars, ensureQuickBar } from "./quick-reply/bar.js";
import { syncRemoteConfig } from "./remote-config.js";
import { forceStickFor, initScroll, resetScrollerForChat, stickToBottomIfPinned } from "./scroll.js";
import { checkSendToken } from "./send-token.js";
import { getDispatcher } from "./settings.js";
import { injectStyles } from "./styles.js";
import { enhanceChatBodies } from "./ui/chat-body.js";
import { checkUturnOpen, learnOaBotName, resumeUturnOpenNotice } from "./uturn-open.js";

if (INBOX_MODE) { inboxTakeover(); uturnMain(); }
else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", uturnMain, { once: true });
else uturnMain();

function uturnMain() {
  // 各模組載入時要掛的事件／計時器（原本散在整支腳本裡，順序與行為不變）
  initAiToggle();
  initScroll();
  initDriverChat();
  initBoard();

  injectStyles();
  if (INBOX_MODE) { bootInbox(); return; }
  /* ---------------------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------------------- */
  let lastOaId = getOaId();
  let lastChatId = getChatId();
  // 獨立心跳：不依賴 MutationObserver/rAF 鏈路（圖片後載、背景分頁回前景、
  // LINE 內部重排等都接得住）。全腳本只留這一個常駐計時器。
  let heartbeatPath = location.pathname;
  let heartbeatTick = 0;
  if (!INBOX_MODE) setInterval(() => {
    // SPA 的 pushState / replaceState 不一定更新 DOM，也不會觸發 popstate。
    // 只在操作對象改變時排入維護，確保舊視窗與 KEY 一併清除。
    // 先比對 pathname 字串，沒變就不拆解 URL（OA/chat id 都只由 pathname 推得）。
    const path = location.pathname;
    if (path !== heartbeatPath) {
      heartbeatPath = path;
      if (getOaId() !== lastOaId || getChatId() !== lastChatId) scheduleMaintenance();
    }
    if (lineCustomerDialog && lineCustomerDialog.account !== getDispatcher()) scheduleMaintenance();
    stickToBottomIfPinned();
    if (++heartbeatTick % 4 === 0) refreshLedgerBalance(); // 每秒一次（原獨立計時器併入）
  }, 250);
  // 每輪都要做的增強（建按鈕／前綴／氣泡列、處理 ?send）：開頁一次，之後每輪 rAF 維護再做
  function enhanceChatPage() {
    enhanceChatBodies();
    enhanceQuickReplyToolbars();
    enhancePrefixChip();
    enhanceLineAdvancedMenu();
    addDispatchButton();
    ensureQuickBar();
    checkSendToken();
  }
  enhanceChatPage();
  probeNativeChat();
  resumeUturnOpenNotice();
  checkUturnOpen();
  learnOaBotName();
  refreshAiToggle();
  // 已設定後台帳號 → 拉雲端設定（快速回覆 + 該車隊 Webhook）覆蓋本地快取。
  // 延到瀏覽器空閒（最多 1 秒）再發：讓 LINE 首屏先畫完，三支請求回來改 DOM 也不會擠在載入期。
  if (typeof requestIdleCallback === "function") requestIdleCallback(syncRemoteConfig, { timeout: 1000 });
  else setTimeout(syncRemoteConfig, 0);
  // 進頁面給 3 秒強制貼底窗，接住陸續載入的訊息（獨立心跳會持續拉底）
  forceStickFor(3000);
  window.addEventListener("popstate", checkSendToken);
  document.addEventListener("click", () => {
    closeQuickReplyMenus();
    closePrefixPopover();
    closeLineAdvancedMenu();
    // 派單窗不因點旁邊關閉（填單時常要點聊天內容對照）；由 ESC / × / 取消 / 送出關閉
  });
  // 全域維護工作（建立按鈕/前綴/氣泡列/圖示）以 rAF 去抖動，每幀最多執行一次，避免忙迴圈卡住主執行緒。
  let maintQueued = false;
  let observer = null; // 在下方建立；維護迴圈結束時要用它丟掉自己造成的紀錄
  function scheduleMaintenance() {
    if (maintQueued) return;
    maintQueued = true;
    requestAnimationFrame(() => {
      maintQueued = false;
      enhanceChatPage();
      checkUturnOpen();
      learnOaBotName();
      const oa = getOaId();
      const chat = getChatId();
      const apiContextChanged = oa !== lastOaId || chat !== lastChatId;
      if (lineAdvancedMenu && !lineAdvancedMenu.menu.hidden &&
          (lineAdvancedMenu.groupId !== oa || lineAdvancedMenu.account !== getDispatcher())) closeLineAdvancedMenu();
      if (lineCustomerDialog && lineCustomerDialog.account !== getDispatcher()) closeLineCustomers();
      if (apiContextChanged) refreshAiToggle();
      else renderAiToggle();
      if (oa !== lastOaId) {
        closeLineCustomers();
        lastOaId = oa;
        renderPrefixChip();
        closePrefixPopover();
        closeDispatchPopover();
      }
      if (chat !== lastChatId) {
        // 換對話：關掉派單窗（第二道保險，見 chatIdAtOpen 快照）——面板掛在 body 不隨
        // 聊天區重繪消失，留著會讓「填的是 A 客人、人在 B 對話」有機會發生（#39435）
        closeDispatchPopover();
        probeNativeChat(); // 換對話：這位客人交給後端比對乘客一次
        lastChatId = chat;
        resetScrollerForChat(chat);
      }
      // 換對話只讓進行中的 Cookie 擷取失效，不自動讀取。
      if (apiContextChanged) invalidateLineApiCapture();
      stickToBottomIfPinned();
      // 這一輪自己加的按鈕/class 也會產生 mutation 紀錄；rAF callback 是同步跑完的，
      // 此刻佇列裡只有我們自己造成的紀錄，直接丟掉，免得再觸發一輪空轉。
      if (observer) observer.takeRecords();
    });
  }
  window.addEventListener("popstate", scheduleMaintenance);
  // 所有增強工作（含 stickToBottomIfPinned）都在 rAF 維護迴圈裡做，
  // callback 本身不讀 layout、不掃 DOM——LINE 大量載入訊息時才不會 layout thrashing。
  // 只看節點增減：維護工作沒有任何一項依賴純文字變動（AI 狀態記在 aiState、
  // 貼底由心跳補），不監看 characterData 可省掉時間戳／未讀數每次更新的整輪維護。
  observer = new MutationObserver(scheduleMaintenance);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
