// 司機對話面板（收件匣停靠／浮動、看板抽屜、原生聊天頁浮動）：讀寫訊息、圖片、收回、拖曳。
import { INBOX_MODE } from "./core/env.js";
import { ic } from "./core/icons.js";
import { storeGet, storeSet } from "./core/store.js";
import { ih, inbox, inboxTime } from "./inbox/core.js";
import { inboxLinkify } from "./inbox/media.js";
import { inboxBeep, playTwoTone } from "./inbox/notify.js";
import { inboxToggleDchatDock, renderInboxOrders } from "./inbox/orders.js";
import { driverChatApi } from "./orders.js";
import { copyText, flashCopied } from "./ui/copy.js";
import { toast } from "./ui/toast.js";

/* ---------------------------------------------------------------------- *
 * 司機對話（調度 ↔ 司機，基於訂單）
 *   跟 admin 調度中心的司機對話是同一個對話：懶惰蟲用「身份授權」的發送 KEY 代表調度人員讀寫，
 *   司機在 App 看到的發話人是你的後台名稱。
 *   GET  /line-ext/orders/{id}/driver-chat?account=&sinceSeq=｜beforeMessageId=（X-Line-Send-Key）
 *   POST …/messages {content, tempId}；…/images（multipart file＋tempId）；…/read；…/messages/{mid}/recall
 *   面板開著每 3 秒抓新訊息；紅點＝訂單查詢的 lastDriverMessageAt 晚於本機「看過」的時間。
 *   收件匣：面板停靠在對話右側（同記事本）；LINE 原生聊天頁：派單左邊的「司機對話」開浮動面板。
 * ---------------------------------------------------------------------- */
const DRIVER_CHAT_POLL_MS = 3000;
const DRIVER_CHAT_SEEN_KEY = "loe_driver_chat_seen_v1"; // orderId → 看過的司機最後訊息時間（ms）
const DRIVER_CHAT_SEEN_MAX = 300;
const DRIVER_CHAT_IMAGE_MAX_PX = 1600;
const DRIVER_CHAT_RECALL_MS = 24 * 60 * 60 * 1000;
const driverChat = {
  host: null, onClose: null, // 面板掛載點（收件匣 aside／原生頁浮動 div）與關閉時的收尾
  orders: [], orderId: "", // 可切換的訂單（有司機的）與目前這張
  order: null, me: null, messages: [], latestSeq: 0, hasMore: false,
  syncedAt: "", readSentFor: "", // 已讀／收回變更的同步游標；已送過已讀的司機訊息 ID
  loading: false, polling: false, olderLoading: false, error: "", timer: 0, run: 0,
  el: {},
};
// 司機訊息下方額外的動作（收件匣掛「轉給客人」）；(訊息) → 節點或 null
let driverChatMsgActions = () => null;
const setDriverChatMsgActions = (fn) => { driverChatMsgActions = fn; };
const msOf = (iso) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? t : 0; };
function driverChatSeen() {
  const m = storeGet(DRIVER_CHAT_SEEN_KEY, {});
  return m && typeof m === "object" ? m : {};
}
function driverChatMarkSeen(orderId, iso) {
  const t = msOf(iso);
  if (!orderId || !t) return;
  const m = driverChatSeen();
  if ((m[orderId] || 0) >= t) return;
  m[orderId] = t;
  const keys = Object.keys(m);
  if (keys.length > DRIVER_CHAT_SEEN_MAX) keys.sort((a, b) => m[a] - m[b]).slice(0, keys.length - DRIVER_CHAT_SEEN_MAX).forEach((k) => delete m[k]);
  storeSet(DRIVER_CHAT_SEEN_KEY, m);
}
// 司機講了話、調度還沒看（目前開著的那張不算）
function driverChatUnread(order) {
  const t = msOf(order && order.lastDriverMessageAt);
  return !!t && driverChat.orderId !== order.id && (driverChatSeen()[order.id] || 0) < t;
}
// 兩個短音；收件匣用收件匣的提示音開關
let driverChatAudio = null;
function driverChatBeep() {
  if (INBOX_MODE) { if (inbox.sound) inboxBeep(); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    driverChatAudio = driverChatAudio || new Ctx();
    if (driverChatAudio.state !== "running") driverChatAudio.resume().catch(() => {});
    playTwoTone(driverChatAudio);
  } catch (_) {}
}
// 面板可拖曳：抓標題列拖，拖了就改成固定定位跟著滑鼠走（三種 host 都適用）；雙擊標題列或關閉就回原位
function driverChatDock(host) {
  host.style.cssText = "";
  delete host.dataset.dragged;
}
function driverChatDraggable(host, head) {
  const dock = () => {
    driverChatDock(host);
    renderDriverChatHead();
    if (host === inbox.el?.dchat) renderInboxOrders(); // 停靠位置由訂單列高度決定
  };
  driverChat.dock = dock;
  head.addEventListener("dblclick", (e) => {
    if (!e.target.closest(".loe-dchat-title") || e.target.closest("button, a")) return;
    dock();
  });
  head.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || host.classList.contains("dock") || !e.target.closest(".loe-dchat-title") || e.target.closest("button, a, input")) return;
    const r = host.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!moved) {
        moved = true;
        host.dataset.dragged = "1";
        Object.assign(host.style, { position: "fixed", width: `${r.width}px`, height: `${r.height}px`, right: "auto", bottom: "auto", margin: "0", flex: "none", zIndex: "2147483000" });
        renderDriverChatHead(); // 多出「回原位」鈕（head 本身不換，拖曳監聽還在）
      }
      host.style.left = `${Math.min(Math.max(r.left + dx, 0), window.innerWidth - 80)}px`;
      host.style.top = `${Math.min(Math.max(r.top + dy, 0), window.innerHeight - 40)}px`;
      ev.preventDefault();
    };
    const up = () => {
      head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); head.removeEventListener("pointercancel", up);
      try { head.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    try { head.setPointerCapture(e.pointerId); } catch (_) {}
    head.addEventListener("pointermove", move); head.addEventListener("pointerup", up); head.addEventListener("pointercancel", up);
  });
}
// 開面板：host 由呼叫端提供（收件匣 aside 或原生頁浮動 div），onClose 負責收掉 host
// focus：手動打開才把游標移到司機輸入框（自動打開不搶客人輸入框的游標）
function openDriverChat({ host, orders, orderId, onClose, focus = true }) {
  closeDriverChat();
  Object.assign(driverChat, {
    host, onClose, focus, orders: orders.filter((o) => o.hasDriver), orderId,
    order: null, me: null, messages: [], latestSeq: 0, hasMore: false, syncedAt: "", readSentFor: "", error: "", loading: true, run: driverChat.run + 1,
  });
  buildDriverChat();
  const run = driverChat.run;
  loadDriverChat(run);
  driverChat.timer = setInterval(() => pollDriverChat(run), DRIVER_CHAT_POLL_MS);
}
function closeDriverChat() {
  if (driverChat.timer) clearInterval(driverChat.timer);
  driverChat.timer = 0;
  driverChat.run++;
  const onClose = driverChat.onClose;
  if (driverChat.host) { driverChat.host.textContent = ""; driverChatDock(driverChat.host); }
  Object.assign(driverChat, { host: null, onClose: null, orderId: "", el: {}, dock: null });
  if (onClose) onClose();
}
// 訂單列表更新時同步面板的訂單分頁（目前這張不見了就關掉）
// 這台結束了：還有別台就換到第一台，沒有才關掉（以當前進行中的為主）
function syncDriverChatOrders(orders) {
  if (!driverChat.host) return;
  const withDriver = orders.filter((o) => o.hasDriver && !o.cancelled);
  if (!withDriver.some((o) => o.id === driverChat.orderId)) {
    if (!withDriver.length) return closeDriverChat();
    return openDriverChat({ host: driverChat.host, orders: withDriver, orderId: withDriver[0].id, onClose: driverChat.onClose, focus: false });
  }
  driverChat.orders = withDriver;
  renderDriverChatHead();
}
function driverChatIsMine(m) {
  return m.sender === "user" && !!driverChat.me && m.senderId === driverChat.me.id;
}
function driverChatMerge(list) {
  for (const m of list) {
    const i = driverChat.messages.findIndex((x) => m.id && x.id === m.id);
    if (i >= 0) driverChat.messages[i] = { ...driverChat.messages[i], ...m, pending: false, failed: "" };
    else driverChat.messages.push(m);
  }
  driverChat.messages.sort((a, b) => (a.seq && b.seq ? a.seq - b.seq : msOf(a.timestamp) - msOf(b.timestamp)));
}
// 畫面看得到、且有還沒送過已讀的司機訊息才標已讀（司機那邊才不會在你沒看時顯示已讀；切回分頁也會補標）
function driverChatMarkRead() {
  if (!driverChat.host || driverChat.loading) return;
  const lastDriver = [...driverChat.messages].reverse().find((m) => m.sender === "driver" && m.id);
  if (!lastDriver) return;
  driverChatMarkSeen(driverChat.orderId, lastDriver.timestamp);
  if (document.visibilityState !== "visible" || driverChat.readSentFor === lastDriver.id) return;
  driverChat.readSentFor = lastDriver.id;
  const last = driverChat.messages[driverChat.messages.length - 1];
  driverChatApi("POST", driverChat.orderId, "/read", { upToMessageId: (last && last.id) || "" })
    .catch(() => { if (driverChat.readSentFor === lastDriver.id) driverChat.readSentFor = ""; });
}
function driverChatApply(data) {
  driverChat.order = data.order || driverChat.order;
  driverChat.me = data.me || driverChat.me;
  driverChat.latestSeq = Math.max(driverChat.latestSeq, data.latestSeq || 0);
  if (data.syncedAt) driverChat.syncedAt = data.syncedAt;
}
// 既有訊息的已讀／收回有沒有變（司機讀了、司機或其他調度收回）
const driverChatMsgState = (m) => `${m.isRecalled ? 1 : 0}|${(m.readBy || []).map((r) => r.type).sort().join(",")}`;
async function loadDriverChat(run) {
  try {
    const data = await driverChatApi("GET", driverChat.orderId, "", undefined, "&limit=50");
    if (run !== driverChat.run) return;
    driverChatApply(data);
    driverChat.messages = [];
    driverChatMerge(data.messages || []);
    driverChat.hasMore = !!data.hasMore;
    driverChat.error = "";
  } catch (e) {
    if (run !== driverChat.run) return;
    driverChat.error = e.message || String(e);
  }
  driverChat.loading = false;
  renderDriverChat(true);
  if (run === driverChat.run) driverChatMarkRead();
}
async function pollDriverChat(run) {
  if (run !== driverChat.run || driverChat.loading || driverChat.polling) return;
  if (!driverChat.latestSeq) return loadDriverChat(run); // 還沒有任何訊息：重抓最新一頁
  driverChat.polling = true;
  try {
    const since = driverChat.syncedAt ? `&updatedSince=${encodeURIComponent(driverChat.syncedAt)}` : "";
    const data = await driverChatApi("GET", driverChat.orderId, "", undefined, `&sinceSeq=${driverChat.latestSeq}${since}&limit=100`);
    if (run !== driverChat.run) return;
    const incoming = data.messages || [];
    const known = new Map(driverChat.messages.filter((x) => x.id).map((x) => [x.id, x]));
    const fresh = incoming.filter((m) => !known.has(m.id));
    const changed = incoming.filter((m) => known.has(m.id) && driverChatMsgState(known.get(m.id)) !== driverChatMsgState(m));
    const statusChanged = data.order && driverChat.order && data.order.status !== driverChat.order.status;
    driverChatApply(data);
    const hadError = !!driverChat.error;
    driverChat.error = "";
    if (fresh.length || changed.length) driverChatMerge([...fresh, ...changed]);
    if (fresh.length || changed.length || hadError) renderDriverChatMsgs(false);
    if (fresh.some((m) => m.sender === "driver") && document.visibilityState !== "visible") driverChatBeep();
    driverChatMarkRead();
    if (statusChanged) renderDriverChatHead();
  } catch (e) {
    if (run === driverChat.run && !driverChat.error) { driverChat.error = e.message || String(e); renderDriverChatMsgs(false); }
  } finally {
    driverChat.polling = false;
  }
}
async function loadOlderDriverChat() {
  const first = driverChat.messages.find((m) => m.id);
  if (!first || driverChat.olderLoading) return;
  driverChat.olderLoading = true;
  renderDriverChatMsgs(false);
  const run = driverChat.run;
  const box = driverChat.el.msgs;
  const before = box ? box.scrollHeight - box.scrollTop : 0;
  try {
    const data = await driverChatApi("GET", driverChat.orderId, "", undefined, `&beforeMessageId=${encodeURIComponent(first.id)}&limit=50`);
    if (run !== driverChat.run) return;
    driverChatMerge(data.messages || []);
    driverChat.hasMore = !!data.hasMore;
  } catch (e) { toast("載入更早訊息失敗：" + (e.message || e), "err", 4000); }
  driverChat.olderLoading = false;
  renderDriverChatMsgs(false);
  if (box) box.scrollTop = box.scrollHeight - before; // 保持原本看到的位置
}
const newDriverChatTempId = () => "ext_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function driverChatPendingMessage(tempId, fields) {
  return { id: "", tempId, sender: "user", senderId: driverChat.me ? driverChat.me.id : "", senderName: driverChat.me ? driverChat.me.name : "",
    timestamp: new Date().toISOString(), pending: true, failed: "", ...fields };
}
// 送出（文字或圖片）：先放樂觀泡泡，成功換成正式訊息；失敗留著可點重送（同 tempId，後端不會重複）
async function driverChatSubmit(pending, request) {
  const run = driverChat.run;
  if (!driverChat.messages.includes(pending)) driverChat.messages.push(pending);
  pending.pending = true; pending.failed = "";
  renderDriverChatMsgs(true);
  try {
    const res = await request();
    if (run !== driverChat.run) return;
    const msg = res && res.message;
    if (msg) {
      const dup = driverChat.messages.findIndex((x) => x !== pending && x.id === msg.id); // 輪詢先抓到了
      if (dup >= 0) driverChat.messages.splice(driverChat.messages.indexOf(pending), 1);
      else Object.assign(pending, msg, { pending: false, failed: "" });
      driverChat.latestSeq = Math.max(driverChat.latestSeq, msg.seq || 0);
    }
  } catch (e) {
    if (run !== driverChat.run) return;
    pending.pending = false;
    pending.failed = e.message || String(e);
  }
  renderDriverChatMsgs(false);
}
function driverChatSendText(text) {
  const content = String(text || "").trim();
  if (!content || !driverChat.orderId) return false;
  const orderId = driverChat.orderId;
  const pending = driverChatPendingMessage(newDriverChatTempId(), { type: "text", content });
  pending.retry = () => driverChatSubmit(pending, () => driverChatApi("POST", orderId, "/messages", { content, tempId: pending.tempId }));
  pending.retry();
  return true;
}
async function driverChatSendImage(file) {
  if (!file || !/^image\//.test(file.type) || !driverChat.orderId) return;
  const orderId = driverChat.orderId;
  let upload;
  try { upload = await driverChatCompressImage(file); }
  catch (_) { return toast("讀不到這張圖片", "err", 3000); }
  const pending = driverChatPendingMessage(newDriverChatTempId(), { type: "image", imageUrl: URL.createObjectURL(upload) });
  pending.retry = () => driverChatSubmit(pending, () => {
    const form = new FormData();
    form.append("tempId", pending.tempId);
    form.append("file", upload, upload.name);
    return driverChatApi("POST", orderId, "/images", form);
  });
  pending.retry();
}
// 手機原圖常 5–15MB：長邊縮到 1600、轉 JPG 再傳（GIF 保留動畫不轉）
async function driverChatCompressImage(file) {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, DRIVER_CHAT_IMAGE_MAX_PX / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5e6 && file.type === "image/jpeg") return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("壓縮失敗"))), "image/jpeg", 0.85));
  return new File([blob], "image.jpg", { type: "image/jpeg" });
}
async function driverChatRecall(m) {
  if (!window.confirm("收回這則訊息？司機那邊也會看不到。")) return;
  try {
    await driverChatApi("POST", driverChat.orderId, `/messages/${encodeURIComponent(m.id)}/recall`, {});
    m.isRecalled = true;
    renderDriverChatMsgs(false);
  } catch (e) { toast("收回失敗：" + (e.message || e), "err", 4000); }
}
/* ---- 畫面 ---- */
// 骨架只建一次（輸入框草稿、捲動位置不因輪詢重繪而跑掉）；標頭與訊息各自重繪
function buildDriverChat() {
  const host = driverChat.host;
  host.textContent = "";
  const head = ih("div", { class: "loe-dchat-head" });
  const msgs = ih("div", { class: "loe-dchat-msgs" });
  const quick = ih("div", { class: "loe-dchat-quick" });
  const textarea = ih("textarea", { class: "loe-dchat-input", rows: "2", placeholder: "傳送訊息給司機 (Enter送出，Shift+Enter可換行)", "aria-label": "傳訊息給司機" });
  const fileInput = ih("input", { type: "file", accept: "image/*", hidden: true });
  const send = () => { if (driverChatSendText(textarea.value)) textarea.value = ""; textarea.focus(); };
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    e.stopPropagation(); // 不讓 LINE 頁面的快捷鍵吃掉輸入
  });
  textarea.addEventListener("paste", (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => /^image\//.test(f.type));
    if (file) { e.preventDefault(); driverChatSendImage(file); }
  });
  fileInput.addEventListener("change", () => { const f = fileInput.files && fileInput.files[0]; fileInput.value = ""; if (f) driverChatSendImage(f); });
  host.append(head, msgs, quick,
    ih("div", { class: "loe-dchat-composer" },
      textarea,
      ih("div", { class: "loe-dchat-btns" },
        ih("button", { type: "button", class: "loe-dchat-icon-btn", html: ic("image"), title: "傳圖片", "aria-label": "傳圖片", onclick: () => fileInput.click() }),
        ih("button", { type: "button", class: "loe-dchat-send", html: ic("send"), title: "傳送", "aria-label": "傳送", onclick: send })),
      fileInput));
  driverChat.el = { head, msgs, quick, textarea };
  driverChatDraggable(host, head);
  renderDriverChat(false);
  if (driverChat.focus) setTimeout(() => textarea.focus(), 0);
}
function renderDriverChat(scrollToEnd) {
  renderDriverChatHead();
  renderDriverChatMsgs(scrollToEnd);
  renderDriverChatQuick();
}
function renderDriverChatHead() {
  const head = driverChat.el.head;
  if (!head) return;
  head.textContent = "";
  const o = driverChat.order;
  const summary = driverChat.orders.find((x) => x.id === driverChat.orderId) || {};
  const plate = [o?.carPlate, o?.carColor].filter(Boolean).join(" ");
  head.append(...[
    ih("div", { class: "loe-dchat-title", title: driverChat.host?.classList.contains("dock") ? "" : "拖曳可移動面板，雙擊回原位" },
      ih("span", { class: "loe-dchat-grip", html: ic("grip"), "aria-hidden": "true" }),
      ih("strong", { text: "💬 司機對話" }),
      summary.columnLabel ? ih("span", { class: `loe-dchat-col ${summary.column || ""}`, text: summary.columnLabel }) : null,
      ih("span", { class: "loe-dchat-spacer" }),
      driverChat.host && driverChat.host === inbox.el?.dchat
        ? ih("button", { type: "button", class: "loe-dchat-x", html: ic(inbox.dchatDock ? "pop-out" : "panel-right"), "aria-pressed": inbox.dchatDock ? "true" : "false",
          title: inbox.dchatDock ? "改成浮動視窗（可拖曳）" : "停靠在最右邊（官方帳號｜官方訊息｜對話｜司機對話）", "aria-label": inbox.dchatDock ? "改成浮動視窗" : "停靠在最右邊", onclick: inboxToggleDchatDock })
        : null,
      driverChat.host?.dataset.dragged ? ih("button", { type: "button", class: "loe-dchat-x", html: ic("chevron-down"), title: "回原位", "aria-label": "面板回原位", onclick: () => driverChat.dock && driverChat.dock() }) : null,
      ih("button", { type: "button", class: "loe-dchat-x", html: ic("x"), "aria-label": "關閉司機對話", onclick: closeDriverChat })),
    // 多台：每台一個分頁（車號、車牌車色、狀態、未讀）；結束的單直接拿掉，以當前進行中的為主
    driverChat.orders.length > 1
      ? ih("div", { class: "loe-dchat-tabs", role: "tablist", "aria-label": "選哪一台" }, driverChat.orders.map((x, i) =>
        ih("button", { type: "button", role: "tab", class: "loe-dchat-tab" + (x.id === driverChat.orderId ? " on" : ""), "aria-selected": x.id === driverChat.orderId ? "true" : "false",
          onclick: () => { if (x.id !== driverChat.orderId) openDriverChat({ host: driverChat.host, orders: driverChat.orders, orderId: x.id, onClose: driverChat.onClose }); } },
          ih("span", { class: "loe-dchat-tab-no", text: String(i + 1) }),
          ih("span", { class: "loe-dchat-tab-text" },
            ih("strong", { text: [x.carPlate || x.driverNo, x.carColor].filter(Boolean).join(" ") || x.shortId || "訂單" }),
            ih("span", { class: `loe-dchat-tab-status ${x.column || ""}`, text: x.columnLabel || x.status || "" })),
          driverChatUnread(x) ? ih("span", { class: "loe-dchat-dot", "aria-label": "有新訊息" }) : null)))
      : null,
    // 單號・司機・車牌：一行文字，點哪段複製哪段
    ih("div", { class: "loe-dchat-info" }, ...[
      [o?.shortId || summary.shortId, o?.shortId || summary.shortId],
      [[o?.driverNo, o?.driverName].filter(Boolean).join(" "), o?.driverNo],
      [plate, o?.carPlate],
    ].filter(([label, value]) => label && value).flatMap(([label, value], i) => [
      i ? ih("span", { class: "loe-dchat-info-sep", text: "·", "aria-hidden": "true" }) : null,
      ih("button", { type: "button", class: "loe-dchat-info-item", text: label, title: "點擊複製",
        onclick: async (e) => { const b = e.currentTarget; try { flashCopied(b, await copyText(value)); } catch (_) { flashCopied(b, false); } } }),
    ]).filter(Boolean)),
  ].filter(Boolean)); // 原生 append 會把 null 印成文字
  // 多台：輸入框提示寫明傳給哪一台
  if (driverChat.el.textarea) {
    const no = driverChat.orders.findIndex((x) => x.id === driverChat.orderId) + 1;
    driverChat.el.textarea.placeholder = driverChat.orders.length > 1 && no
      ? `傳給第 ${no} 台 ${summary.carPlate || summary.driverNo || ""}…（Enter 送出）`
      : "傳送訊息給司機 (Enter送出，Shift+Enter可換行)";
  }
}
function driverChatBubbleBody(m) {
  if (m.isRecalled) return ih("em", { class: "loe-dchat-recalled", text: "訊息已收回" });
  const url = m.imageUrl || "";
  switch (m.type) {
    case "image":
      return url ? ih("a", { href: url, target: "_blank", rel: "noopener" }, ih("img", { class: "loe-dchat-img", src: url, alt: "圖片", loading: "lazy" })) : "[圖片]";
    case "audio": return url ? ih("a", { href: url, target: "_blank", rel: "noopener", text: "🎤 語音（點擊播放）" }) : "[語音]";
    case "video": return url ? ih("a", { href: url, target: "_blank", rel: "noopener", text: "🎬 影片（點擊播放）" }) : "[影片]";
    case "location": return "📍 " + (m.content || "位置");
    default: return inboxLinkify(m.content || "");
  }
}
function renderDriverChatMsgs(scrollToEnd) {
  const box = driverChat.el.msgs;
  if (!box) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.textContent = "";
  if (driverChat.error && !driverChat.messages.length) {
    box.append(ih("div", { class: "loe-dchat-empty err", text: driverChat.error }));
    return;
  }
  if (driverChat.loading) { box.append(ih("div", { class: "loe-dchat-empty", text: "讀取對話中…" })); return; }
  if (driverChat.hasMore)
    box.append(ih("button", { type: "button", class: "loe-dchat-older", text: driverChat.olderLoading ? "載入中…" : "載入更早訊息", disabled: driverChat.olderLoading, onclick: loadOlderDriverChat }));
  if (!driverChat.messages.length) box.append(ih("div", { class: "loe-dchat-empty", text: "還沒有訊息，跟司機打聲招呼吧" }));
  let prevSender = "";
  for (const m of driverChat.messages) {
    if (m.type === "system") { box.append(ih("div", { class: "loe-dchat-system", text: m.content || "" })); prevSender = ""; continue; }
    const fromDriver = m.sender === "driver";
    const mine = driverChatIsMine(m) || !!m.tempId && !m.id;
    const who = fromDriver ? `司機 ${m.senderName || ""}`.trim() : mine ? "我" : (m.senderName || "調度");
    const read = !fromDriver && (m.readBy || []).some((r) => r.type === "driver");
    const meta = m.pending ? "傳送中…" : m.failed ? `傳送失敗：${m.failed}（點擊重送）` : `${inboxTime(msOf(m.timestamp))}${read ? " · 已讀" : ""}`;
    const senderKey = `${m.sender}:${m.senderId || m.senderName}`;
    const bubble = ih("div", { class: "loe-dchat-bubble" + (m.failed ? " failed" : ""), onclick: m.failed && m.retry ? () => m.retry() : null }, driverChatBubbleBody(m));
    const canRecall = mine && m.id && !m.isRecalled && Date.now() - msOf(m.timestamp) < DRIVER_CHAT_RECALL_MS;
    box.append(ih("div", { class: "loe-dchat-msg " + (fromDriver ? "in" : "out") + (mine ? " mine" : "") },
      senderKey !== prevSender ? ih("div", { class: "loe-dchat-who", text: who }) : null,
      bubble,
      ih("div", { class: "loe-dchat-meta-line" },
        ih("span", { text: meta }),
        canRecall ? ih("button", { type: "button", class: "loe-dchat-recall", text: "收回", onclick: () => driverChatRecall(m) }) : null,
        driverChatMsgActions(m))));
    prevSender = senderKey;
  }
  if (driverChat.error) box.append(ih("div", { class: "loe-dchat-empty err", text: "連線不穩：" + driverChat.error }));
  if (scrollToEnd || nearBottom) box.scrollTop = box.scrollHeight;
}
function renderDriverChatQuick() {
  const bar = driverChat.el.quick;
  if (!bar) return;
  bar.textContent = "";
  const shortcuts = (driverChat.me && driverChat.me.shortcuts) || [];
  bar.hidden = !shortcuts.length;
  for (const text of shortcuts)
    bar.append(ih("button", { type: "button", class: "loe-dchat-chip", text, title: "帶入輸入框（快捷文字在 admin 調度中心編輯）",
      onclick: () => { const ta = driverChat.el.textarea; ta.value = ta.value ? `${ta.value} ${text}` : text; ta.focus(); } }));
}

// 載入時註冊的事件／計時器：由 main.js 的 uturnMain() 呼叫一次。
function initDriverChat() {
  document.addEventListener("visibilitychange", driverChatMarkRead);
}

export { closeDriverChat, driverChat, driverChatCompressImage, driverChatDock, driverChatUnread, initDriverChat, msOf, openDriverChat, renderDriverChatHead, renderDriverChatMsgs, setDriverChatMsgActions, syncDriverChatOrders };
