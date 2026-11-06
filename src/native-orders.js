// LINE 原生聊天頁：換到一位客人時，把大頭貼＋最近訊息編號交給後端比對乘客一次（客叫／AI 單才找得到）。
// （原本這裡還有「訂單 N」「司機對話」兩顆按鈕與浮動面板，v1.71.0 起原生頁不再顯示，這些功能在收件匣。）
import { fetchAiProfile } from "./ai-toggle.js";
import { hasLineExtAuth } from "./core/backend.js";
import { INBOX_MODE } from "./core/env.js";
import { getChatId, getOaId } from "./core/page-context.js";
import { fetchLineJson } from "./line/fetch.js";
import { lineMessageIds, resolveLineChats } from "./orders.js";
import { getDispatcher } from "./settings.js";

const nativeProbed = new Set(); // 本分頁已比對過的 oa/chat
async function probeNativeChat() {
  if (INBOX_MODE || !getDispatcher()) return;
  const oa = getOaId(), chat = getChatId();
  if (!oa || !chat) return;
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

export { probeNativeChat };
