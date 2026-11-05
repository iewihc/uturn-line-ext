// 收件匣對話標頭下的訂單列：這位客人的進行中訂單、收起／展開、司機對話開啟與停靠。
import { ic } from "../core/icons.js";
import { storeSet } from "../core/store.js";
import { closeDriverChat, driverChat, driverChatDock, driverChatNotifyOrders, openDriverChat, renderDriverChatHead, syncDriverChatOrders } from "../driver-chat.js";
import { renderInboxNotes } from "./chat-tools.js";
import { INBOX_DCHAT_DOCK_KEY, INBOX_ORDERS_COLLAPSED_KEY, ih, inbox } from "./core.js";
import { INBOX_BOARD_AFTER_ACTION_MS, inboxLoadBoard, inboxPatchBoard } from "./order-status.js";
import { renderInboxThread } from "./thread.js";
import { fetchChatOrders } from "../orders-lookup.js";
import { liveOrders, orderActionBusy, orderNotiSummary, orderRow, setOrderSystemNoti } from "../orders.js";

/* ---- 訂單狀態／系統自動通知 ---- */
async function inboxLoadOrders(chat) {
  const prev = inbox.orders.get(chat.key);
  const st = { list: prev ? prev.list : [], loading: true, error: "" };
  inbox.orders.set(chat.key, st);
  if (!prev && inbox.selected === chat.key) renderInboxOrders();
  try {
    st.list = await fetchChatOrders(chat.botId, chat.chatId);
    inboxPatchBoard(chat, st.list);
    driverChatNotifyOrders(st.list);
    if (inbox.selected === chat.key && driverChat.host === inbox.el.dchat) syncDriverChatOrders(st.list);
  } catch (e) { st.error = e.message || String(e); }
  st.loading = false;
  if (inbox.selected === chat.key) renderInboxOrders();
}
function openInboxDriverChat(orderId) {
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  const host = inbox.el.dchat;
  if (!chat || !host) return;
  if (inbox.notesOpen) { inbox.notesOpen = false; renderInboxNotes(); renderInboxThread(); }
  inboxPlaceDchat();
  host.hidden = false;
  openDriverChat({ host, orders: inbox.orders.get(chat.key)?.list || [], orderId, onClose: () => { host.hidden = true; renderInboxOrders(); } });
  renderInboxOrders();
}
// 收件匣司機對話兩種擺法：停靠＝放到 body 最後、成為第四欄（官方帳號｜官方訊息｜對話｜司機對話）；
// 浮動＝放回對話區、蓋在右側、可拖曳。切換只是把同一個節點搬家，內容與監聽都還在。
function inboxPlaceDchat() {
  const host = inbox.el.dchat;
  if (!host) return;
  const dock = inbox.dchatDock;
  host.classList.toggle("dock", dock);
  const parent = dock ? inbox.el.body : inbox.el.thread;
  if (host.parentElement !== parent) { driverChatDock(host); parent.append(host); }
}
function inboxToggleDchatDock() {
  inbox.dchatDock = !inbox.dchatDock;
  storeSet(INBOX_DCHAT_DOCK_KEY, inbox.dchatDock);
  inboxPlaceDchat();
  renderDriverChatHead();
  renderInboxOrders(); // 浮動時 top 由訂單列高度決定
}
function inboxReloadSelectedOrders() {
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  if (!chat) return;
  window.setTimeout(() => inboxLoadOrders(chat), 800);
  window.setTimeout(() => inboxLoadBoard(chat.botId), INBOX_BOARD_AFTER_ACTION_MS);
}
// 訂單有動作（開關自動通知、取消）：先重畫停用按鈕，結束後重抓
function inboxOrdersChanged(done) {
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  if (chat) inboxPatchBoard(chat, inbox.orders.get(chat.key)?.list || []);
  renderInboxOrders();
  if (done) inboxReloadSelectedOrders();
}
// 標頭「自動通知」（點擊整批開關）＋標頭下方訂單列；兩者都獨立於訊息串重繪（輪詢不會把捲動拉回底部）
function renderInboxOrders() {
  const slot = inbox.el.sysNotiSlot, bar = inbox.el.orderBar;
  if (!slot || !bar) return;
  slot.textContent = "";
  bar.textContent = "";
  bar.classList.remove("collapsed");
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  const st = chat && inbox.orders.get(chat.key);
  bar.hidden = !chat;
  if (!chat) return;
  const list = liveOrders(st && st.list);
  const notiList = list.filter((o) => o.systemNotiAvailable !== false); // 客叫／AI 單系統本來就會推通知，不在這裡開關
  const notiOn = notiList.some((o) => o.isSystemNoti);
  const notiTip = list.filter((o) => o.isSystemNoti).map((o) => `${o.shortId} ${orderNotiSummary(o) || "等待司機承接"}`).join("\n");
  slot.append(ih("button", { type: "button", class: "loe-inbox-btn loe-inbox-sysnoti" + (notiOn ? " on" : " off"), html: ic("bell"),
    disabled: !notiList.length || notiList.some((o) => orderActionBusy.has(o.id)),
    title: !notiList.length ? (list.length ? "客叫／AI 叫車的單系統會自己推 LINE 通知給乘客" : "沒有進行中的訂單")
      : notiOn ? `系統自動通知中（點擊全部關閉）\n${notiTip}`
        : "點擊開啟這位客人進行中訂單的系統自動通知（之後的承接／抵達自動傳給客人）",
    onclick: () => notiList.filter((o) => !!o.isSystemNoti === notiOn).forEach((o) => setOrderSystemNoti(o, !notiOn, inboxOrdersChanged)) },
    ih("span", { text: notiOn ? "自動通知" : "自動通知 關" })));

  if (!st || (st.loading && !list.length)) { bar.append(ih("span", { class: "loe-inbox-muted", text: "讀取訂單中…" })); return; }
  if (st.error && !list.length) { bar.append(ih("span", { class: "loe-inbox-muted err", text: "訂單讀取失敗：" + st.error })); return; }
  if (!list.length) { bar.append(ih("span", { class: "loe-inbox-muted", text: "目前沒有進行中的訂單" })); return; }
  // 右上角 ^ 收起：只剩每張單的狀態＋單號一行，記住選擇
  const collapsed = inbox.ordersCollapsed;
  bar.classList.toggle("collapsed", collapsed);
  bar.append(ih("button", { type: "button", class: "loe-inbox-x loe-inbox-orders-toggle", html: ic(collapsed ? "chevron-down" : "chevron-up"),
    title: collapsed ? "展開訂單列" : "收起訂單列", "aria-label": collapsed ? "展開訂單列" : "收起訂單列", "aria-expanded": collapsed ? "false" : "true",
    onclick: () => { inbox.ordersCollapsed = !collapsed; storeSet(INBOX_ORDERS_COLLAPSED_KEY, inbox.ordersCollapsed); renderInboxOrders(); } }));
  if (collapsed)
    bar.append(ih("div", { class: "loe-ord loe-ord-summary" }, ...list.map((o) =>
      ih("span", { class: "loe-ord-mini", title: o.oriTextDisplay || o.oriText || o.pickupAddress || "" },
        ih("span", { class: `loe-ord-col ${o.column || ""}`, text: o.columnLabel || o.status }), ih("strong", { text: o.shortId || "" })))));
  else
    for (const o of list)
      bar.append(orderRow(o, { onChange: inboxOrdersChanged,
        onChat: (id) => (driverChat.orderId === id ? closeDriverChat() : openInboxDriverChat(id)) }));
  // 司機對話面板從訂單列下方開始，不蓋住訂單列（訂單數會變，每次重畫重算）
  if (inbox.el.dchat && !inbox.el.dchat.hidden && !inbox.el.dchat.dataset.dragged && !inbox.el.dchat.classList.contains("dock")) inbox.el.dchat.style.top = `${bar.offsetTop + bar.offsetHeight}px`;
}

export { inboxLoadOrders, inboxReloadSelectedOrders, inboxToggleDchatDock, renderInboxOrders };
