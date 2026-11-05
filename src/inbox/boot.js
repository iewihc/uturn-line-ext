// 收件匣啟動：條款 → 綁定畫面事件 → 讀官方帳號 → 授權閘門 → 連線與輪詢。
import { openDispatchPopover } from "../dispatch.js";
import { inboxConnect, inboxEnabledIds, inboxLoadBots, inboxLoadChats } from "./chats.js";
import { closeInboxContents } from "./contents.js";
import { INBOX_BOTS_REFRESH_MS, INBOX_ORDERS_REFRESH_MS, ih, inbox, inboxApi } from "./core.js";
import { renderInboxList } from "./list.js";
import { inboxBeep } from "./notify.js";
import { inboxLoadBoard } from "./order-status.js";
import { inboxLoadOrders } from "./orders.js";
import { inboxSend, inboxSendFiles } from "./send.js";
import { inboxApplyRail, inboxRenderAll, inboxToggleRail, renderInboxGate, renderInboxHeader, renderInboxRail } from "./shell.js";
import { hasAcceptedInboxTerms, showInboxTerms } from "./terms.js";
import { renderInboxContents, renderInboxPicker } from "./thread.js";
import { closePrefixPopover } from "../prefix.js";

function bootInbox() {
  const root = document.getElementById("loe-inbox");
  if (!root) return;
  if (!hasAcceptedInboxTerms()) { showInboxTerms(root); return; }
  root.inert = false;
  const $ = (sel) => root.querySelector(sel);
  inbox.el = {
    header: $(".loe-inbox-top"), rail: $(".loe-inbox-rail-list"), search: $(".loe-inbox-search"), foot: $(".loe-inbox-rail-foot"),
    railAside: $(".loe-inbox-rail"), railToggle: $(".loe-inbox-rail-toggle"), railStrip: $(".loe-inbox-rail-strip"),
    filters: $(".loe-inbox-filters"), rows: $(".loe-inbox-rows"), listSearch: $(".loe-inbox-list-search"),
    thHead: $(".loe-inbox-th-head"), thMsgs: $(".loe-inbox-th-msgs"), thComposer: $(".loe-inbox-composer"), thEmpty: $(".loe-inbox-th-empty"),
    quickBar: $(".loe-inbox-quick"), textarea: $(".loe-inbox-textarea"), toasts: $(".loe-inbox-toasts"), notes: $(".loe-inbox-notes"),
    orderBar: $(".loe-inbox-orders"), dchat: $(".loe-inbox-dchat"), orderFilters: $(".loe-inbox-order-filters"),
    picker: $(".loe-inbox-picker"), tools: $(".loe-inbox-tools"), toolsRight: $(".loe-inbox-tools-right"), fileInput: $(".loe-inbox-file"), modal: $(".loe-inbox-modal"),
    gate: $(".loe-inbox-gate"),
    body: $(".loe-inbox-body"), thread: $(".loe-inbox-thread"), board: $(".loe-board"), boardBar: $(".loe-board-bar"), boardCols: $(".loe-board-cols"),
    boardDrawer: $(".loe-board-drawer"), boardChat: null,
  };
  // 開著的對話定時重抓訂單狀態（分頁在背景就不抓）
  setInterval(() => {
    const chat = inbox.selected && inbox.chats.get(inbox.selected);
    if (chat && document.visibilityState === "visible") inboxLoadOrders(chat);
  }, INBOX_ORDERS_REFRESH_MS);
  inbox.el.search.addEventListener("input", renderInboxRail);
  inbox.el.railToggle.addEventListener("click", inboxToggleRail);
  inbox.el.railStrip.addEventListener("click", inboxToggleRail);
  inboxApplyRail();
  inbox.el.listSearch.addEventListener("input", renderInboxList);
  document.addEventListener("click", () => closePrefixPopover());
  const sendBtn = $(".loe-inbox-send");
  const doSend = async () => {
    const ta = inbox.el.textarea;
    sendBtn.disabled = true;
    const ok = await inboxSend(ta.value);
    sendBtn.disabled = false;
    if (ok) ta.value = "";
    ta.focus();
  };
  sendBtn.addEventListener("click", doSend);
  $(".loe-inbox-dispatch").addEventListener("click", (e) => { e.stopPropagation(); openDispatchPopover(""); });
  inbox.el.textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); }
  });
  // 貼上圖片／檔案就直接當檔案送（跟 LINE 聊天室一樣）
  inbox.el.textarea.addEventListener("paste", (e) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) { e.preventDefault(); inboxSendFiles(files); }
  });
  // 輸入框下方三顆：貼圖、表情貼／檔案／選擇內容
  inbox.el.tools.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tool]");
    if (!btn) return;
    e.stopPropagation();
    const tool = btn.dataset.tool;
    if (tool === "sticker") { inbox.picker = inbox.picker ? null : { kind: "sticker", pkg: "" }; renderInboxPicker(); }
    else if (tool === "file") inbox.el.fileInput.click();
    else if (tool === "contents") { inbox.contents = { tab: "saved", selected: null }; renderInboxContents(); }
  });
  inbox.el.fileInput.addEventListener("change", () => {
    const files = Array.from(inbox.el.fileInput.files || []);
    inbox.el.fileInput.value = "";
    inboxSendFiles(files);
  });
  inbox.el.modal.addEventListener("click", (e) => { if (e.target === inbox.el.modal) closeInboxContents(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (inbox.contents) closeInboxContents();
    else if (inbox.picker) { inbox.picker = null; renderInboxPicker(); }
  });
  // 第一個使用者手勢：建立 AudioContext（瀏覽器規定），之後新訊息才會響
  const unlock = () => { if (inbox.sound) inboxBeep(); };
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, unlock, { once: true, capture: true }));
  setInterval(() => { if (inbox.el.foot) renderInboxRail(); }, 10000); // 「最後事件 n 秒前」
  inboxRenderAll();
  renderInboxGate();
  (async () => {
    try {
      inbox.me = await inboxApi("GET", "/api/v1/me").catch(() => null);
      await inboxLoadBots();
    } catch (e) {
      inbox.el.rail.textContent = "";
      inbox.el.rail.append(ih("div", { class: "loe-inbox-empty err", text: `讀取官方帳號失敗：${e.message}` }));
      return;
    }
    inbox.botsLoaded = true;
    inboxRenderAll();
    renderInboxGate(); // 有授權才 inboxStart；沒有就停在閘門，按「身份授權」通過後再開始
    setInterval(() => inboxLoadBots().then(() => {
      // 之前不在清單（沒權限）的已開帳號回來了：接上（已在連線／重試中的不動，照原本退避）
      if (inbox.started) for (const id of inboxEnabledIds()) if (!inbox.conns.has(id)) { inboxConnect(id); inboxLoadChats(id).catch(() => {}); inboxLoadBoard(id); }
      renderInboxHeader();
      renderInboxRail();
    }).catch(() => {}), INBOX_BOTS_REFRESH_MS);
  })();
}

export { bootInbox };
