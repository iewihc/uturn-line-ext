// 客人 ↔ 司機訊息一鍵轉傳（收件匣）：客人訊息「轉給司機」、司機訊息「轉給客人」、反白一段文字浮出小工具列。
import { setDriverChatMsgActions, driverChat, driverChatCompressImage, renderDriverChatMsgs } from "../driver-chat.js";
import { driverChatApi, liveOrders } from "../orders.js";
import { copyText } from "../ui/copy.js";
import { toast } from "../ui/toast.js";
import { ih, inbox, inboxApi } from "./core.js";
import { inboxMedia } from "./media.js";
import { inboxSend, inboxSendFiles, inboxSelectedChat } from "./send.js";
import { renderInboxThread } from "./thread.js";

/* ---------------------------------------------------------------------- *
 *   轉給司機：走司機對話（POST …/driver-chat/messages｜/images），對象＝這位客人進行中、已有司機的單；多台先選哪一台
 *   轉給客人：走收件匣送出（文字／圖片，同手動回覆）
 *   文字加前綴（客人說：／司機說：）讓對方分得出是誰講的；圖片原圖下載後轉傳（LINE 圖要帶登入、GCS 不給跨網域讀，一律 GM_xmlhttpRequest）
 *   按一下就送，不再確認；原訊息下方標轉傳結果，失敗可重試（多台只重送還沒成功的）；轉過的可以再轉，不限次數
 * ---------------------------------------------------------------------- */
const RELAY_PREFIX = { driver: "客人說：", customer: "司機說：" };
const RELAY_LABEL = { driver: "司機", customer: "客人" };
const relay = { status: new Map(), menu: null, bar: null }; // status：`${dir}:${訊息id}` → { state, error, retry, to }

const relayTargets = () => {
  const chat = inboxSelectedChat();
  return chat ? liveOrders(inbox.orders.get(chat.key)?.list).filter((o) => o.hasDriver) : [];
};
const carLabel = (o) => [o.carPlate || o.driverNo, o.carColor].filter(Boolean).join(" ") || o.shortId || "司機";

function relayRender() {
  renderInboxThread();
  renderDriverChatMsgs(false);
}
function relaySet(key, status) {
  relay.status.set(key, status);
  // 反白文字轉的沒有對應的泡泡可標：結果用提示
  if (key.includes(":sel:")) {
    const to = key.startsWith("driver") ? "司機" : "客人";
    if (status.state === "sent") toast(`已轉給${to}${status.to ? ` ${status.to}` : ""}`, "ok", 2500);
    if (status.state === "failed") toast(`沒轉給${to}：${status.error}`, "err", 4000);
    return;
  }
  relayRender();
}

// 下載圖片（帶瀏覽器登入；不受頁面跨網域限制）。再一律轉成 JPEG：
// GM 下載回來的 blob 常沒有型別（或是 application/octet-stream、webp），LINE 收件匣會當成「檔案」送出，客人看到的是 image.jpg 附件
function relayFetchImage(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET", url, responseType: "blob", timeout: 60000,
      onload: (r) => (r.status >= 200 && r.status < 300 && r.response
        ? resolve(r.response)
        : reject(new Error(`讀不到圖片（HTTP ${r.status}）`))),
      onerror: () => reject(new Error("讀不到圖片")),
      ontimeout: () => reject(new Error("讀取圖片逾時")),
    });
  }).then(relayToJpeg);
}
async function relayToJpeg(blob) {
  const bitmap = await createImageBitmap(blob).catch(() => { throw new Error("這不是圖片，沒辦法轉"); });
  return driverChatCompressImage(new File([await relayDrawJpeg(bitmap)], "image.jpg", { type: "image/jpeg" }));
}
function relayDrawJpeg(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圖片轉檔失敗"))), "image/jpeg", 0.92));
}

/* ---- 轉給司機 ---- */
// item：{ id, text } 或 { id, imageUrl }；anchor：多台時選單掛在哪顆按鈕旁
function relayToDriver(item, anchor) {
  const targets = relayTargets();
  if (!targets.length) return toast("這位客人沒有已派到司機的進行中訂單", "warn", 3000);
  if (targets.length === 1) return relaySendToDrivers(item, targets);
  relayPickCars(anchor, targets, (picked) => relaySendToDrivers(item, picked));
}
function relaySendToDrivers(item, orders) {
  const key = `driver:${item.id}`;
  const left = [...orders]; // 還沒送成功的車（重試只送這些）
  const to = orders.map(carLabel).join("、");
  const run = async () => {
    relaySet(key, { state: "sending", to });
    try {
      const image = item.lineImage ? await relayFetchImage(await relayLineImageUrl(item.id)) : null;
      while (left.length) {
        const order = left[0];
        const tempId = "relay_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        if (image) {
          const form = new FormData();
          form.append("tempId", tempId);
          form.append("file", image, image.name);
          await driverChatApi("POST", order.id, "/images", form);
        } else await driverChatApi("POST", order.id, "/messages", { content: RELAY_PREFIX.driver + item.text, tempId });
        left.shift();
      }
      relaySet(key, { state: "sent", to });
    } catch (e) {
      relaySet(key, { state: "failed", to, error: e.message || String(e), retry: run });
    }
  };
  return run();
}
// 多台：選哪一台（最後一項全部都轉）
function relayPickCars(anchor, orders, onPick) {
  relayCloseMenu();
  const r = anchor.getBoundingClientRect();
  const pick = (list) => () => { relayCloseMenu(); onPick(list); };
  const menu = ih("div", { class: "loe-relay-menu", role: "menu", "aria-label": "轉給哪一台" },
    ih("div", { class: "loe-relay-menu-title", text: "轉給哪一台？" }),
    ...orders.map((o, i) => ih("button", { type: "button", role: "menuitem", class: "loe-relay-menu-item", onclick: pick([o]) },
      ih("span", { class: "loe-relay-no", text: String(i + 1) }),
      ih("span", { class: "loe-relay-car" }, ih("strong", { text: carLabel(o) }), ih("span", { text: `${o.shortId || ""} · ${o.columnLabel || o.status || ""}` })))),
    ih("button", { type: "button", role: "menuitem", class: "loe-relay-menu-item all", text: orders.length === 2 ? "兩台都轉" : "全部都轉", onclick: pick(orders) }));
  menu.style.left = `${Math.min(r.left, window.innerWidth - 300)}px`;
  menu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 60 - orders.length * 56)}px`;
  document.body.append(menu);
  relay.menu = menu;
  setTimeout(() => document.addEventListener("pointerdown", relayMenuOutside, true), 0);
}
function relayMenuOutside(e) {
  if (relay.menu && !relay.menu.contains(e.target)) relayCloseMenu();
}
function relayCloseMenu() {
  document.removeEventListener("pointerdown", relayMenuOutside, true);
  relay.menu?.remove();
  relay.menu = null;
}

/* ---- 轉給客人（收件匣目前這位客人；司機對話面板就是這位客人的單） ---- */
function relayToCustomer(item) {
  const key = `customer:${item.id}`;
  const run = async () => {
    relaySet(key, { state: "sending" });
    try {
      const ok = item.imageUrl
        ? (await inboxSendFiles([await relayFetchImage(item.imageUrl)])).every(Boolean)
        : await inboxSend(RELAY_PREFIX.customer + item.text);
      relaySet(key, ok ? { state: "sent" } : { state: "failed", error: "LINE 沒有送出", retry: run });
    } catch (e) {
      relaySet(key, { state: "failed", error: e.message || String(e), retry: run });
    }
  };
  return run();
}

/* ---- 訊息下方的按鈕與結果（收件匣客人訊息、司機對話的司機訊息共用） ---- */
function relayControls(dir, item) {
  const st = relay.status.get(`${dir}:${item.id}`);
  const send = (e) => (dir === "driver" ? relayToDriver(item, e.currentTarget) : relayToCustomer(item));
  if (st?.state === "sending") return ih("span", { class: "loe-relay-status", text: `轉給${RELAY_LABEL[dir]}中…` });
  // 轉過的一樣可以再轉（不限次數）
  if (st?.state === "sent")
    return ih("span", { class: "loe-relay-status ok" }, `已轉給${RELAY_LABEL[dir]}${st.to ? ` ${st.to}` : ""} ✓`,
      ih("button", { type: "button", class: "loe-relay-btn", text: "再轉一次", title: `把這則訊息再轉給${RELAY_LABEL[dir]}`, onclick: send }));
  if (st?.state === "failed")
    return ih("span", { class: "loe-relay-status err" }, `沒轉成功：${st.error} `,
      ih("button", { type: "button", class: "loe-relay-retry", text: "重試", onclick: () => st.retry() }));
  return ih("button", { type: "button", class: "loe-relay-btn", text: `轉給${RELAY_LABEL[dir]}`, title: `把這則訊息轉給${RELAY_LABEL[dir]}`, onclick: send });
}
// 收件匣客人訊息：文字、圖片、位置；客人沒有已派到司機的單就不顯示
function inboxRelayControls(m) {
  const msg = m.message;
  if (!msg?.id || m.type === "messageSent" || !relayTargets().length) return null;
  const item = relayItemOfLine(msg);
  return item ? relayControls("driver", item) : null;
}
function relayItemOfLine(msg) {
  if (msg.type === "text" || msg.type === "textV2") return msg.text ? { id: msg.id, text: msg.text } : null;
  if (msg.type === "location") return { id: msg.id, text: [msg.title, msg.address].filter(Boolean).join(" ") || `${msg.latitude},${msg.longitude}` };
  // 客人的圖：網址按下去才找（剛收到的即時事件常還沒帶 contentProvider）；已過期的不給轉
  if (msg.type === "image") return inboxMedia(inboxSelectedChat()?.botId, msg)?.expired ? null : { id: msg.id, lineImage: true };
  return null;
}
// 客人那張圖的原圖網址：先看畫面上的訊息，沒有就重抓一次這位客人的訊息（順便把畫面上那則補成圖片）
async function relayLineImageUrl(msgId) {
  const chat = inboxSelectedChat();
  if (!chat) throw new Error("沒有選到客人");
  const th = inbox.threads.get(chat.key);
  const shown = th?.list.find((m) => m.message?.id === msgId);
  let media = shown && inboxMedia(chat.botId, shown.message);
  if (!media?.url) {
    const data = await inboxApi("GET", `/api/v3/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/messages`);
    const fresh = (data?.list || []).find((m) => m?.message?.id === msgId);
    if (fresh && shown) { shown.message = fresh.message; renderInboxThread(); }
    media = fresh && inboxMedia(chat.botId, fresh.message);
  }
  if (!media?.url) throw new Error("LINE 還沒給這張圖的網址，稍後再試");
  if (media.expired) throw new Error("這張圖已過期，LINE 不再提供");
  return media.url;
}
// 司機對話的司機訊息（只在收件匣：面板對應的就是目前這位客人）
function driverRelayControls(m) {
  if (driverChat.host !== inbox.el.dchat || m.sender !== "driver" || !m.id || m.isRecalled) return null;
  const item = m.type === "image" ? (m.imageUrl ? { id: m.id, imageUrl: m.imageUrl } : null)
    : m.type === "text" || m.type === "location" ? (m.content ? { id: m.id, text: m.content } : null) : null;
  return item ? relayControls("customer", item) : null;
}

/* ---- 反白一段文字：浮出小工具列（只轉反白那段） ---- */
function relayHideBar() {
  relay.bar?.remove();
  relay.bar = null;
}
function relayOnSelect() {
  const sel = document.getSelection();
  const text = sel && !sel.isCollapsed ? String(sel).trim() : "";
  const host = (n) => (n?.nodeType === 1 ? n : n?.parentElement)?.closest(".loe-inbox-msg.in, .loe-dchat-msg.in");
  const msgEl = text && host(sel.anchorNode);
  if (!msgEl || msgEl !== host(sel.focusNode)) return relayHideBar();
  const toDriver = msgEl.classList.contains("loe-inbox-msg");
  if (toDriver ? !relayTargets().length : driverChat.host !== inbox.el.dchat) return relayHideBar();
  const id = `sel:${Date.now()}`;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  relayHideBar();
  const keep = (e) => e.preventDefault(); // 按工具列不要取消反白
  const bar = ih("div", { class: "loe-relay-bar", role: "toolbar", "aria-label": "轉傳反白的文字", onmousedown: keep },
    ih("button", { type: "button", class: "primary", text: toDriver ? "轉給司機" : "轉給客人",
      onclick: (e) => { const item = { id, text }; if (toDriver) relayToDriver(item, e.currentTarget); else relayToCustomer(item); relayHideBar(); } }),
    ih("button", { type: "button", text: "複製", onclick: async () => { await copyText(text).catch(() => {}); toast("已複製", "ok", 1500); relayHideBar(); } }));
  bar.style.left = `${Math.max(8, rect.left + rect.width / 2 - 70)}px`;
  bar.style.top = `${Math.max(8, rect.top - 44)}px`;
  document.body.append(bar);
  relay.bar = bar;
}

let relayInited = false;
function initInboxRelay() {
  if (relayInited) return; // 同意條款後會再進一次收件匣啟動
  relayInited = true;
  setDriverChatMsgActions(driverRelayControls);
  document.addEventListener("mouseup", () => setTimeout(relayOnSelect, 0));
  document.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "Escape") relayOnSelect(); });
  document.addEventListener("scroll", relayHideBar, true);
}

export { inboxRelayControls, initInboxRelay };
