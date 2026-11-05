// 後台一鍵分享 → 自動送出：偵測 ?send={token}，取文字填入並送出、回報後清掉網址。
import { httpGetJson } from "./core/backend.js";
import { API_BASE } from "./core/constants.js";
import { getChatId, getOaId } from "./core/page-context.js";
import { fillReplyTextarea, getEditorHost } from "./ui/reply-input.js";

const SEND_TOKEN_RE = /^[0-9a-f]{64}$/;
let lastConsumedToken = null; // 冪等：同一 token 不重複處理
let sendInFlight = false;
function getSendToken() {
  try {
    const t = new URL(location.href).searchParams.get("send");
    return t && SEND_TOKEN_RE.test(t) ? t : null;
  } catch (_) {
    return null;
  }
}
function cleanupSendParam() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has("send")) return;
    u.searchParams.delete("send");
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch (_) {}
}
// 等對話輸入框就緒，且（若有指定）已切到該對話
function waitForEditorReady(chatId, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    (function poll() {
      const host = getEditorHost();
      const inner =
        host && host.shadowRoot && host.shadowRoot.querySelector("textarea");
      if (inner && (!chatId || getChatId() === chatId)) return resolve(true);
      if (Date.now() - t0 > timeoutMs) return resolve(false);
      setTimeout(poll, 200);
    })();
  });
}
// 找 LINE 送出鈕：派單按鈕是插在 .send-group.btn-group 「前面」(不在群內)，群內最後一顆啟用的就是送出
function findLineSendButton() {
  const group = document.querySelector(".send-group.btn-group");
  if (group) {
    const btns = Array.from(group.querySelectorAll("button")).filter(
      (b) => !b.disabled && b.offsetParent !== null,
    );
    if (btns.length) return btns[btns.length - 1];
  }
  return null;
}
function pressEnterToSend() {
  const host = getEditorHost();
  const el =
    (host && host.shadowRoot && host.shadowRoot.querySelector("textarea")) ||
    document.querySelector('textarea[part="input"].input') ||
    document.querySelector("textarea.input") ||
    document.querySelector("textarea");
  if (!el) return false;
  el.focus();
  const opt = {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    composed: true,
  };
  el.dispatchEvent(new KeyboardEvent("keydown", opt));
  el.dispatchEvent(new KeyboardEvent("keypress", opt));
  el.dispatchEvent(new KeyboardEvent("keyup", opt));
  return true;
}
function clickLineSendButton() {
  const btn = findLineSendButton();
  if (btn) {
    btn.click();
    return true;
  }
  return pressEnterToSend(); // 備援：找不到按鈕就模擬 Enter
}
function ackSend(token, status, error) {
  if (typeof GM_xmlhttpRequest !== "function") return;
  GM_xmlhttpRequest({
    method: "POST",
    url: `${API_BASE}/line-dispatch/${token}/ack`,
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ status, error: error || "" }),
  });
}
async function consumeAndSend(token) {
  sendInFlight = true;
  let data;
  try {
    data = await httpGetJson(`${API_BASE}/line-dispatch/${token}`);
  } catch (e) {
    cleanupSendParam(); // 410 / 網路錯誤都靜默：清掉網址、不重送
    sendInFlight = false;
    return;
  }
  const text = data && data.text;
  if (!text) {
    cleanupSendParam();
    sendInFlight = false;
    return;
  }
  const ready = await waitForEditorReady(data.chatId);
  if (!ready) {
    ackSend(token, "failed", "editor not ready");
    cleanupSendParam();
    sendInFlight = false;
    return;
  }
  // 對話一致性：目前畫面必須就是 token 對應的對話，避免送錯人
  if (
    (data.chatId && data.chatId !== getChatId()) ||
    (data.gid && data.gid !== getOaId())
  ) {
    ackSend(token, "failed", "chat mismatch");
    cleanupSendParam();
    sendInFlight = false;
    return;
  }
  fillReplyTextarea(text, true);
  setTimeout(() => {
    const sent = clickLineSendButton();
    ackSend(
      token,
      sent ? "sent" : "failed",
      sent ? "" : "send button not found",
    );
    cleanupSendParam();
    sendInFlight = false;
  }, 150);
}
function checkSendToken() {
  if (location.hostname !== "chat.line.biz") return;
  if (sendInFlight || !location.search) return; // 每幀都會跑：沒有 query 就不解析 URL
  const token = getSendToken();
  if (!token || token === lastConsumedToken) return;
  lastConsumedToken = token; // 先標記再處理，避免 observer 重入重複觸發
  consumeAndSend(token);
}

export { checkSendToken };
