// 收件匣資料層：對話模型、官方帳號清單、SSE 連線與重連、對話載入與事件更新。
import { storeSet } from "../core/store.js";
import { inboxProbeAi } from "./ai.js";
import { inboxMarkRead } from "./chat-tools.js";
import { INBOX_ENABLED_KEY, INBOX_LIMIT_RETRY_MS, INBOX_OA_COLORS, INBOX_PAGES_PER_BOT, INBOX_POLL_MS, inbox, inboxApi, inboxBotName, inboxKey } from "./core.js";
import { inboxDismissToast, inboxNotify } from "./notify.js";
import { inboxLoadBoard, inboxQueueLink } from "./order-status.js";
import { inboxAppendToThread, inboxRefreshThread, inboxSetContext } from "./send.js";
import { inboxRenderAll, renderInboxHeader, renderInboxRail } from "./shell.js";
import { renderInboxThread } from "./thread.js";
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
    pinnedAt: item.pinnedAt || 0, // LINE 的「釘選」：有時間＝釘在清單最上面
    avatarUrl: p.iconHash && p.iconHash !== "biz-app"
      ? `https://profile.line-scdn.net/${encodeURIComponent(p.iconHash)}/preview` : "",
    chatType: item.chatType || "",
    // 客人已讀水位：官方送出時間 ≤ 這個時間就標「已讀」（同 LINE 聊天室）；只增不減
    userReadAt: Math.max(item.userLastReadAt || 0, prev ? prev.userReadAt || 0 : 0),
    messageIds: inboxMergeIds(prev ? prev.messageIds : [], lineMessageIds(le ? [le] : [])), // 最近的訊息編號（比對乘客用）
  };
}
function inboxNoteUserRead(chat, at) {
  if (!chat || !(at > (chat.userReadAt || 0))) return false;
  chat.userReadAt = at;
  return true;
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
/* ---- SSE：每個帳號一條；失敗退避重連；連線數已滿改輪詢、隔一陣子再試 SSE ---- */
function inboxConn(botId) {
  let c = inbox.conns.get(botId);
  if (!c) { c = { botId, es: null, status: "off", lastEventId: "", retry: 0, timer: 0, error: "", connecting: false, polling: false, pollTimer: 0 }; inbox.conns.set(botId, c); }
  return c;
}
function inboxDrop(c) {
  if (c.es) { c.es.close(); c.es = null; }
}
async function inboxConnect(botId) {
  const c = inboxConn(botId);
  if (c.es || c.connecting) return;
  clearTimeout(c.timer); c.timer = 0;
  c.connecting = true; c.status = c.polling ? "poll" : "connecting"; c.error = ""; // 輪詢中再試 SSE：畫面維持「輪詢中」
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
  es.addEventListener("init", () => { if (c.es !== es) return; c.status = "live"; c.retry = 0; c.error = ""; inboxStopPoll(c); renderInboxRail(); });
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
    if (sub === "too_many_sse_connections") { // 名額被別的分頁／帳號用完：選項開「輪詢」就改輪詢，否則只等；隔一陣子再試 SSE
      c.error = "";
      if (inbox.pollFallback) { c.status = "poll"; inboxStartPoll(c); } else { c.status = "limit"; inboxStopPoll(c); }
      c.timer = setTimeout(() => { c.timer = 0; if (inbox.enabled.has(botId)) inboxConnect(botId); }, INBOX_LIMIT_RETRY_MS);
      renderInboxRail(); renderInboxHeader();
    } else inboxScheduleReconnect(c, "LINE 中斷連線");
  });
  es.addEventListener("reload", () => { if (c.es !== es) return; inboxDrop(c); inboxScheduleReconnect(c, "LINE 要求重新連線"); });
  es.onerror = () => { if (c.es !== es) return; inboxDrop(c); inboxScheduleReconnect(c, "連線中斷"); };
}
/* ---- 輪詢備援：SSE 名額用完的帳號，每 INBOX_POLL_MS 抓對話清單第一頁，最新事件沒看過就當成 SSE 事件處理 ---- */
function inboxStartPoll(c) {
  if (c.polling) return;
  c.polling = true;
  c.pollTimer = setTimeout(() => inboxPollOnce(c), Math.floor(Math.random() * INBOX_POLL_MS)); // 錯開各帳號
}
function inboxStopPoll(c) {
  c.polling = false;
  clearTimeout(c.pollTimer); c.pollTimer = 0;
}
// 選項「超過連線上限改用輪詢」切換：正在等名額的帳號立刻開始輪詢；關掉就停輪詢、回到只等
function inboxApplyPollFallback() {
  for (const c of inbox.conns.values()) {
    if (!inbox.enabled.has(c.botId) || c.es || (c.status !== "poll" && c.status !== "limit")) continue;
    if (inbox.pollFallback) { c.status = "poll"; inboxStartPoll(c); } else { c.status = "limit"; inboxStopPoll(c); }
  }
  renderInboxRail(); renderInboxHeader();
}
const inboxChatSig = (c) => [c.at, c.unread, c.done, c.followedUp, c.pinnedAt, c.assignedBizId, c.preview, c.name].join("|");
async function inboxPollOnce(c) {
  c.pollTimer = 0;
  if (!inbox.enabled.has(c.botId) || !c.polling) return;
  try {
    const url = lineChatsPageUrl(c.botId, "");
    const data = await inboxApi("GET", url.pathname + url.search);
    if (!inbox.enabled.has(c.botId) || !c.polling) return;
    let changed = false;
    for (const item of data?.list || []) {
      if (!item || typeof item.chatId !== "string") continue;
      const key = inboxKey(c.botId, item.chatId);
      const prev = inbox.chats.get(key);
      const le = item.latestEvent;
      const id = le?.message?.id;
      // 沒看過的最新訊息事件：有 id 比 id，沒有就比時間；清單裡本來沒有的對話出現在第一頁＝有新動靜
      const isNew = !!le && (le.type === "message" || le.type === "messageSent") &&
        (prev ? (id ? !prev.messageIds.includes(id) : (le.timestamp || 0) > prev.at) : true);
      const chat = inboxChatFromLine(c.botId, item, prev);
      inbox.chats.set(key, chat);
      if (isNew) {
        inboxOnMessageEvent(chat, key, le.type, le);
        if (inbox.selected === key) inboxRefreshThread(chat); // 期間可能不只一則
        changed = true;
      } else if (!prev || inboxChatSig(prev) !== inboxChatSig(chat)) changed = true;
    }
    if (changed) inboxRenderAll();
  } catch (_) { /* 這輪失敗就等下一輪 */ }
  if (inbox.enabled.has(c.botId) && c.polling && !c.pollTimer) c.pollTimer = setTimeout(() => inboxPollOnce(c), INBOX_POLL_MS);
}
// 客人傳來／官方送出的訊息事件（SSE 與輪詢共用）
function inboxOnMessageEvent(chat, key, sub, payload) {
  chat.preview = inboxPreview(payload) || chat.preview;
  chat.at = payload.timestamp || Date.now();
  inboxAppendToThread(key, payload);
  inboxNoteMessageIds(chat, lineMessageIds([payload]));
  if (sub !== "message") return;
  chat.unread = true;
  chat.unreadCount += 1;
  // 選項「自動標已讀」：正在看的這位客人又傳來，畫面在前景就直接標已讀、不跳通知
  if (inbox.autoRead && inbox.selected === key && document.visibilityState === "visible") inboxMarkRead(chat);
  else inboxNotify(chat, payload);
}
function inboxScheduleReconnect(c, why) {
  if (!inbox.enabled.has(c.botId)) { c.status = "off"; c.error = ""; return renderInboxRail(); }
  if (c.polling) { c.status = "poll"; c.error = ""; } else { c.status = "error"; c.error = why || ""; } // 輪詢中 SSE 再失敗：照常輪詢
  c.retry += 1;
  const delay = Math.min(30000, 2000 * 2 ** Math.min(c.retry - 1, 4));
  clearTimeout(c.timer);
  c.timer = setTimeout(() => { c.timer = 0; if (inbox.enabled.has(c.botId)) inboxConnect(c.botId); }, delay);
  renderInboxRail();
}
function inboxDisconnect(botId) {
  const c = inboxConn(botId);
  clearTimeout(c.timer); c.timer = 0;
  inboxStopPoll(c);
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
    case "message": case "messageSent":
      inboxOnMessageEvent(chat, key, sub, payload);
      break;
    case "chatRead": { // 客人讀到哪：只更新水位，正在看這位才重畫訊息
      if (!inboxNoteUserRead(chat, payload.read?.watermark || payload.timestamp)) return;
      if (inbox.selected === key) renderInboxThread();
      return;
    }
    case "read": // 客服（任一分頁）標了已讀
      chat.unread = false; chat.unreadCount = 0;
      inboxDismissToast(key);
      break;
    case "done": chat.done = true; break;
    case "undone": chat.done = false; break;
    case "followedUp": chat.followedUp = true; break;
    case "unfollowedUp": chat.followedUp = false; break;
    case "assigneeRemoved": chat.assignedBizId = ""; break;
    case "pin": case "unpin": // 釘選（任一分頁）：重抓拿 pinnedAt
    case "assigneeUpdated": case "nicknameUpdated": case "spam": case "unspam": case "delete": case "leave": case "botLeave": {
      const fresh = await inboxFetchChat(botId, chatId);
      if (!fresh) { inbox.chats.delete(key); inbox.threads.delete(key); inboxDismissToast(key); if (inbox.selected === key) inbox.selected = null; }
      break;
    }
    default: return; // typing 等不重繪
  }
  inboxRenderAll();
}

export { inboxApplyPollFallback, inboxAssigneeLabel, inboxConnect, inboxEnabledIds, inboxFetchChat, inboxLoadBots, inboxLoadChats, inboxNoteMessageIds, inboxNoteUserRead, inboxPreview, inboxSetEnabled, inboxUnreadTotal };
