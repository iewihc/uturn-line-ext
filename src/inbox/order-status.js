// 收件匣訂單狀態計數（預約／未派／承接／抵達／執行）與聊天室↔乘客連結。
import { ic } from "../core/icons.js";
import { storeSet } from "../core/store.js";
import { hasLineExtAuth, lineExtApi } from "../core/backend.js";
import { inboxEnabledIds, inboxFetchChat } from "./chats.js";
import { ih, inbox, INBOX_ORDER_FILTERS_COLLAPSED_KEY, inboxKey } from "./core.js";
import { renderInboxList } from "./list.js";
import { inboxLoadOrders } from "./orders.js";
import { inboxVisibleChats } from "./shell.js";
import { LINE_CHAT_RESOLVE_BATCH, liveOrders, resolveLineChats } from "../orders.js";

/* ---- 依訂單狀態篩選：每個啟用的官方帳號一次抓齊「每個聊天室進行中訂單的狀態」 ----
 *   GET /line-ext/oa/{bot}/board?version=（發送 KEY）：沒變只回 unchanged；後端 5 秒快取，多人同開一個帳號只查一次。
 *   relays＝客人的話要自動轉給司機的單（inbox/relay.js）。
 *   每 20 秒一輪（分頁在背景 60 秒）；自己派單、取消、開關通知後立刻補抓。 */
const ORDER_COLUMNS = [
  { id: "booking", label: "預約" }, { id: "pending", label: "未派" }, { id: "accepted", label: "承接" },
  { id: "arrived", label: "抵達" }, { id: "executing", label: "執行" },
];
const orderColumnLabel = (id) => (ORDER_COLUMNS.find((c) => c.id === id) || {}).label || id;
const INBOX_BOARD_REFRESH_MS = 20000;
const INBOX_BOARD_HIDDEN_MS = 60000;
const INBOX_BOARD_FETCH_MISSING = 10; // 一輪最多補抓幾位「有訂單但不在已載入對話裡」的客人
const INBOX_LINK_DEBOUNCE_MS = 1500;
const INBOX_BOARD_AFTER_ACTION_MS = 6000; // 派單／取消後補抓看板（後端看板快取 5 秒，太早抓會拿到舊的）
const inboxChatColumns = (chat) => (inbox.board.get(chat.botId)?.chats.get(chat.chatId)) || [];
async function inboxLoadBoard(botId) {
  if (!inbox.enabled.has(botId) || !hasLineExtAuth()) return;
  const prev = inbox.board.get(botId);
  const data = await lineExtApi("GET", `/line-ext/oa/${encodeURIComponent(botId)}/board`, undefined,
    prev ? `&version=${encodeURIComponent(prev.version)}` : "").catch(() => null);
  if (!data || !inbox.enabled.has(botId) || (data.unchanged && prev)) return;
  const chats = new Map((data.chats || []).map((c) => [c.chatId, c.columns || []]));
  // 訂單 → 聊天室：司機訊息通知卡據此開那位客人的對話
  const orderChat = new Map((data.chats || []).flatMap((c) => (c.orderIds || []).map((id) => [id, c.chatId])));
  // 聊天室 → 客人的話要自動轉給司機的單（轉傳開著、已有司機；不限「自己」範圍）
  const relays = new Map((data.relays || []).map((r) => [r.chatId, r.orderIds || []]));
  inbox.board.set(botId, { version: data.version || "", chats, orderChat, relays });
  for (const chatId of chats.keys()) inbox.linked.add(inboxKey(botId, chatId));
  // 有進行中訂單、但不在已載入對話裡的客人補抓進清單（依訂單狀態篩選才不會漏）
  const missing = [...chats.keys()].filter((id) => !id.startsWith("C") && !inbox.chats.has(inboxKey(botId, id))).slice(0, INBOX_BOARD_FETCH_MISSING);
  await Promise.all(missing.map((id) => inboxFetchChat(botId, id)));
  renderInboxList();
}
// 用剛查到的這位客人訂單（同一批、同欄位口徑）直接修正看板：完成／取消後計數立刻歸零
function inboxPatchBoard(chat, list) {
  const board = inbox.board.get(chat.botId);
  if (!board) return;
  const cols = [...new Set(liveOrders(list).map((o) => o.column))].filter((c) => ORDER_COLUMNS.some((x) => x.id === c));
  const prev = board.chats.get(chat.chatId) || [];
  if (prev.length === cols.length && prev.every((c) => cols.includes(c))) return;
  if (cols.length) board.chats.set(chat.chatId, cols); else board.chats.delete(chat.chatId);
  board.version = ""; // 下一輪整份重抓，跟後端對齊
  renderInboxList();
}
let inboxBoardTimer = 0;
function inboxScheduleBoard() {
  clearTimeout(inboxBoardTimer);
  inboxBoardTimer = setTimeout(async () => {
    try { await Promise.all(inboxEnabledIds().map((id) => inboxLoadBoard(id))); }
    finally { inboxScheduleBoard(); } // 某次出錯也不能讓輪詢停掉
  }, document.visibilityState === "visible" ? INBOX_BOARD_REFRESH_MS : INBOX_BOARD_HIDDEN_MS);
}
function renderInboxOrderFilters() {
  const host = inbox.el.orderFilters;
  if (!host) return;
  host.textContent = "";
  // 已授權就先畫出來（看板還沒回來前也能點，數字之後補上）
  host.hidden = !hasLineExtAuth() || !inboxEnabledIds().length;
  if (host.hidden) return;
  // 最前面一顆收起／展開：收起時整排只剩它（篩選照常生效；有選狀態就顯示在上面提醒）
  const collapsed = inbox.orderFiltersCollapsed;
  const active = collapsed && inbox.orderFilter ? orderColumnLabel(inbox.orderFilter) : "";
  host.append(ih("button", { type: "button", class: "loe-inbox-chip loe-inbox-chip-fold" + (active ? " on" : ""), "aria-expanded": collapsed ? "false" : "true",
    title: collapsed ? "展開訂單狀態篩選" : "收起訂單狀態篩選",
    onclick: () => { inbox.orderFiltersCollapsed = !collapsed; storeSet(INBOX_ORDER_FILTERS_COLLAPSED_KEY, inbox.orderFiltersCollapsed); renderInboxList(); } },
    ih("span", { class: "loe-inbox-chip-fold-icon", html: ic(collapsed ? "chevron-down" : "chevron-up") }), collapsed ? ih("span", { class: "loe-inbox-chip-fold-text", text: active || "訂單狀態" }) : null));
  if (collapsed) return;
  // 只算收件匣列得出來的官方對話（同上方篩選與搜尋）：數字＝點下去看到的列數；沒有對應對話的訂單不算
  const count = (col) => inboxVisibleChats(col).length;
  const chip = (id, label, n) => ih("button", {
    type: "button", class: "loe-inbox-chip" + (inbox.orderFilter === id ? " on" : ""), "aria-pressed": inbox.orderFilter === id ? "true" : "false",
    onclick: () => { inbox.orderFilter = id; renderInboxList(); },
  }, label, n ? ih("span", { class: "n", text: String(n) }) : null);
  host.append(chip("", "全部", 0), ...ORDER_COLUMNS.map((c) => chip(c.id, c.label, count(c.id))));
}
// 手動重新整理：所有已開帳號的訂單狀態整份重抓（不管版本），後端快取 5 秒內會回同一份
async function inboxRefreshBoards() {
  if (inbox.boardRefreshing) return;
  inbox.boardRefreshing = true;
  renderInboxList();
  try {
    for (const b of inbox.board.values()) b.version = "";
    await Promise.all(inboxEnabledIds().map((id) => inboxLoadBoard(id)));
  } finally {
    inbox.boardRefreshing = false;
    renderInboxList();
  }
}
// 還沒對應到乘客的聊天室排進佇列，攢一下整批送後端比對（大頭貼＋訊息編號沒變的不重問）
const inboxLinkQueue = new Set();
let inboxLinkTimer = 0;
function inboxQueueLink(chat) {
  if (!chat || chat.chatId.startsWith("C") || !inbox.enabled.has(chat.botId) || inbox.linked.has(chat.key)) return; // C 開頭＝群組
  const ids = chat.messageIds || [];
  if (!chat.avatarUrl && !ids.length) return;
  const sig = `${chat.avatarUrl}|${ids.join(",")}`;
  if (inbox.linkProbed.get(chat.key) === sig) return;
  inbox.linkProbed.set(chat.key, sig);
  inboxLinkQueue.add(chat.key);
  clearTimeout(inboxLinkTimer);
  inboxLinkTimer = setTimeout(inboxFlushLinks, INBOX_LINK_DEBOUNCE_MS);
}
async function inboxFlushLinks() {
  const keys = [...inboxLinkQueue];
  inboxLinkQueue.clear();
  if (!hasLineExtAuth()) { keys.forEach((k) => inbox.linkProbed.delete(k)); return; }
  const byBot = new Map();
  for (const key of keys) {
    const chat = inbox.chats.get(key);
    if (chat) byBot.set(chat.botId, [...(byBot.get(chat.botId) || []), chat]);
  }
  for (const [botId, chats] of byBot) {
    for (let i = 0; i < chats.length; i += LINE_CHAT_RESOLVE_BATCH) {
      const batch = chats.slice(i, i + LINE_CHAT_RESOLVE_BATCH);
      let linked;
      try {
        linked = await resolveLineChats(botId, batch.map((c) => ({ chatId: c.chatId, avatarUrl: c.avatarUrl, messageIds: c.messageIds || [] })));
      } catch (_) { batch.forEach((c) => inbox.linkProbed.delete(c.key)); continue; } // 暫時失敗：下次再問
      const fresh = linked.filter((id) => !inbox.linked.has(inboxKey(botId, id)));
      linked.forEach((id) => inbox.linked.add(inboxKey(botId, id)));
      if (!fresh.length) continue;
      inboxLoadBoard(botId);
      const sel = inbox.selected && inbox.chats.get(inbox.selected);
      if (sel && sel.botId === botId && fresh.includes(sel.chatId)) inboxLoadOrders(sel);
    }
  }
}

export { INBOX_BOARD_AFTER_ACTION_MS, inboxChatColumns, inboxLoadBoard, inboxPatchBoard, inboxQueueLink, inboxRefreshBoards, inboxScheduleBoard, orderColumnLabel, renderInboxOrderFilters };
