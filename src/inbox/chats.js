// 收件匣資料層：對話模型、官方帳號清單、SSE 連線與重連、對話載入與事件更新。
import { storeSet } from "../core/store.js";
import { inboxProbeAi } from "./ai.js";
import { inboxMarkRead } from "./chat-tools.js";
import { INBOX_ENABLED_KEY, INBOX_LIMIT_RETRY_MS, INBOX_OA_COLORS, INBOX_PAGES_PER_BOT, inbox, inboxApi, inboxBotName, inboxKey } from "./core.js";
import { inboxDismissToast, inboxNotify } from "./notify.js";
import { inboxLoadBoard, inboxQueueLink } from "./order-status.js";
import { inboxAppendToThread, inboxSetContext } from "./send.js";
import { inboxRenderAll, renderInboxRail } from "./shell.js";
import { lineChatsPageUrl } from "../line/fetch.js";
import { firstText } from "../line/sync.js";
import { LINE_CHAT_PROBE_MAX_IDS, lineMessageIds } from "../orders.js";
import { toast } from "../ui/toast.js";
import { LINE_BOT_ID_RE } from "../uturn-open.js";

/* ---- 資料模型 ---- */
// 對話清單的 latestEvent 與 SSE 的 payload 同形：{ type, timestamp, source, message }
function inboxPreview(ev) {
  if (!ev) return "";
  const m = ev.message;
  if (ev.type === "message" || ev.type === "messageSent") {
    if (!m) return "";
    switch (m.type) {
      case "text": case "textV2": return m.text || "";
      case "sticker": return "[貼圖]";
      case "image": return "[圖片]";
      case "video": return "[影片]";
      case "audio": return "[語音]";
      case "file": return "[檔案]";
      case "location": return "[位置]";
      case "coupon": return "[優惠券]" + (m.altText ? " " + m.altText : "");
      case "flex": case "template": case "imagemap": case "cardType":
        return "[卡片]" + (m.altText ? " " + m.altText : "");
      default: return `[${m.type || "訊息"}]`;
    }
  }
  return { follow: "[加入好友]", unfollow: "[封鎖]", join: "[加入群組]", postback: "[按了卡片按鈕]", callReceived: "[來電]" }[ev.type] || "";
}
function inboxChatFromLine(botId, item, prev) {
  const p = item.profile || {};
  const le = item.latestEvent || null;
  const unread = item.read === false;
  return {
    botId, chatId: item.chatId, key: inboxKey(botId, item.chatId),
    name: firstText([p.nickname, item.nickname, p.name]) || "（未提供名稱）",
    lineName: firstText([p.name]),
    nickname: firstText([p.nickname, item.nickname]),
    unread,
    // LINE 清單不給未讀「則數」：0 代表未知（畫紅點），只有 SSE 進來的才累計成數字
    unreadCount: unread && prev ? prev.unreadCount : 0,
    preview: inboxPreview(le) || (prev ? prev.preview : ""),
    at: item.lastTalkedAt || item.updatedAt || (le && le.timestamp) || 0,
    assignedBizId: item.assignedBizId || "",
    done: !!item.done,
    followedUp: !!item.followedUp, // LINE 的「待處理」標記
    avatarUrl: p.iconHash && p.iconHash !== "biz-app"
      ? `https://profile.line-scdn.net/${encodeURIComponent(p.iconHash)}/preview` : "",
    chatType: item.chatType || "",
    messageIds: inboxMergeIds(prev ? prev.messageIds : [], lineMessageIds(le ? [le] : [])), // 最近的訊息編號（比對乘客用）
  };
}
function inboxMergeIds(prev, ids) {
  const out = (prev || []).filter((id) => !ids.includes(id)).concat(ids);
  return out.slice(-LINE_CHAT_PROBE_MAX_IDS);
}
function inboxNoteMessageIds(chat, ids) {
  if (!chat || !ids.length) return;
  chat.messageIds = inboxMergeIds(chat.messageIds, ids);
  inboxQueueLink(chat);
}
// 未指派不顯示文字（清單與標題列都省略），只有「未指派」篩選用得到這個狀態
function inboxAssigneeLabel(chat) {
  if (!chat.assignedBizId) return "";
  return inbox.me && chat.assignedBizId === inbox.me.bizId ? "我負責" : "已指派";
}
function inboxUnreadTotal() {
  let n = 0;
  for (const c of inbox.chats.values()) if (c.unread) n++;
  return n;
}
/* ---- 帳號清單（含每個帳號的未讀數，未啟用的也看得到） ---- */
async function inboxLoadBots() {
  const data = await inboxApi("GET", "/api/v1/bots?limit=1000&noFilter=true");
  const list = Array.isArray(data?.list) ? data.list : [];
  if (!list.length && inbox.bots.length) return; // LINE 偶爾回空清單：沿用上一份，不要讓開關全部變關
  inbox.bots = list
    .filter((b) => b && typeof b.botId === "string" && LINE_BOT_ID_RE.test(b.botId) && !b.disabledCrm)
    .map((b, i) => ({
      botId: b.botId, name: firstText([b.name]) || b.botId, iconUrl: b.iconUrl || "",
      unreadCount: Number(b.unreadCount) || 0, color: INBOX_OA_COLORS[i % INBOX_OA_COLORS.length],
    }));
  inbox.botById = new Map(inbox.bots.map((b) => [b.botId, b]));
  // 清單暫時少了某個帳號也不從啟用清單拿掉（存的是使用者的選擇），只是先不監聽；權限回來就自動接上
}
// 啟用且目前清單裡有的帳號（實際要監聽的）
const inboxEnabledIds = () => [...inbox.enabled].filter((id) => inbox.botById.has(id));
/* ---- SSE：每個帳號一條；失敗退避重連；連線數已滿等一分鐘再試 ---- */
function inboxConn(botId) {
  let c = inbox.conns.get(botId);
  if (!c) { c = { botId, es: null, status: "off", lastEventId: "", retry: 0, timer: 0, error: "", connecting: false }; inbox.conns.set(botId, c); }
  return c;
}
function inboxDrop(c) {
  if (c.es) { c.es.close(); c.es = null; }
}
async function inboxConnect(botId) {
  const c = inboxConn(botId);
  if (c.es || c.connecting) return;
  clearTimeout(c.timer); c.timer = 0;
  c.connecting = true; c.status = "connecting"; c.error = "";
  renderInboxRail();
  let tok;
  try { tok = await inboxApi("POST", `/api/v1/bots/${botId}/streamingApiToken`, {}); }
  catch (e) { c.connecting = false; return inboxScheduleReconnect(c, e.message); }
  c.connecting = false;
  if (!inbox.enabled.has(botId)) { c.status = "off"; return renderInboxRail(); } // 等 token 期間被關掉
  const base = tok?.streamingApiBaseUrl || "https://chat-streaming-api.line.biz";
  const ver = tok?.streamingApiVersion || "v1";
  const q = new URLSearchParams({
    token: tok?.streamingApiToken || "", deviceType: "", clientType: "PC", pingSecs: "20",
    lastEventId: c.lastEventId || tok?.lastEventId || "",
  });
  const es = new EventSource(`${base}/api/${ver}/sse?${q}`);
  c.es = es;
  es.addEventListener("init", () => { if (c.es !== es) return; c.status = "live"; c.retry = 0; c.error = ""; renderInboxRail(); });
  es.addEventListener("ping", () => { inbox.lastEventAt = Date.now(); });
  es.addEventListener("chat", (ev) => {
    if (c.es !== es) return;
    inbox.lastEventAt = Date.now();
    if (ev.lastEventId) c.lastEventId = ev.lastEventId;
    inboxOnChatEvent(botId, ev.data).catch(() => {});
  });
  es.addEventListener("fail", (ev) => {
    if (c.es !== es) return;
    let sub = "";
    try { sub = JSON.parse(ev.data).subEvent || ""; } catch (_) {}
    inboxDrop(c);
    if (sub === "too_many_sse_connections") {
      c.status = "limit"; c.error = "連線數已滿，請關閉一個 LINE 分頁";
      c.timer = setTimeout(() => { c.timer = 0; if (inbox.enabled.has(botId)) inboxConnect(botId); }, INBOX_LIMIT_RETRY_MS);
      renderInboxRail();
    } else inboxScheduleReconnect(c, "LINE 中斷連線");
  });
  es.addEventListener("reload", () => { if (c.es !== es) return; inboxDrop(c); inboxScheduleReconnect(c, "LINE 要求重新連線"); });
  es.onerror = () => { if (c.es !== es) return; inboxDrop(c); inboxScheduleReconnect(c, "連線中斷"); };
}
function inboxScheduleReconnect(c, why) {
  if (!inbox.enabled.has(c.botId)) { c.status = "off"; c.error = ""; return renderInboxRail(); }
  c.status = "error"; c.error = why || ""; c.retry += 1;
  const delay = Math.min(30000, 2000 * 2 ** Math.min(c.retry - 1, 4));
  clearTimeout(c.timer);
  c.timer = setTimeout(() => { c.timer = 0; if (inbox.enabled.has(c.botId)) inboxConnect(c.botId); }, delay);
  renderInboxRail();
}
function inboxDisconnect(botId) {
  const c = inboxConn(botId);
  clearTimeout(c.timer); c.timer = 0;
  inboxDrop(c);
  c.status = "off"; c.error = ""; c.retry = 0;
}
function inboxSetEnabled(botId, on) {
  if (on) inbox.enabled.add(botId); else inbox.enabled.delete(botId);
  storeSet(INBOX_ENABLED_KEY, [...inbox.enabled]);
  if (on && !inbox.started) { /* 還沒授權：只記住，授權後 inboxStart 一起接上 */ }
  else if (on) {
    inboxConnect(botId);
    inboxLoadChats(botId).catch((e) => toast(`${inboxBotName(botId)}：讀取對話失敗，${e.message}`, "err", 4000));
    inboxLoadBoard(botId);
  } else {
    inboxDisconnect(botId);
    inbox.board.delete(botId);
    for (const [k, c] of inbox.chats) if (c.botId === botId) { inbox.chats.delete(k); inbox.threads.delete(k); inboxDismissToast(k); }
    if (inbox.selected && inbox.selected.startsWith(botId + "/")) { inbox.selected = null; inboxSetContext(null); }
  }
  inboxRenderAll();
}
/* ---- 對話清單與單一對話 ---- */
async function inboxLoadChats(botId) {
  let next = "";
  for (let page = 0; page < INBOX_PAGES_PER_BOT; page++) {
    const url = lineChatsPageUrl(botId, next);
    const data = await inboxApi("GET", url.pathname + url.search);
    if (!inbox.enabled.has(botId)) return;
    for (const item of data?.list || []) {
      if (!item || typeof item.chatId !== "string") continue;
      const k = inboxKey(botId, item.chatId);
      inbox.chats.set(k, inboxChatFromLine(botId, item, inbox.chats.get(k)));
    }
    inboxRenderAll();
    next = typeof data?.next === "string" ? data.next : "";
    if (!next) break;
  }
  inboxProbeAi(botId);
  for (const c of inbox.chats.values()) if (c.botId === botId) inboxQueueLink(c);
}
async function inboxFetchChat(botId, chatId) {
  try {
    const item = await inboxApi("GET", `/api/v1/bots/${botId}/chats/${encodeURIComponent(chatId)}`);
    if (!item || typeof item.chatId !== "string") return null;
    const k = inboxKey(botId, chatId);
    const chat = inboxChatFromLine(botId, item, inbox.chats.get(k));
    inbox.chats.set(k, chat);
    return chat;
  } catch (_) { return null; }
}
async function inboxOnChatEvent(botId, raw) {
  let data;
  try { data = JSON.parse(raw); } catch (_) { return; }
  const payload = data?.payload || {};
  const chatId = data?.chatId || payload?.source?.chatId;
  if (typeof chatId !== "string") return;
  const key = inboxKey(botId, chatId);
  const sub = data.subEvent;
  let chat = inbox.chats.get(key);
  if (!chat) {
    if (sub !== "message" && sub !== "messageSent") return; // 不在清單裡的對話只關心訊息
    chat = await inboxFetchChat(botId, chatId);
    if (!chat) return;
  }
  switch (sub) {
    case "message":
      chat.unread = true;
      chat.unreadCount += 1;
      chat.preview = inboxPreview(payload) || chat.preview;
      chat.at = payload.timestamp || Date.now();
      inboxAppendToThread(key, payload);
      inboxNoteMessageIds(chat, lineMessageIds([payload]));
      // 選項「自動標已讀」：正在看的這位客人又傳來，畫面在前景就直接標已讀、不跳通知
      if (inbox.autoRead && inbox.selected === key && document.visibilityState === "visible") inboxMarkRead(chat);
      else inboxNotify(chat, payload);
      break;
    case "messageSent":
      chat.preview = inboxPreview(payload) || chat.preview;
      chat.at = payload.timestamp || Date.now();
      inboxAppendToThread(key, payload);
      inboxNoteMessageIds(chat, lineMessageIds([payload]));
      break;
    case "read": // 客服（任一分頁）標了已讀
      chat.unread = false; chat.unreadCount = 0;
      inboxDismissToast(key);
      break;
    case "done": chat.done = true; break;
    case "undone": chat.done = false; break;
    case "followedUp": chat.followedUp = true; break;
    case "unfollowedUp": chat.followedUp = false; break;
    case "assigneeRemoved": chat.assignedBizId = ""; break;
    case "assigneeUpdated": case "nicknameUpdated": case "spam": case "unspam": case "delete": case "leave": case "botLeave": {
      const fresh = await inboxFetchChat(botId, chatId);
      if (!fresh) { inbox.chats.delete(key); inbox.threads.delete(key); inboxDismissToast(key); if (inbox.selected === key) inbox.selected = null; }
      break;
    }
    default: return; // typing／chatRead 等不重繪
  }
  inboxRenderAll();
}

export { inboxAssigneeLabel, inboxConnect, inboxEnabledIds, inboxFetchChat, inboxLoadBots, inboxLoadChats, inboxNoteMessageIds, inboxPreview, inboxSetEnabled, inboxUnreadTotal };
