// 收件匣送訊息：選中對話、樂觀泡泡、文字／貼圖／表情貼／檔案送出與 SSE 認領。
import { aiState, refreshAiToggle, switchAiHandoff } from "../ai-toggle.js";
import { pageContext, setPageContext } from "../core/page-context.js";
import { closeDispatchPopover } from "../dispatch.js";
import { closeDriverChat, driverChat } from "../driver-chat.js";
import { inboxLoadNotes, inboxMarkRead } from "./chat-tools.js";
import { inboxNoteMessageIds, inboxNoteUserRead, inboxPreview } from "./chats.js";
import { inbox, inboxApi, inboxBotName, inboxKey } from "./core.js";
import { inboxDismissToast } from "./notify.js";
import { inboxLoadOrders } from "./orders.js";
import { inboxRenderAll } from "./shell.js";
import { renderInboxThread } from "./thread.js";
import { firstText } from "../line/sync.js";
import { LINE_CHAT_PROBE_MAX_IDS, lineMessageIds } from "../orders.js";
import { toast } from "../ui/toast.js";
import { closeInboxSearch } from "./msearch.js";

/* ---- 訊息串 ---- */
function inboxSetContext(chat) {
  const next = chat ? { botId: chat.botId, chatId: chat.chatId, customerName: chat.name, oaName: inboxBotName(chat.botId) } : null;
  // 比「帳號／對話」而不只比對話 ID：同 provider 的帳號同一位客人對話 ID 相同，只比對話 ID 會讓 AI 狀態停在上一個帳號
  const changed = (pageContext ? inboxKey(pageContext.botId, pageContext.chatId) : "") !== (next ? inboxKey(next.botId, next.chatId) : "");
  setPageContext(next);
  if (changed) { closeDispatchPopover(); refreshAiToggle(); }
}
async function inboxOpenChat(key) {
  if (inbox.selected !== key) {
    inboxSetReply(null); // 回覆是對著這位客人的，換人就清掉
    closeInboxSearch(); // 訊息搜尋也是
    if (driverChat.host === inbox.el.dchat) closeDriverChat();
    inbox.dchatAutoFor = ""; // 換一位客人：有司機的單再自動開司機對話
  }
  inbox.selected = key;
  inbox.renaming = false;
  inboxDismissToast(key);
  inboxSetContext(inbox.chats.get(key) || null);
  inboxRenderAll();
  const chat = inbox.chats.get(key);
  if (inbox.pinNotes) inbox.notesOpen = true; // 選項：固定開啟記事本
  inbox.noteEditing = null;
  if (chat && inbox.notesOpen && !inbox.notes.has(key)) inboxLoadNotes(chat);
  if (chat && chat.unread && inbox.autoRead) inboxMarkRead(chat); // 選項：開啟對話自動標已讀
  if (chat) inboxLoadOrders(chat);
  if (chat) await inboxLoadThread(chat, true);
}
// 載入訊息串（第一頁 50 則）。priority：使用者點開的，不排在輪詢後面；滑鼠移到列上也會先預抓（非 priority）
async function inboxLoadThread(chat, priority = false) {
  const key = chat.key;
  if (inbox.threads.has(key)) return;
  const th = { list: [], loading: true, error: "" };
  inbox.threads.set(key, th);
  if (inbox.selected === key) renderInboxThread();
  try {
    const data = await inboxApi("GET", `/api/v3/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/messages`, undefined, false, { priority });
    // LINE 回新→舊，這裡翻成舊→新；載入期間 SSE 塞進來的保留在後面
    const items = (data?.list || []).filter((m) => m && (m.type === "message" || m.type === "messageSent")).reverse();
    // 列表裡的 chatRead 事件＝客人讀到哪，取最新的當水位
    inboxNoteUserRead(chat, Math.max(0, ...(data?.list || []).filter((m) => m?.type === "chatRead").map((m) => m.read?.watermark || m.timestamp || 0)));
    inboxNoteMessageIds(chat, lineMessageIds(items.slice(-LINE_CHAT_PROBE_MAX_IDS)));
    const seen = new Set(items.map((m) => m.message?.id).filter(Boolean));
    th.list = items.concat(th.list.filter((m) => !seen.has(m.message?.id)));
    th.backward = data?.backward || ""; // 往前翻頁的 token（訊息搜尋跳到舊訊息時用）
  } catch (e) { if (priority) th.error = e.message; else inbox.threads.delete(key); } // 預抓失敗就當沒抓過，點開再抓
  th.loading = false;
  if (inbox.selected === key) renderInboxThread();
}
// 滑鼠停在對話列上 150ms 就先把訊息串抓好，點下去幾乎不用等；同時最多一個在抓
let prefetchTimer = 0, prefetching = false;
function inboxPrefetchThread(key) {
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(async () => {
    const chat = inbox.chats.get(key);
    if (!chat || prefetching || inbox.threads.has(key)) return;
    prefetching = true;
    try { await inboxLoadThread(chat, false); } finally { prefetching = false; }
  }, 150);
}
// 重抓這位客人的訊息，把還沒有的補進串裡（輪詢的帳號：清單只給最新一則，期間可能來了好幾則）
async function inboxRefreshThread(chat) {
  const th = inbox.threads.get(chat.key);
  if (!th || th.loading) return;
  const data = await inboxApi("GET", `/api/v3/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/messages`).catch(() => null);
  if (!data || inbox.threads.get(chat.key) !== th) return;
  inboxNoteUserRead(chat, Math.max(0, ...(data.list || []).filter((m) => m?.type === "chatRead").map((m) => m.read?.watermark || m.timestamp || 0)));
  const have = new Set(th.list.map((m) => m.message?.id).filter(Boolean));
  const fresh = (data.list || []).filter((m) => m && (m.type === "message" || m.type === "messageSent") && m.message?.id && !have.has(m.message.id)).reverse();
  if (fresh.length) { th.list = th.list.concat(fresh).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); inboxNoteMessageIds(chat, lineMessageIds(fresh)); }
  if (inbox.selected === chat.key) renderInboxThread();
}
function inboxAppendToThread(key, payload) {
  const th = inbox.threads.get(key);
  if (!th) return;
  const id = payload.message?.id;
  if (id && th.list.some((m) => m.message?.id === id)) return;
  // 自己剛送出的樂觀泡泡：sendId 相同（LINE 會回帶）或同文字、還沒拿到 id 的，認領這個事件；
  // 整則換成 LINE 的版本（檔案才有 contentProvider、表情貼才有 emojis[]），本機預覽留著當備援
  if (payload.type === "messageSent" && id) {
    const mine = th.list.find((m) => m.sendId && !m.failed && !m.message?.id &&
      (payload.sendId ? m.sendId === payload.sendId : m.pending === false && m.message?.text === payload.message?.text));
    if (mine) { mine.message = payload.message; mine.timestamp = payload.timestamp || mine.timestamp; mine.pending = false; return; }
  }
  th.list.push(payload);
}
/* ---- 送出：文字／貼圖／卡片／優惠券／檔案共用「樂觀泡泡 → 打 API → 認領或標失敗」 ---- */
const inboxMsgPath = (chat) => `/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/messages`;
const inboxNewSendId = (chat) => `${chat.chatId}_${Date.now()}_${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const inboxSelectedChat = () => (inbox.selected && inbox.chats.get(inbox.selected)) || null;
function inboxPushBubble(chat, message, sendId, extra) {
  let th = inbox.threads.get(chat.key);
  if (!th) { th = { list: [], loading: false, error: "" }; inbox.threads.set(chat.key, th); }
  const bubble = { type: "messageSent", timestamp: Date.now(), message: { id: "", ...message }, sendId, pending: true, failed: false, error: "", ...extra };
  th.list.push(bubble);
  renderInboxThread();
  return bubble;
}
// deliver：真正打 API 的 async 函式；成功就把泡泡標為已送出（SSE 可能先一步認領，id 不覆蓋）
async function inboxDeliver(chat, bubble, deliver) {
  try {
    const resp = await deliver();
    bubble.pending = false;
    if (!bubble.message.id) bubble.message.id = firstText([resp?.id, resp?.messageId, resp?.message?.id]);
    chat.preview = inboxPreview(bubble) || chat.preview; chat.at = Date.now();
    if (chat.unread && inbox.autoRead) inboxMarkRead(chat); // 選項「自動標已讀」才標；沒開一律手動按
    // 客服已接手：AI 處理中的對話自動轉人工（同 LINE 聊天室的送出手勢）
    if (aiState && aiState.status === "ready" && !aiState.handoff && !aiState.busy && aiState.bot === chat.botId && aiState.chat === chat.chatId) switchAiHandoff(true, true);
    inboxRenderAll();
    return true;
  } catch (e) {
    bubble.pending = false; bubble.failed = true; bubble.error = e.message;
    toast("傳送失敗：" + e.message, "err", 4000);
    renderInboxThread();
    return false;
  }
}
// wire＝送給 LINE 的訊息（不含 sendId）；shown＝泡泡顯示用（預設同 wire）
async function inboxSendPayload(wire, shown = wire) {
  const chat = inboxSelectedChat();
  if (!chat) return false;
  const sendId = inboxNewSendId(chat);
  const bubble = inboxPushBubble(chat, shown, sendId);
  return inboxDeliver(chat, bubble, () => inboxApi("POST", `${inboxMsgPath(chat)}/send`, { ...wire, sendId }));
}
const inboxSendSticker = (packageId, stickerId) => inboxSendPayload({ type: "sticker", packageId, stickerId });
async function inboxSend(text) {
  text = text.trim();
  if (!text || !inboxSelectedChat()) return false;
  if (text.length > 5000) { toast("訊息超過 5000 字，請分段傳送", "warn", 3000); return false; }
  let { wire, shown } = inboxTextMessage(text);
  const reply = inbox.replyTo;
  if (reply) { // 回覆（引用）：LINE 自家一律送 textV2 並帶被引用那則的 quoteToken
    if (wire.type === "text") wire = { type: "textV2", text: inboxEscapeBraces(wire.text) };
    wire = { ...wire, quoteToken: reply.quoteToken };
    shown = { ...shown, quotedMessageId: reply.id };
  }
  const ok = await inboxSendPayload(wire, shown);
  if (ok && inbox.replyTo === reply) inboxSetReply(null);
  return ok;
}
// 回覆（引用）某一則：輸入框上方顯示引用條，送出時帶 quoteToken；null＝取消
function inboxSetReply(item) {
  inbox.replyTo = item || null;
  const { reply, replyWho, replyText, textarea } = inbox.el;
  if (!reply) return;
  reply.hidden = !inbox.replyTo;
  replyWho.textContent = inbox.replyTo ? `回覆 ${inbox.replyTo.who || ""}` : "";
  replyText.textContent = inbox.replyTo ? inbox.replyTo.text : "";
  if (inbox.replyTo) textarea.focus();
}
// 輸入框裡的表情貼寫成 [表情貼N]（N 對到 inbox.emojiTokens）；沒有就送純文字，
// 有就照 LINE 自家前端的 textV2 寫法：{emoji_i} 佔位＋substitution，其餘 { } 逃脫成 {{ }}。
// shown 用「文字＋emojis[]」（跟收到的訊息同形）讓泡泡立刻顯示表情貼圖
const INBOX_EMOJI_TOKEN_RE = /\[表情貼(\d+)\]/g;
const inboxEscapeBraces = (t) => t.replaceAll("{", "{{").replaceAll("}", "}}");
function inboxTextMessage(text) {
  const substitution = {}, emojis = [];
  let shown = "", wire = "", last = 0, i = 0;
  for (const m of text.matchAll(INBOX_EMOJI_TOKEN_RE)) {
    const e = inbox.emojiTokens.get(m[1]);
    if (!e) continue;
    const plain = text.slice(last, m.index);
    shown += plain; wire += inboxEscapeBraces(plain);
    const key = `emoji_${i++}`;
    substitution[key] = { type: "emoji", productId: e.productId, emojiId: e.emojiId };
    emojis.push({ index: shown.length, length: 1, productId: e.productId, emojiId: e.emojiId });
    shown += "$"; wire += `{${key}}`;
    last = m.index + m[0].length;
  }
  if (!i) return { wire: { type: "text", text }, shown: { type: "text", text } };
  const tail = text.slice(last);
  return { wire: { type: "textV2", text: wire + inboxEscapeBraces(tail), substitution }, shown: { type: "text", text: shown + tail, emojis } };
}
function inboxEmojiToken(productId, emojiId) {
  const n = String(inbox.emojiTokens.size + 1);
  inbox.emojiTokens.set(n, { productId, emojiId });
  return `[表情貼${n}]`;
}
// 收到的「文字＋emojis[]」（例如預設訊息）→ 輸入框用的 [表情貼N] 寫法（從後往前換，index 才不會跑掉）
function inboxTextWithTokens(text, emojis) {
  const list = Array.isArray(emojis) ? emojis.filter((e) => e && e.productId && e.emojiId && Number.isInteger(e.index)).sort((a, b) => b.index - a.index) : [];
  for (const e of list) text = text.slice(0, e.index) + inboxEmojiToken(e.productId, e.emojiId) + text.slice(e.index + (e.length || 1));
  return text;
}
function inboxInsertAtCaret(text) {
  const ta = inbox.el.textarea;
  if (!ta) return;
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  ta.focus();
  ta.setSelectionRange(s + text.length, s + text.length);
}
// 檔案：圖片／影片／語音／其他，上限同 LINE 網頁版（圖片 20MB，其他 100MB）；依序上傳（LINE 也是一個一個排隊）
const INBOX_FILE_LIMIT_MB = { image: 20, video: 100, audio: 100, file: 100 };
function inboxFileKind(file) {
  const t = file.type || "";
  return t.startsWith("image/") ? "image" : t.startsWith("video/") ? "video" : t.startsWith("audio/") ? "audio" : "file";
}
// 回傳每個檔案是否送出
async function inboxSendFiles(files) {
  const chat = inboxSelectedChat();
  const results = [];
  if (!chat || !files.length) return results;
  for (const file of files) {
    const kind = inboxFileKind(file);
    const limit = INBOX_FILE_LIMIT_MB[kind];
    if (file.size > limit * 1048576) { toast(`${file.name} 超過 ${limit} MB，LINE 不收`, "warn", 4000); results.push(false); continue; }
    const sendId = inboxNewSendId(chat);
    const localUrl = kind === "image" ? URL.createObjectURL(file) : "";
    const bubble = inboxPushBubble(chat, { type: kind, fileName: file.name, fileSize: file.size }, sendId, { localUrl });
    const form = new FormData();
    form.append("file", file, file.name);
    results.push(await inboxDeliver(chat, bubble, async () => {
      const up = await inboxApi("POST", `/api/v1/bots/${chat.botId}/messages/${encodeURIComponent(chat.chatId)}/uploadFile`, form);
      const token = up && up.contentMessageToken;
      if (!token) throw new Error("LINE 沒有回傳上傳憑證");
      return inboxApi("POST", `${inboxMsgPath(chat)}/bulkSendFiles`, { items: [{ sendId, contentMessageToken: token }] });
    }));
  }
  return results;
}

export { inboxAppendToThread, inboxPrefetchThread, inboxEmojiToken, inboxInsertAtCaret, inboxOpenChat, inboxRefreshThread, inboxSelectedChat, inboxSend, inboxSendFiles, inboxSendPayload, inboxSendSticker, inboxSetContext, inboxSetReply, inboxTextWithTokens };
