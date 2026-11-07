// 司機訊息即時通知（只有自己的單，同後台調度中心「自己」模式）。
import { SIGNALR_CHAT_HUB } from "../core/constants.js";
import { driverChat } from "../driver-chat.js";
import { inbox, inboxKey } from "./core.js";
import { LIVE_HUB_RESTART_MS, connectLiveHub, liveHubToken, liveHubUserId } from "./live-hub.js";
import { inboxNotifyDriver } from "./notify.js";

/* ---------------------------------------------------------------------- *
 *   連 signalr-chat /hubs/chat：每個可調度的車隊一條連線、JoinFleet(車隊, 自己) 收「自己」範圍的訂單訊息，
 *   ReceiveMessage 只留司機講的，右上角卡片提示。
 *   選項「只通知轉人工」：客叫／AI 單只提醒已轉人工的（envelope.handoff），其餘不提醒。
 * ---------------------------------------------------------------------- */
const DRIVER_LIVE_SEEN_MAX = 500;
const live = { started: false, seen: new Set() };

// 同後台「自己」模式：自己建的單、店家叫車，或客叫單（乘客 App／AI）的官方帳號沒設當班或當班有自己
function driverLiveIsMine(env, fleet) {
  const me = liveHubUserId();
  if (!me || (env.fleet && env.fleet !== fleet)) return false;
  if (env.createdBy === me || env.source === "store") return true;
  if (env.source !== "client") return false;
  const duty = String(env.clientDutyUserIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  return !duty.length || duty.includes(me);
}
// 選項「只通知轉人工」：客叫／AI 單還沒轉人工就不提醒（懶惰蟲、店家派的單照常）
const driverLiveMuted = (env) => inbox.handoffOnly && env.source === "client" && env.handoff !== true;
function driverLiveText(env) {
  switch (env.type) {
    case "image": return "[圖片]";
    case "audio": return "[語音]";
    case "video": return "[影片]";
    case "location": return "📍 " + (env.content || "位置");
    default: return env.content || "[訊息]";
  }
}
// 這張單派自哪位客人的對話（官方帳號看板帶的訂單 ID）；不在已開帳號裡回空
function inboxOrderChatKey(orderId) {
  for (const [botId, board] of inbox.board) {
    const chatId = board.orderChat?.get(orderId);
    if (chatId) return inboxKey(botId, chatId);
  }
  return "";
}
function driverLiveOnMessage(fleet, env) {
  if (!env || env.sender?.type !== "driver" || !env.id || live.seen.has(env.id)) return; // 同一則會從多個群組送到
  live.seen.add(env.id);
  if (live.seen.size > DRIVER_LIVE_SEEN_MAX) live.seen.delete(live.seen.values().next().value);
  if (!driverLiveIsMine(env, fleet) || driverLiveMuted(env) || driverChat.orderId === env.orderId) return; // 那張單的司機對話開著：已經看得到
  // envelope 同後台 ChatTransportMessage：shortId、oriText（派單原文）都在裡面
  inboxNotifyDriver({ orderId: env.orderId, shortId: env.shortId, oriText: env.oriText, driverNo: env.sender?.name, text: driverLiveText(env), chatKey: inboxOrderChatKey(env.orderId) });
}

// 收件匣開始監聽時呼叫一次（需已身份授權）；換不到 token 隔一陣子再試
function startDriverLive() {
  if (live.started) return;
  live.started = true;
  liveHubToken()
    .then((t) => t.fleets.forEach((fleet) => connectLiveHub(SIGNALR_CHAT_HUB,
      { ReceiveMessage: (env) => driverLiveOnMessage(fleet, env) },
      (conn) => conn.invoke("JoinFleet", fleet, liveHubUserId()))))
    .catch(() => { live.started = false; setTimeout(startDriverLive, LIVE_HUB_RESTART_MS); });
}

export { inboxOrderChatKey, startDriverLive };
