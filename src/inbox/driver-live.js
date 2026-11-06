// 司機訊息即時通知（只有自己的單，同後台調度中心「自己」模式）。
import { AbortError, HttpClient, HttpError, HttpResponse, HttpTransportType, HubConnectionBuilder, LogLevel, TimeoutError } from "@microsoft/signalr";
import { SIGNALR_CHAT_HUB } from "../core/constants.js";
import { lineExtApi } from "../core/backend.js";
import { driverChat } from "../driver-chat.js";
import { inbox, inboxKey } from "./core.js";
import { inboxNotifyDriver } from "./notify.js";

/* ---------------------------------------------------------------------- *
 *   POST /line-ext/chat-token（發送 KEY）換 30 分鐘 token（只能連即時聊天，後台 API 拒收），
 *   連 signalr-chat /hubs/chat：每個可調度的車隊一條連線、JoinFleet(車隊, 自己) 收「自己」範圍的訂單訊息，
 *   ReceiveMessage 只留司機講的，右上角卡片提示。
 *   token 只在連上時檢查，連線中到期不會斷；重連前快到期就自動再換。
 *   請求一律走 GM_xmlhttpRequest（不受 LINE 頁面的連線限制）；WebSocket 被擋就退回長輪詢，一樣即時。
 * ---------------------------------------------------------------------- */
const DRIVER_LIVE_RETRY_MS = [0, 2000, 5000, 10000, 30000]; // 斷線重連間隔（最後一個一直重複）
const DRIVER_LIVE_RESTART_MS = 15000; // 連不上時隔多久再試
const DRIVER_LIVE_TOKEN_REFRESH_MS = 60000; // token 剩這麼久就先換新的
const DRIVER_LIVE_SEEN_MAX = 500;
const live = { started: false, token: null, seen: new Set() }; // token：{ value, exp, userId, fleets }

async function driverLiveToken() {
  if (!live.token || live.token.exp - Date.now() < DRIVER_LIVE_TOKEN_REFRESH_MS) {
    const data = await lineExtApi("POST", "/line-ext/chat-token");
    live.token = { value: data.token, exp: Date.parse(data.expiresAt) || 0, userId: data.userId, fleets: data.fleets || [] };
  }
  return live.token;
}

// SignalR 的 HTTP 請求（協商、長輪詢）改走 GM_xmlhttpRequest
class GmHttpClient extends HttpClient {
  send(req) {
    return new Promise((resolve, reject) => {
      if (req.abortSignal?.aborted) return reject(new AbortError());
      const binary = req.responseType === "arraybuffer";
      const handle = GM_xmlhttpRequest({
        method: req.method || "GET", url: req.url, headers: req.headers || {}, data: req.content,
        responseType: binary ? "arraybuffer" : undefined, timeout: req.timeout || 0,
        onload: (r) => (r.status >= 200 && r.status < 300
          ? resolve(new HttpResponse(r.status, r.statusText || "", binary ? r.response : r.responseText))
          : reject(new HttpError(r.statusText || "", r.status))),
        onerror: (r) => reject(new HttpError(r?.statusText || "", r?.status || 0)),
        ontimeout: () => reject(new TimeoutError()),
        onabort: () => reject(new AbortError()),
      });
      if (req.abortSignal) req.abortSignal.onabort = () => handle.abort();
    });
  }
}

// 同後台「自己」模式：自己建的單、店家叫車，或客叫單（乘客 App／AI）的官方帳號沒設當班或當班有自己
function driverLiveIsMine(env, fleet) {
  const me = live.token?.userId;
  if (!me || (env.fleet && env.fleet !== fleet)) return false;
  if (env.createdBy === me || env.source === "store") return true;
  if (env.source !== "client") return false;
  const duty = String(env.clientDutyUserIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  return !duty.length || duty.includes(me);
}
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
  if (!driverLiveIsMine(env, fleet) || driverChat.orderId === env.orderId) return; // 那張單的司機對話開著：已經看得到
  // envelope 同後台 ChatTransportMessage：shortId、oriText（派單原文）都在裡面
  inboxNotifyDriver({ orderId: env.orderId, shortId: env.shortId, oriText: env.oriText, driverNo: env.sender?.name, text: driverLiveText(env), chatKey: inboxOrderChatKey(env.orderId) });
}

function driverLiveConnect(fleet) {
  const conn = new HubConnectionBuilder()
    .withUrl(SIGNALR_CHAT_HUB, {
      httpClient: new GmHttpClient(),
      accessTokenFactory: async () => (await driverLiveToken()).value,
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => DRIVER_LIVE_RETRY_MS[Math.min(ctx.previousRetryCount, DRIVER_LIVE_RETRY_MS.length - 1)] })
    .configureLogging(LogLevel.None)
    .build();
  const join = () => conn.invoke("JoinFleet", fleet, live.token.userId); // 重連後群組會清空，要重新加入
  const start = () => conn.start().then(join).catch(() => setTimeout(start, DRIVER_LIVE_RESTART_MS));
  conn.on("ReceiveMessage", (env) => driverLiveOnMessage(fleet, env));
  conn.onreconnected(() => join().catch(() => {}));
  start();
}

// 收件匣開始監聽時呼叫一次（需已身份授權）；換不到 token 隔一陣子再試
function startDriverLive() {
  if (live.started) return;
  live.started = true;
  driverLiveToken()
    .then((t) => t.fleets.forEach(driverLiveConnect))
    .catch(() => { live.started = false; setTimeout(startDriverLive, DRIVER_LIVE_RESTART_MS); });
}

export { inboxOrderChatKey, startDriverLive };
