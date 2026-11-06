// 收件匣共用：常數、狀態物件 inbox、ih() 建元素、LINE API 包裝（含 XSRF）。
import { storeGet } from "../core/store.js";
import { makeLineRateLimiter } from "../line/fetch.js";

/* ---------------------------------------------------------------------- *
 * 多開收件匣（https://chat.line.biz/?uturnInbox=1）
 *   頁面在 document-start 就被接管（見檔尾 inboxTakeover），LINE 的 SPA 不啟動；
 *   同網域所以 fetch／EventSource 原生帶 cookie，不需要 CORS 或 GM_xmlhttpRequest。
 *   收訊：每個「啟用」的官方帳號一條 SSE；LINE 的 SSE 名額是算登入帳號的（跨分頁、跨官方帳號），
 *         拿不到名額（fail／too_many_sse_connections）的帳號改每 12 秒輪詢對話清單第一頁，有新事件就走同一套處理（慢 12 秒內）
 *         POST /api/v1/bots/{bot}/streamingApiToken → GET {streamingApiBaseUrl}/api/{version}/sse?token=…
 *         事件 chat.subEvent：message（客人傳來）／messageSent（官方送出）／read（客服標已讀）／chatRead（客人已讀，read.watermark＝時間水位）／pin、unpin（釘選）…
 *   發訊：POST /api/v1/bots/{bot}/chats/{chat}/messages/send { type:"text", text, sendId }，帶 X-XSRF-TOKEN
 *         回覆（引用）：textV2 加 quoteToken＝被引用那則的 quoteToken；回來的訊息帶 quotedMessageId
 *         貼圖 { type:"sticker", packageId, stickerId }；多頁訊息 { type:"cardType", cardTypeMessageId }；
 *         優惠券 { type:"coupon", couponId }；文字夾表情貼 { type:"textV2", text:"…{emoji_0}…", substitution }
 *         （與 LINE 自家前端 ou() 同形：文字裡的 { } 要寫成 {{ }}）
 *   檔案：POST /api/v1/bots/{bot}/messages/{chat}/uploadFile（multipart file）→ { contentMessageToken }
 *         → POST …/messages/bulkSendFiles { items:[{ sendId, contentMessageToken }] }（LINE 網頁版同一條路）
 *   清單：貼圖 /stickers/owned、表情貼 /emojis/owned、預設訊息 /api/v2/…/savedReplies、
 *         多頁訊息 /cardTypeMessages、優惠券 /coupons
 *   一般聊天頁完全不走這段：INBOX_MODE 為 false 時只多一顆「收件匣」入口按鈕。
 * ---------------------------------------------------------------------- */
const INBOX_ENABLED_KEY = "loe_inbox_enabled_bots_v1"; // 啟用監聽的官方帳號 botId 陣列
const INBOX_SOUND_KEY = "loe_inbox_sound_v1"; // 新訊息提示音（預設開）
const INBOX_ORDERS_COLLAPSED_KEY = "loe_inbox_orders_collapsed_v1";
const INBOX_ORDER_FILTERS_COLLAPSED_KEY = "loe_inbox_order_filters_collapsed_v1"; // 官方訊息篩選列下方「訂單狀態」那排往上收起
const INBOX_RAIL_COLLAPSED_KEY = "loe_inbox_rail_collapsed_v1"; // 左欄「官方帳號」收起（預設展開）
const INBOX_COLS_COLLAPSED_KEY = "loe_inbox_cols_collapsed_v1"; // 官方訊息／聊天／司機對話欄收起 { list, thread, side }
const INBOX_DCHAT_DOCK_KEY = "loe_inbox_dchat_dock_v1"; // 司機對話停靠在最右邊一欄（false＝浮動可拖曳）
const INBOX_PIN_DCHAT_KEY = "loe_inbox_pin_dchat_v1"; // 選項：固定開啟司機對話（選到有司機的單就自動開；預設開）
const INBOX_PIN_NOTES_KEY = "loe_inbox_pin_notes_v1"; // 選項：固定開啟記事本（預設關）
const INBOX_HIDE_OA_NAME_KEY = "loe_inbox_hide_oa_name_v1"; // 選項：官方訊息列表不顯示官方帳號名稱（有群編時只顯示群編）
const INBOX_AUTO_READ_KEY = "loe_inbox_auto_read_v1"; // 選項：開啟對話自動標已讀（預設關＝永不自動，只手動按）
const INBOX_COL_WIDTHS_KEY = "loe_inbox_col_widths_v1"; // 三欄寬度 { rail, list, side }（px；拖拉分隔線調整，雙擊回預設）
const INBOX_SIDE_SPLIT_KEY = "loe_inbox_side_split_v1"; // 右欄司機對話的高度（px；兩個都開時中間可拖拉）
const INBOX_TERMS_VERSION = "2026-11-05.5"; // 條款內容變更時更新，與腳本版本分開，避免一般更新重複要求同意
const INBOX_TERMS_KEY_PREFIX = "loe_inbox_terms_acceptance_v1::"; // 本機依後台帳號記錄版本與同意時間
const INBOX_PAGES_PER_BOT = 2; // 每個帳號初始掃幾頁對話（25 位/頁）
const INBOX_TOAST_MS = 20000; // 通知卡片停留時間；同一位客人再來訊會重新計時
const INBOX_BOTS_REFRESH_MS = 60000; // 未啟用帳號的未讀數靠 /api/v1/bots 每分鐘更新
const INBOX_LIMIT_RETRY_MS = 120000; // 連線數已滿時隔多久再試 SSE（期間改輪詢）
const INBOX_POLL_MS = 12000; // 連線數已滿的帳號改輪詢對話清單的間隔
const INBOX_ORDERS_REFRESH_MS = 15000; // 開著的對話多久重抓一次訂單狀態
const INBOX_OA_COLORS = ["#1c6cf3", "#0f766e", "#7c3aed", "#b45309", "#be185d", "#0369a1", "#4d7c0f", "#9f1239"];
const INBOX_FILTERS = [
  { id: "unread", label: "未讀" },
  { id: "all", label: "全部" },
  { id: "followUp", label: "待處理" }, // 同 LINE 聊天室的資料夾（folderType=FOLLOW_UP）
  { id: "done", label: "處理完畢" }, // folderType=DONE
  { id: "unassigned", label: "未指派" },
  { id: "mine", label: "我負責" },
];
const inbox = {
  bots: [], // [{ botId, name, iconUrl, unreadCount, color }]
  botById: new Map(),
  me: null, // /api/v1/me → { bizId, name }
  enabled: new Set((storeGet(INBOX_ENABLED_KEY, []) || []).filter((v) => typeof v === "string")),
  sound: storeGet(INBOX_SOUND_KEY, true) !== false,
  conns: new Map(), // botId → { es, status, lastEventId, retry, timer, error }
  chats: new Map(), // "bot/chat" → chat 模型
  threads: new Map(), // "bot/chat" → { list, loading, error }
  toasts: new Map(), // "bot/chat" → { count, lines, timer }
  selected: null,
  filter: "unread",
  pinDchat: storeGet(INBOX_PIN_DCHAT_KEY, true) !== false,
  pinNotes: storeGet(INBOX_PIN_NOTES_KEY, false) === true,
  notesOpen: storeGet(INBOX_PIN_NOTES_KEY, false) === true, // 記事本開著（固定開啟時一律開）
  notesCollapsed: false, // 記事本收起成一條（固定開啟也可收；預設展開）
  noteEditing: null, // 正在編輯的筆記 noteId（換對話清掉）
  notesMax: false, // 記事本放大：蓋在訊息串上的大視窗（本次頁面有效；Esc 或「還原」回右欄）
  dchatHeight: Number(storeGet(INBOX_SIDE_SPLIT_KEY, 0)) || 0, // 0＝預設（約 55%）
  colWidths: Object(storeGet(INBOX_COL_WIDTHS_KEY, {})), // 左欄／中欄／右側欄寬度（沒設＝CSS 預設）
  optionsOpen: false,
  autoRead: storeGet(INBOX_AUTO_READ_KEY, false) === true,
  threadAtBottom: true, // 對話訊息區是否停在底部（圖片載入後要不要跟著捲）
  hideOaName: storeGet(INBOX_HIDE_OA_NAME_KEY, false) === true,
  notes: new Map(), // "bot/chat" → { list, total, next, loading, error }
  orders: new Map(), // "bot/chat" → { list, loading, error }（以對話連結查的進行中訂單）
  board: new Map(), // botId → { version, chats: Map(chatId → 看板欄位[]), orderChat: Map(orderId → chatId) }（官方帳號每個聊天室進行中訂單）
  orderFilter: "", // 訂單狀態篩選（看板欄位；空＝不篩）
  linked: new Set(), // 已對應到乘客的 "bot/chat"
  linkProbed: new Map(), // "bot/chat" → 上次送去比對的內容（大頭貼＋訊息編號沒變就不再問）
  owners: new Map(), // botId → Map(bizId → name)
  renaming: false,
  picker: null, // 貼圖／表情貼面板：{ kind: "sticker"|"emoji", pkg }（null＝收起）
  colsCollapsed: { list: false, thread: false, side: false }, // 其他欄收起（initInboxCollapse 讀設定）
  railCollapsed: storeGet(INBOX_RAIL_COLLAPSED_KEY, false) === true, // 左欄「官方帳號」往左收成一條（監聽不受影響）
  orderFiltersCollapsed: storeGet(INBOX_ORDER_FILTERS_COLLAPSED_KEY, false) === true, // 訂單狀態篩選那排收起（篩選仍生效）
  ordersCollapsed: storeGet(INBOX_ORDERS_COLLAPSED_KEY, false) === true, // 標頭下方訂單列收起（只剩狀態＋單號）
  dchatDock: storeGet(INBOX_DCHAT_DOCK_KEY, true) !== false, // 司機對話：true＝對話右邊再開一欄，false＝浮動蓋在對話上、可拖曳
  dchatAutoFor: "", // 已自動開過司機對話的 "bot/chat"（手動關掉後，同一位客人不再自動開）
  dchatWant: "", // 下一次要開的司機對話訂單（司機訊息通知卡點進來的那一台）
  flagBusy: "", // 正在改「待處理／處理完畢」的對話 key
  boardRefreshing: false, // 「官方訊息」訂單狀態數量手動重新整理中
  botsLoaded: false, started: false, // 官方帳號清單讀完／已通過身份授權開始連線
  packs: new Map(), // "botId/sticker"｜"botId/emoji" → { list: [{ id, items }], loading, error }
  replyTo: null, // 回覆（引用）哪一則：{ id, quoteToken, text, who }；送出時帶 quoteToken，換對話或送出後清掉
  emojiTokens: new Map(), // 輸入框裡 [表情貼N] 的 N → { productId, emojiId }（送出時換成 textV2 的 substitution）
  contents: null, // 選擇內容視窗：{ tab: "saved"|"card"|"coupon", selected }（null＝關閉）
  contentLists: new Map(), // "botId/tab" → { list, page, next, done, loading, error }
  csrf: null,
  limiter: makeLineRateLimiter(),
  audio: null,
  lastEventAt: 0,
  el: {},
};
const inboxKey = (botId, chatId) => `${botId}/${chatId}`;
const inboxBotName = (botId) => inbox.botById.get(botId)?.name || botId;
const inboxBotColor = (botId) => inbox.botById.get(botId)?.color || INBOX_OA_COLORS[0];
const inboxInitial = (name) => (name || "").replace(/^[^-]*-/, "").trim().slice(0, 1) || "？";
const inboxChatUrl = (chat) => `${location.origin}/${chat.botId}/chat/${encodeURIComponent(chat.chatId)}`;
// 群編顯示：固定去掉第 1 個字元（emoji 算一個字；*📗→📗、W0/→0/），去掉後空白就不顯示。派單送出仍用完整群編。
const inboxGroupLabel = (g) => Array.from(String(g || "")).slice(1).join("").trim() || "";
// DOM 建構小工具：attrs 的 text → textContent、class → className、on<event> → listener，其餘 setAttribute。
// 所有來自 LINE 的字串一律走 textContent，不組 HTML。
function ih(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v; // 只給內建 SVG 圖示
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}
function inboxTime(ms) {
  if (!ms) return "";
  const d = new Date(ms), now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toDateString() === now.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}
/* ---- LINE 同網域 API：GET 不帶 CSRF，其餘帶 X-XSRF-TOKEN；429 暫停到下一分鐘重送；403 換一次 token ---- */
async function inboxCsrf(force) {
  if (!force && inbox.csrf) return inbox.csrf;
  const r = await fetch("/api/v1/csrfToken", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
  if (r.status === 401) throw new Error("LINE 登入已失效，請先登入 chat.line.biz");
  if (!r.ok) throw new Error(`取不到 CSRF token（${r.status}）`);
  inbox.csrf = await r.json();
  return inbox.csrf;
}
// body 給 FormData 就是 multipart（檔案上傳，Content-Type 交給瀏覽器帶 boundary），其他一律 JSON
// opts.priority：點開對話等使用者操作，不排在輪詢／看板的佇列後面
async function inboxApi(method, path, body, retried = false, opts = {}) {
  await inbox.limiter.acquire(undefined, !!opts.priority);
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = { Accept: "application/json", "x-oa-chat-client-version": "20240513144702" };
  if (method !== "GET") {
    const csrf = await inboxCsrf();
    headers[csrf.headerName || "X-XSRF-TOKEN"] = csrf.token;
    if (!isForm) headers["Content-Type"] = "application/json";
  }
  const r = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store", headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (r.status === 429) { inbox.limiter.pauseUntilNextMinute(); return inboxApi(method, path, body, retried, opts); }
  if (r.status === 403 && method !== "GET" && !retried) { inbox.csrf = null; return inboxApi(method, path, body, true, opts); }
  if (r.status === 401) throw new Error("LINE 登入已失效，請先登入 chat.line.biz");
  if (!r.ok) { // LINE 錯誤內容是 { code, message? }，帶出來才看得出原因（例如 exceeds_note_limit）
    let detail = ""; try { const j = JSON.parse(await r.text()); detail = j?.message || j?.code || ""; } catch (_) {}
    const err = new Error(`LINE 回應 ${r.status}${detail ? `（${detail}）` : ""}`); err.status = r.status; err.code = detail; throw err;
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

export { INBOX_AUTO_READ_KEY, INBOX_BOTS_REFRESH_MS, INBOX_COLS_COLLAPSED_KEY, INBOX_COL_WIDTHS_KEY, INBOX_DCHAT_DOCK_KEY, INBOX_ENABLED_KEY, INBOX_FILTERS, INBOX_HIDE_OA_NAME_KEY, INBOX_LIMIT_RETRY_MS, INBOX_OA_COLORS, INBOX_ORDERS_COLLAPSED_KEY, INBOX_ORDER_FILTERS_COLLAPSED_KEY, INBOX_ORDERS_REFRESH_MS, INBOX_PAGES_PER_BOT, INBOX_PIN_DCHAT_KEY, INBOX_PIN_NOTES_KEY, INBOX_POLL_MS, INBOX_RAIL_COLLAPSED_KEY, INBOX_SIDE_SPLIT_KEY, INBOX_SOUND_KEY, INBOX_TERMS_KEY_PREFIX, INBOX_TERMS_VERSION, INBOX_TOAST_MS, ih, inbox, inboxApi, inboxBotColor, inboxBotName, inboxChatUrl, inboxGroupLabel, inboxInitial, inboxKey, inboxTime };
