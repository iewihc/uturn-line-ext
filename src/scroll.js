// 「貼底」捲動穩定器：找出真正的捲動容器、記住是否貼底、載入期強制貼底。
import { refreshAiToggle } from "./ai-toggle.js";

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
function forceStickFor(ms) { forceStickUntil = performance.now() + ms; } // 強制貼底窗（載入期）
// 換對話：重設成「貼底」並重新尋找捲動容器，接著幾次把它拉到底。
// 例外：從搜尋（訊息搜尋列開啟中，或左側清單搜尋結果點進來）
// 切換的對話要停在命中訊息，強制貼底窗必須跳過。
function resetScrollerForChat(chat) {
  chatScroller = null;
  const viaSearch = isChatSearchOpen() || isChatlistSearchActive();
  pinnedToBottom = !viaSearch;
  if (chat && !viaSearch) {
    forceStickFor(3000); // 載入期強制貼底
    stickToBottomIfPinned();
  }
}
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

// 載入時註冊的事件／計時器：由 main.js 的 uturnMain() 呼叫一次。
function initScroll() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    stickToBottomIfPinned();
    refreshAiToggle(); // 回到分頁：AI 狀態可能已在調度中心切換或逾時自動交回
  });
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
}

export { forceStickFor, initScroll, nearBottom, resetScrollerForChat, stickToBottomIfPinned };
