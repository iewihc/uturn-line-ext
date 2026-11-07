// 選項「只通知轉人工（客叫單）」：收 AI 客服轉人工事件，同後台調度中心上方的轉人工列。
import { SIGNALR_DISPATCH_HUB } from "../core/constants.js";
import { inbox, inboxKey } from "./core.js";
import { LIVE_HUB_RESTART_MS, connectLiveHub, liveHubToken, liveHubUserId } from "./live-hub.js";
import { inboxNotifyHandoff } from "./notify.js";

/* ---------------------------------------------------------------------- *
 *   選項打開時連 signalr-chat /hubs/dispatch：每個可調度的車隊一條、SubscribeDispatchCenter(車隊, 自己)（「自己」模式，
 *   客叫事件走車隊共享 group 一樣收得到），只處理兩種事件：
 *     customer_handoff  — 客人按「轉人工」或 AI 判斷轉人工
 *     client_ai_message — 轉人工中客人又傳來（sender=customer 且 handoffActive）
 *   官方帳號有 AI 當班名單而自己不在內不提醒（同後台）。事件帶 lineChatUrl（客人在官方後台的聊天室）就併進收件匣那位客人的卡片。
 *   選項關掉就斷線，什麼都不收（行為同沒有這個選項）。
 * ---------------------------------------------------------------------- */
const HANDOFF_DEDUPE_MS = 10000; // 轉人工與客人訊息常成對抵達：同一位客人 10 秒內只提醒先到的那一則（同後台）
const HANDOFF_SEEN_MAX = 500;
const HANDOFF_REASON_LABEL = {
  explicit: "明確要求", safety: "安全疑慮", action_uncertain: "AI 不確定", unsupported_service: "不支援的服務",
  complaint: "客訴", lost_item: "遺失物", fare_dispute: "車資爭議", ai_failed: "AI 無法理解",
  frustrated: "客人不耐", panel: "調度接手", desk_claim: "客服認領",
};
const hl = { stops: [], starting: false, seen: new Set(), last: { conv: "", type: "", at: 0 } };

// gRPC 轉送的 data 都是字串：布林會變 "true"
const isTrue = (v) => v === true || v === "true";
// https://chat.line.biz/{bot}/chat/{chat} → 收件匣對話 key
function chatKeyOf(url) {
  const m = /^https:\/\/chat\.line\.biz\/([^/?#]+)\/chat\/([^/?#]+)/.exec(url || "");
  return m ? inboxKey(decodeURIComponent(m[1]), decodeURIComponent(m[2])) : "";
}
function handoffSeen(key) {
  if (hl.seen.has(key)) return true; // 同一則會從車隊、自己、客叫多個群組送到
  hl.seen.add(key);
  if (hl.seen.size > HANDOFF_SEEN_MAX) hl.seen.delete(hl.seen.values().next().value);
  return false;
}
// 同一位客人轉人工＋客人訊息成對抵達：後到的那則不再提醒
function handoffPaired(conv, type) {
  const now = Date.now(), last = hl.last;
  const paired = !!conv && last.conv === conv && last.type !== type && now - last.at < HANDOFF_DEDUPE_MS;
  if (!paired) Object.assign(last, { conv, type, at: now });
  return paired;
}
function handoffOnEvent(fleet, env) {
  if (!inbox.handoffOnly || !env || (env.type !== "customer_handoff" && env.type !== "client_ai_message")) return;
  const d = env.data || {};
  const seq = Number(d.seq) || 0; // Redis 失敗時 seq＝0：改用事件內容去重
  if (handoffSeen(seq ? `${fleet}:${seq}` : `${fleet}:${env.type}:${d.conversationId}:${env.at}`)) return;
  const isHandoff = env.type === "customer_handoff";
  if (!isHandoff && !(d.sender === "customer" && isTrue(d.handoffActive))) return; // AI 處理中的往來不提醒
  const duty = String(d.clientDutyUserIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (duty.length && !duty.includes(liveHubUserId())) return;
  if (handoffPaired(d.conversationId, env.type)) return;
  const reason = HANDOFF_REASON_LABEL[d.handoffReasonCode] || d.handoffReasonCode || "";
  inboxNotifyHandoff({
    chatKey: chatKeyOf(d.lineChatUrl),
    conversationId: d.conversationId,
    chatUrl: d.lineChatUrl || "",
    customerName: d.customerName || d.clientUserName || "",
    officialName: d.chName || "",
    shortId: env.shortId || "",
    reason: reason ? `轉人工 · ${reason}` : "轉人工",
    text: isHandoff ? d.handoffMessage || d.handoffReason || reason || "AI 客服轉人工" : d.preview || "客人傳了新訊息",
  });
}

function startHandoffLive() {
  if (hl.stops.length || hl.starting) return;
  hl.starting = true;
  liveHubToken()
    .then((t) => {
      if (!inbox.handoffOnly) return;
      hl.stops = t.fleets.map((fleet) => connectLiveHub(SIGNALR_DISPATCH_HUB,
        { DispatchEvent: (env) => handoffOnEvent(fleet, env) },
        (conn) => conn.invoke("SubscribeDispatchCenter", fleet, liveHubUserId())));
    })
    .catch(() => setTimeout(applyHandoffLive, LIVE_HUB_RESTART_MS))
    .finally(() => { hl.starting = false; });
}
function stopHandoffLive() {
  hl.stops.forEach((stop) => stop());
  hl.stops = [];
}
// 收件匣開始監聽、選項切換時呼叫：選項開著就連，關了就斷
function applyHandoffLive() {
  if (inbox.handoffOnly && inbox.started) startHandoffLive();
  else stopHandoffLive();
}

export { applyHandoffLive };
