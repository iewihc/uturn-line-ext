// 以 LINE 對話連結向後端查這位客人的進行中訂單。
import { httpGetJson } from "./core/backend.js";
import { API_BASE } from "./core/constants.js";

/* 以 LINE 對話連結查進行中訂單：GET /line-chat-orders?lineChatUrl=...
 * 回應 { data } ＝ base64(iv 12 bytes ‖ AES-256-GCM 密文 ‖ tag)，金鑰同後端 line_chat_send.order_lookup_key。
 * 解開為 { orders: [...], generatedAt }：這位客人所有進行中的單（依派單時間先後；分次派、多台單都列出）。 */
const ORDER_LOOKUP_KEY_B64 = "CPjdrYi68aDybJk9iunRB0/7M1WymfneKPn2gdqs8uU=";
let orderLookupKeyPromise = null;
const base64Bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
function orderLookupKey() {
  if (!orderLookupKeyPromise)
    orderLookupKeyPromise = crypto.subtle.importKey("raw", base64Bytes(ORDER_LOOKUP_KEY_B64), "AES-GCM", false, ["decrypt"]);
  return orderLookupKeyPromise;
}
async function fetchChatOrders(botId, chatId) {
  const lineChatUrl = `https://chat.line.biz/${botId}/chat/${chatId}`;
  const res = await httpGetJson(`${API_BASE}/line-chat-orders?lineChatUrl=${encodeURIComponent(lineChatUrl)}`);
  if (!res || typeof res.data !== "string") throw new Error("訂單回應格式不符");
  const sealed = base64Bytes(res.data);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.slice(0, 12) }, await orderLookupKey(), sealed.slice(12));
  const payload = JSON.parse(new TextDecoder().decode(plain));
  return Array.isArray(payload.orders) ? payload.orders : [];
}

export { fetchChatOrders };
