// 聊天室頂端的 AI處理／轉人工切換（有 AI 客服的官方帳號才出現）。
import { lineBackendRequest } from "./core/backend.js";
import { INBOX_MODE } from "./core/env.js";
import { getChatId, getOaId, getOaName } from "./core/page-context.js";
import { findFollowUpBtn } from "./dispatch.js";
import { inboxNoteAi } from "./inbox/ai.js";
import { inbox } from "./inbox/core.js";
import { fetchLineDirectoryPage, fetchLineJson, lineChatsPageUrl } from "./line/fetch.js";
import { getEditorHost } from "./ui/reply-input.js";
import { toast } from "./ui/toast.js";

/* ---------------------------------------------------------------------- *
 * AI 客服切換：聊天室頂端「待處理」左邊 [AI處理][轉人工]
 *   只在 AI 客服開著的官方帳號出現（後端依客群設定「官方後台網址」＋line-dai AI 開關判斷）。
 *   官方帳號後台的聊天室 ID 跟 AI 記的 LINE userId 是兩套 ID：先問後端有沒有記下對應，
 *   沒有才用 LINE 後台 API 依聊天室 ID 讀客人原名＋大頭貼交給後端比對並記下
 *   （不讀畫面標題：切換對話的瞬間標題可能還是上一位客人）。
 *   轉人工＝AI 不再回這位客人（同調度中心轉人工，客人閒置逾時 AI 會自動接回）。
 * ---------------------------------------------------------------------- */
const AI_TOGGLE_CLASS = "loe-ai-toggle";
const AI_PROFILE_PAGE_LIMIT = 4; // 單一聊天室端點不可用時，最多翻最近 4 頁（100 位）找這個聊天室
const aiProfiles = new Map(); // "bot/chat" → { name, avatarUrl } 或 null（找不到）
const aiBots = new Map(); // bot → true（有 AI）／false（沒有 AI，不再查）
let aiSingleChatApi = true; // LINE 單一聊天室端點可用；失敗一次就改翻對話清單
let aiState = null; // { bot, chat, status: loading|ready|unmatched|error, handoff, busy }
let aiRun = 0;
const aiChatPath = (bot, chat) =>
  `/line-oa/${encodeURIComponent(bot)}/chats/${encodeURIComponent(chat)}/client-ai`;
function aiProfileOf(chat) {
  const p = (chat && chat.profile) || {};
  return {
    name: typeof p.name === "string" ? p.name : "",
    nickname: typeof p.nickname === "string" ? p.nickname : "", // 客服改的暱稱（後端一併記下，調度中心可用暱稱搜尋）
    avatarUrl: p.iconHash && p.iconHash !== "biz-app"
      ? `https://profile.line-scdn.net/${encodeURIComponent(p.iconHash)}/preview` : "",
  };
}
// 依聊天室 ID 讀客人資料（原名＋暱稱＋大頭貼）：先試單一聊天室端點，不行就翻最近的對話清單
async function fetchAiProfile(bot, chat) {
  const key = bot + "/" + chat;
  if (aiProfiles.has(key)) return aiProfiles.get(key);
  let found = null;
  if (aiSingleChatApi) {
    try {
      const data = await fetchLineJson(new URL(`/api/v1/bots/${bot}/chats/${encodeURIComponent(chat)}`, location.origin),
        { controller: new AbortController() });
      if (data && data.profile && (!data.chatId || data.chatId === chat)) found = data;
      else aiSingleChatApi = false;
    } catch (_) {
      aiSingleChatApi = false;
    }
  }
  for (let page = 0, next = ""; !found && page < AI_PROFILE_PAGE_LIMIT; page++) {
    const data = await fetchLineDirectoryPage(lineChatsPageUrl(bot, next), { controller: new AbortController() });
    found = data.list.find((c) => c && c.chatId === chat) || null;
    next = data.next;
    if (!next) break;
  }
  const profile = found ? aiProfileOf(found) : null;
  aiProfiles.set(key, profile);
  return profile;
}
// sure＝這次有帶官方帳號名稱：後端已能自動記下官方後台網址，回「沒 AI」才是真的沒有，本分頁不再查；
// 頁首名稱還沒出現時回的「沒 AI」不記，下次換對話再問
function setAiStatus(bot, chat, status, sure = true) {
  if (status.aiAccount || sure) aiBots.set(bot, !!status.aiAccount);
  aiState = status.aiAccount
    ? { bot, chat, status: status.matched ? "ready" : "unmatched", handoff: !!status.handoffActive, busy: false }
    : null;
  if (INBOX_MODE) inboxNoteAi(bot, chat, aiState);
}
// 換對話／回到分頁時重讀：已記下對應只要一次後端查詢，沒有才讀 LINE 客人資料再比對
async function refreshAiToggle() {
  const bot = getOaId(), chat = getChatId(), run = ++aiRun;
  if (!/^U[0-9a-f]{32}$/i.test(bot) || !chat || aiBots.get(bot) === false) {
    aiState = null;
    renderAiToggle();
    return;
  }
  aiState = { bot, chat, status: "loading", handoff: false, busy: false };
  renderAiToggle();
  // 帶官方帳號名稱：官方後台網址還沒填時，後端依名稱自動記下（同「同步客戶與記事本」）
  const oaName = getOaName();
  const resolve = (body) => lineBackendRequest("POST", aiChatPath(bot, chat) + "/resolve", body, undefined,
    oaName ? { "X-Oa-Name": encodeURIComponent(oaName) } : {});
  try {
    let status = await resolve({});
    if (run !== aiRun) return;
    if (status && status.aiAccount && !status.matched) {
      const profile = await fetchAiProfile(bot, chat).catch(() => null);
      if (run !== aiRun) return;
      if (profile) status = await resolve(profile);
      if (run !== aiRun) return;
    }
    setAiStatus(bot, chat, status || {}, !!oaName);
  } catch (_) {
    if (run !== aiRun) return;
    aiState = aiBots.get(bot) ? { bot, chat, status: "error", handoff: false, busy: false } : null;
  }
  renderAiToggle();
}
async function switchAiHandoff(handoff, auto = false) {
  const s = aiState;
  if (!s || s.status !== "ready" || s.busy || s.handoff === handoff) return;
  s.busy = true;
  renderAiToggle();
  try {
    const status = await lineBackendRequest("PUT", aiChatPath(s.bot, s.chat) + "/handoff", { handoff }, undefined,
      { "Idempotency-Key": crypto.randomUUID() });
    s.handoff = !!(status && status.handoffActive);
    toast(auto && s.handoff ? "你已回覆客人，已自動轉人工：AI 不再回這位客人"
      : s.handoff ? "已轉人工：AI 不再回這位客人" : "已交回 AI 處理", "ok");
  } catch (e) {
    toast("AI 切換失敗：" + (e && e.message ? e.message : "請稍後再試"), "err", 4000);
  } finally {
    s.busy = false;
    if (aiState === s) renderAiToggle();
    if (INBOX_MODE) inboxNoteAi(s.bot, s.chat, s);
  }
}
// 放在「待處理」左邊；LINE 重繪標題列時重新放回。已就位且狀態沒變就不掃 DOM（維護迴圈每幀都會呼叫）
// 「AI處理」中的對話只要客服送出訊息（自己按傳送／Enter，或懶惰蟲的快捷回覆、派單自動回覆、
// 後台派單送出）就自動切「轉人工」：客服已經接手，AI 不該再搶著回。沒有 AI 的對話不理會。
// 判定「真的送出」：送出手勢（點傳送鈕或在輸入框按 Enter）前輸入框有字、之後輸入框被清空。
// 這樣 Enter 設成換行、Ctrl+Enter 才送出的環境也不會誤判。
function editorInput() {
  const host = getEditorHost();
  return (
    (host && host.shadowRoot && host.shadowRoot.querySelector("textarea")) ||
    document.querySelector('textarea[part="input"]') ||
    document.querySelector("textarea.input")
  );
}
function editorText() {
  const el = editorInput();
  return el ? el.value.trim() : "";
}
function handoffOnSendGesture() {
  const s = aiState;
  if (!s || s.status !== "ready" || s.handoff || s.busy || s.chat !== getChatId()) return;
  if (!editorText()) return;
  setTimeout(() => {
    if (aiState === s && !s.handoff && !s.busy && !editorText()) switchAiHandoff(true, true);
  }, 300);
}
function renderAiToggle() {
  let box = document.querySelector(`.${AI_TOGGLE_CLASS}`);
  // 同一個 LINE 用戶在同 provider 的多個官方帳號對話 ID 相同，所以帳號也要一起比對
  const s = aiState && aiState.chat === getChatId() && aiState.bot === getOaId() &&
    (aiState.status !== "loading" || aiBots.get(aiState.bot)) ? aiState : null;
  if (!s) {
    if (box) box.remove();
    return;
  }
  const sig = [s.chat, s.status, s.handoff, s.busy].join("|");
  if (box && box.isConnected && box.dataset.sig === sig &&
      (INBOX_MODE || (box.nextElementSibling && box.nextElementSibling.isConnected))) return;
  const anchor = INBOX_MODE ? inbox.el.aiSlot : findFollowUpBtn();
  if (!anchor) {
    if (box) box.remove();
    return;
  }
  if (!box || (INBOX_MODE ? box.parentElement !== anchor : box.nextElementSibling !== anchor)) {
    if (box) box.remove();
    box = document.createElement("span");
    box.className = AI_TOGGLE_CLASS;
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "AI 客服");
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-handoff]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      switchAiHandoff(btn.dataset.handoff === "1");
    });
    if (INBOX_MODE) anchor.appendChild(box);
    else anchor.insertAdjacentElement("beforebegin", box);
  }
  box.dataset.sig = sig;
  box.textContent = "";
  if (s.status === "ready") {
    // 一顆就好：顯示目前狀態，點一下切到另一邊（data-handoff 是「要切成」的值）
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.handoff = s.handoff ? "0" : "1";
    btn.textContent = s.handoff ? "轉人工" : "AI處理";
    btn.title = s.handoff
      ? "目前：轉人工，AI 不回這位客人（客人閒置 60 分鐘後 AI 會自動接回）。點一下交回 AI 處理"
      : "目前：AI 自動回覆這位客人。點一下轉人工";
    btn.className = s.handoff ? "on human" : "on";
    btn.setAttribute("aria-pressed", String(s.handoff));
    btn.disabled = s.busy;
    box.appendChild(btn);
    return;
  }
  const note = document.createElement("span");
  note.className = "loe-ai-note";
  note.textContent = s.status === "loading" ? "AI 讀取中…" : s.status === "unmatched" ? "未對到 AI" : "AI 狀態讀取失敗";
  note.title = s.status === "unmatched"
    ? "找不到這位客人的 AI 對話（客人沒跟 AI 對話過，或同名又沒有大頭貼），無法切換"
    : s.status === "error" ? "連不到後端，換個對話再回來會重試" : "";
  box.appendChild(note);
}

// 載入時註冊的事件／計時器：由 main.js 的 uturnMain() 呼叫一次。
function initAiToggle() {
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.nodeType === 1 && t.closest(".send-group.btn-group") && t.closest("button, input.btn"))
      handoffOnSendGesture();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    const host = getEditorHost(), el = editorInput(), t = e.target;
    // shadow DOM 內的 keydown 到 document 時 target 已改成 host；一般 textarea 退回路徑直接比對
    if (t === host || t === el || (host && host.contains(t))) handoffOnSendGesture();
  }, true);
}

export { aiBots, aiChatPath, aiState, fetchAiProfile, initAiToggle, refreshAiToggle, renderAiToggle, switchAiHandoff };
