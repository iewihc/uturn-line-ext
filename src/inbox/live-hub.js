// 收件匣連 signalr-chat 的共用部分：發送 KEY 換的短效 token、走 GM_xmlhttpRequest 的 HTTP client、會自己重連的連線。
import { AbortError, HttpClient, HttpError, HttpResponse, HttpTransportType, HubConnectionBuilder, LogLevel, TimeoutError } from "@microsoft/signalr";
import { lineExtApi } from "../core/backend.js";

/* ---------------------------------------------------------------------- *
 *   POST /line-ext/chat-token（發送 KEY）換 30 分鐘 token（只能連 signalr-chat，後台 API 拒收），
 *   回應帶可調度的車隊與自己的 userId。token 只在連上時檢查，連線中到期不會斷；重連前快到期就自動再換。
 *   請求一律走 GM_xmlhttpRequest（不受 LINE 頁面的連線限制）；WebSocket 被擋就退回長輪詢，一樣即時。
 * ---------------------------------------------------------------------- */
const LIVE_HUB_RETRY_MS = [0, 2000, 5000, 10000, 30000]; // 斷線重連間隔（最後一個一直重複）
const LIVE_HUB_RESTART_MS = 15000; // 連不上時隔多久再試
const LIVE_HUB_TOKEN_REFRESH_MS = 60000; // token 剩這麼久就先換新的
const hub = { token: null, pending: null }; // token：{ value, exp, userId, fleets }

// 同時有幾條連線要 token 時只換一次
function liveHubToken() {
  if (hub.token && hub.token.exp - Date.now() >= LIVE_HUB_TOKEN_REFRESH_MS) return Promise.resolve(hub.token);
  hub.pending ||= lineExtApi("POST", "/line-ext/chat-token")
    .then((data) => (hub.token = { value: data.token, exp: Date.parse(data.expiresAt) || 0, userId: data.userId, fleets: data.fleets || [] }))
    .finally(() => { hub.pending = null; });
  return hub.pending;
}
const liveHubUserId = () => hub.token?.userId || "";

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

// 連一條 hub：handlers＝{ 事件名: fn }；join(conn) 連上與重連後都呼叫（重連後群組會清空，要重新加入）。
// 連不上隔一陣子再試；回傳 stop()。
function connectLiveHub(url, handlers, join) {
  const conn = new HubConnectionBuilder()
    .withUrl(url, {
      httpClient: new GmHttpClient(),
      accessTokenFactory: async () => (await liveHubToken()).value,
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => LIVE_HUB_RETRY_MS[Math.min(ctx.previousRetryCount, LIVE_HUB_RETRY_MS.length - 1)] })
    .configureLogging(LogLevel.None)
    .build();
  let stopped = false;
  const start = () => {
    if (stopped) return;
    conn.start().then(() => join(conn)).catch(() => { if (!stopped) setTimeout(start, LIVE_HUB_RESTART_MS); });
  };
  for (const [name, fn] of Object.entries(handlers)) conn.on(name, fn);
  conn.onreconnected(() => join(conn).catch(() => {}));
  start();
  return () => { stopped = true; conn.stop().catch(() => {}); };
}

export { LIVE_HUB_RESTART_MS, connectLiveHub, liveHubToken, liveHubUserId };
