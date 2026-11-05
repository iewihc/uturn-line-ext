// LINE 原生聊天頁的「訂單」按鈕與面板、「司機對話」按鈕。
import { fetchAiProfile } from "./ai-toggle.js";
import { hasLineExtAuth } from "./core/backend.js";
import { DISPATCH_BUTTON_CLASS, DRIVER_CHAT_BUTTON_CLASS, DRIVER_CHAT_FLOAT_CLASS, NATIVE_ORDERS_BUTTON_CLASS, NATIVE_ORDERS_PANEL_CLASS } from "./core/constants.js";
import { INBOX_MODE } from "./core/env.js";
import { ic } from "./core/icons.js";
import { getChatId, getOaId } from "./core/page-context.js";
import { NATIVE_ORDERS_REFRESH_MS, closeDriverChat, driverChat, driverChatNotifyOrders, driverChatUnread, openDriverChat, syncDriverChatOrders } from "./driver-chat.js";
import { ih } from "./inbox/core.js";
import { fetchLineJson } from "./line/fetch.js";
import { fetchChatOrders } from "./orders-lookup.js";
import { lineMessageIds, liveOrders, orderRow, resolveLineChats } from "./orders.js";
import { getDispatcher } from "./settings.js";

/* ---- LINE 原生聊天頁：派單左邊的「司機對話」按鈕＋浮動面板 ---- */
const nativeOrders = { key: "", list: [], run: 0 };
async function refreshNativeOrders() {
  if (INBOX_MODE) return;
  const oa = getOaId(), chat = getChatId();
  const key = chat ? `${oa}/${chat}` : "";
  if (key !== nativeOrders.key) {
    nativeOrders.key = key;
    nativeOrders.list = [];
    closeDriverChat();
    closeNativeOrdersPanel();
    renderNativeButtons();
  }
  if (!key || !getDispatcher()) return;
  const run = ++nativeOrders.run;
  try {
    await nativeProbeChat(oa, chat);
    const list = await fetchChatOrders(oa, chat);
    if (run !== nativeOrders.run || key !== nativeOrders.key) return;
    nativeOrders.list = list;
    driverChatNotifyOrders(list);
    syncDriverChatOrders(list);
    renderNativeOrdersPanel();
    renderNativeButtons();
  } catch (_) { /* 後端暫時查不到就維持原狀，下次再試 */ }
}
// 這個聊天室本分頁還沒比對過乘客：讀大頭貼＋最近訊息編號交給後端比對一次（客叫／AI 單才找得到）
const nativeProbed = new Set();
async function nativeProbeChat(oa, chat) {
  const key = oa + "/" + chat;
  if (nativeProbed.has(key) || !hasLineExtAuth() || chat.startsWith("C")) return; // C 開頭＝群組
  nativeProbed.add(key);
  try {
    const [profile, msgs] = await Promise.all([
      fetchAiProfile(oa, chat).catch(() => null),
      fetchLineJson(new URL(`/api/v3/bots/${oa}/chats/${encodeURIComponent(chat)}/messages`, location.origin),
        { controller: new AbortController() }).catch(() => null),
    ]);
    const probe = { chatId: chat, avatarUrl: (profile && profile.avatarUrl) || "", messageIds: lineMessageIds(msgs && msgs.list) };
    if (probe.avatarUrl || probe.messageIds.length) await resolveLineChats(oa, [probe]);
  } catch (_) {
    nativeProbed.delete(key); // 網路／後端暫時失敗：下次再試
  }
}
function renderNativeButtons() {
  renderNativeOrdersButton();
  renderDriverChatButton();
}
// 「訂單 N」按鈕：這位客人有進行中訂單就出現（在司機對話／派單左邊），點開訂單面板
const nativeOrdersPanel = { el: null };
function renderNativeOrdersButton() {
  const group = document.querySelector(".send-group.btn-group");
  if (!group) return;
  let btn = group.parentElement.querySelector(`.${NATIVE_ORDERS_BUTTON_CLASS}`);
  const list = liveOrders(nativeOrders.list);
  if (!list.length) { if (btn) btn.remove(); closeNativeOrdersPanel(); return; }
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = NATIVE_ORDERS_BUTTON_CLASS;
    btn.title = "這位客人的進行中訂單：狀態、自動通知開關、取消";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (nativeOrdersPanel.el) closeNativeOrdersPanel();
      else openNativeOrdersPanel();
    });
    const anchor = group.parentElement.querySelector(`.${DRIVER_CHAT_BUTTON_CLASS}`) || group.parentElement.querySelector(`.${DISPATCH_BUTTON_CLASS}`);
    (anchor || group).insertAdjacentElement("beforebegin", btn);
  }
  const noti = list.some((o) => o.isSystemNoti);
  const sig = `${list.length}|${noti ? 1 : 0}|${nativeOrdersPanel.el ? 1 : 0}`;
  if (btn.dataset.sig === sig) return;
  btn.dataset.sig = sig;
  btn.classList.toggle("on", !!nativeOrdersPanel.el);
  btn.textContent = "";
  btn.insertAdjacentHTML("beforeend", ic(noti ? "bell" : "truck"));
  btn.append(ih("span", { text: `訂單 ${list.length}` }));
}
function openNativeOrdersPanel() {
  closeDriverChat();
  const host = ih("section", { class: NATIVE_ORDERS_PANEL_CLASS, "aria-label": "這位客人的訂單" });
  host.addEventListener("click", (e) => e.stopPropagation());
  document.body.appendChild(host);
  nativeOrdersPanel.el = host;
  renderNativeOrdersPanel();
  renderNativeOrdersButton();
}
function closeNativeOrdersPanel() {
  if (!nativeOrdersPanel.el) return;
  nativeOrdersPanel.el.remove();
  nativeOrdersPanel.el = null;
  renderNativeOrdersButton();
}
function nativeOrdersChanged(done) {
  renderNativeOrdersPanel();
  renderNativeButtons();
  if (done) window.setTimeout(refreshNativeOrders, 800);
}
function renderNativeOrdersPanel() {
  const host = nativeOrdersPanel.el;
  if (!host) return;
  const list = liveOrders(nativeOrders.list);
  host.textContent = "";
  host.append(
    ih("div", { class: "loe-ordp-head" },
      ih("strong", { text: "這位客人的訂單" }),
      ih("span", { class: "loe-dchat-spacer" }),
      ih("button", { type: "button", class: "loe-dchat-x", html: ic("x"), "aria-label": "關閉訂單面板", onclick: closeNativeOrdersPanel })),
    ih("div", { class: "loe-ordp-list" }, list.length
      ? list.map((o) => orderRow(o, { onChange: nativeOrdersChanged,
        onChat: (id) => { closeNativeOrdersPanel(); openNativeDriverChat(id); } }))
      : ih("div", { class: "loe-dchat-empty", text: "目前沒有進行中的訂單" })),
    ih("div", { class: "loe-ordp-hint", text: "自動通知開著時，司機承接／抵達會用建單人員的懶惰蟲，依車隊複製模板自動傳給客人；隨時可開關，已過的節點不補送。" }));
}
function renderDriverChatButton() {
  const group = document.querySelector(".send-group.btn-group");
  if (!group) return;
  let btn = group.parentElement.querySelector(`.${DRIVER_CHAT_BUTTON_CLASS}`);
  const withDriver = nativeOrders.list.filter((o) => o.hasDriver);
  if (!withDriver.length) { if (btn) btn.remove(); return; }
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = DRIVER_CHAT_BUTTON_CLASS;
    btn.title = "和這張單的司機對話（同 admin 調度中心的司機對話）";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (driverChat.host) return closeDriverChat();
      openNativeDriverChat();
    });
    const dispatchBtn = group.parentElement.querySelector(`.${DISPATCH_BUTTON_CLASS}`);
    (dispatchBtn || group).insertAdjacentElement("beforebegin", btn);
  }
  // 內容有變才重畫（維護迴圈每次 DOM 變動都會呼叫，避免自己改 DOM 又觸發自己）
  const unread = withDriver.filter(driverChatUnread).length;
  const sig = `${unread}|${driverChat.host ? 1 : 0}`;
  if (btn.dataset.sig === sig) return;
  btn.dataset.sig = sig;
  btn.classList.toggle("on", !!driverChat.host);
  btn.textContent = "";
  btn.insertAdjacentHTML("beforeend", ic("message-square"));
  btn.append(ih("span", { text: "司機對話" }));
  if (unread) btn.append(ih("span", { class: "loe-dchat-badge", text: String(unread) }));
}
function openNativeDriverChat(orderId) {
  const withDriver = nativeOrders.list.filter((o) => o.hasDriver);
  if (!withDriver.length) return;
  closeNativeOrdersPanel();
  const target = orderId || (withDriver.find(driverChatUnread) || withDriver[0]).id;
  const host = ih("section", { class: DRIVER_CHAT_FLOAT_CLASS, "aria-label": "司機對話" });
  host.addEventListener("click", (e) => e.stopPropagation());
  document.body.appendChild(host);
  openDriverChat({ host, orders: withDriver, orderId: target, onClose: () => { host.remove(); renderDriverChatButton(); } });
  renderDriverChatButton();
}

// 載入時註冊的事件／計時器：由 main.js 的 uturnMain() 呼叫一次。
function initNativeOrders() {
  if (!INBOX_MODE) setInterval(refreshNativeOrders, NATIVE_ORDERS_REFRESH_MS);
}

export { initNativeOrders, refreshNativeOrders, renderNativeButtons };
