// 收件匣的 AI 客服狀態：逐對話向後端 resolve，清單列顯示 AI處理／轉人工。
import { aiBots, aiChatPath, aiState, fetchAiProfile } from "../ai-toggle.js";
import { lineBackendRequest } from "../core/backend.js";
import { inbox, inboxBotName, inboxKey } from "./core.js";
import { renderInboxList } from "./list.js";
import { renderInboxRail } from "./shell.js";

/* ---- AI 客服狀態（有 AI 的帳號才有）：帳號層級記在 aiBots，對話層級記在 inboxAi ---- */
const inboxAi = new Map(); // "bot/chat" → { status: ready|unmatched|error, handoff, full }（full＝開過對話、做過大頭貼比對）
const inboxAiQueue = [];
let inboxAiBusy = 0;
function inboxNoteAi(bot, chat, state) {
  const key = inboxKey(bot, chat);
  if (state) inboxAi.set(key, { status: state.status, handoff: !!state.handoff, full: true });
  renderInboxList();
  renderInboxRail();
}
// 列表標籤：AI處理／轉人工；只做過輕量查詢還對不到的顯示中性的「AI」，開過對話仍對不到才顯示「未對到 AI」
function inboxAiLabel(chat) {
  if (aiBots.get(chat.botId) !== true) return null;
  const live = aiState && aiState.bot === chat.botId && aiState.chat === chat.chatId && aiState.status !== "loading"
    ? { status: aiState.status, handoff: aiState.handoff, full: true } : inboxAi.get(chat.key);
  if (!live || live.status === "error") return { text: "AI", cls: "ai" };
  if (live.status !== "ready") return live.full ? { text: "未對到 AI", cls: "ai-unmatched" } : { text: "AI", cls: "ai" };
  return live.handoff ? { text: "轉人工", cls: "ai-human" } : { text: "AI處理", cls: "ai-on" };
}
// 有 AI 的帳號：列表上的對話逐一向後端問狀態（最多同時 2 個；問過的不再問）
function inboxQueueAi(chat) {
  if (aiBots.get(chat.botId) === false || inboxAi.has(chat.key) || inboxAiQueue.includes(chat.key)) return;
  inboxAiQueue.push(chat.key);
  inboxDrainAi();
}
function inboxDrainAi() {
  while (inboxAiBusy < 2 && inboxAiQueue.length) {
    const chat = inbox.chats.get(inboxAiQueue.shift());
    if (!chat) continue;
    inboxAiBusy++;
    inboxResolveAi(chat).finally(() => { inboxAiBusy--; inboxDrainAi(); });
  }
}
// 同 refreshAiToggle：先問後端有沒有記下對應，沒有才讀 LINE 客人資料（原名＋暱稱＋大頭貼）再比對一次
async function inboxResolveAi(chat) {
  try {
    const resolve = (body) => lineBackendRequest("POST", aiChatPath(chat.botId, chat.chatId) + "/resolve", body, undefined,
      { "X-Oa-Name": encodeURIComponent(inboxBotName(chat.botId)) });
    let status = await resolve({});
    aiBots.set(chat.botId, !!(status && status.aiAccount));
    if (status && status.aiAccount && !status.matched) {
      const profile = await fetchAiProfile(chat.botId, chat.chatId).catch(() => null);
      if (profile) status = await resolve(profile);
    }
    if (status && status.aiAccount) inboxAi.set(chat.key, { status: status.matched ? "ready" : "unmatched", handoff: !!status.handoffActive, full: true });
  } catch (_) {
    inboxAi.set(chat.key, { status: "error", handoff: false, full: false });
  }
  renderInboxList();
  renderInboxRail();
}
// 帳號有沒有 AI：啟用、讀完對話後拿最近一位客人問一次（resolve 回 aiAccount）
function inboxProbeAi(botId) {
  if (aiBots.has(botId)) return;
  const chat = [...inbox.chats.values()].filter((c) => c.botId === botId).sort((a, b) => b.at - a.at)[0];
  if (chat) inboxQueueAi({ ...chat }); // 先假設有 AI 排進佇列；resolve 會寫回 aiBots
}

export { inboxAiLabel, inboxNoteAi, inboxProbeAi, inboxQueueAi };
