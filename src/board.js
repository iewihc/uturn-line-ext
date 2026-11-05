// 訂單看板：預約／未派／承接／抵達／執行五欄、車隊與全部／自己篩選、右側細節抽屜。
import { hasLineExtAuth, lineExtApi } from "./core/backend.js";
import { ic } from "./core/icons.js";
import { storeGet, storeSet } from "./core/store.js";
import { closeDriverChat, driverChat, msOf, openDriverChat } from "./driver-chat.js";
import { inboxFetchChat } from "./inbox/chats.js";
import { ih, inbox, inboxKey, inboxTime } from "./inbox/core.js";
import { inboxOpenChat } from "./inbox/send.js";
import { renderInboxHeader } from "./inbox/shell.js";
import { cancelLineExtOrder } from "./orders.js";
import { toast } from "./ui/toast.js";

/* ---- 啟動（只在 INBOX_MODE） ---- */
/* ---------------------------------------------------------------------- *
 * 訂單看板（獨立畫面，不影響收件匣）：同 admin 調度中心新版看板——預約／未派／承接／抵達／執行五欄，
 *   範圍同調度中心權限（系統管理員全部車隊、其他人角色有調度中心頁面的車隊），「自己」模式同 admin。
 *   GET /line-ext/dispatch-board?fleet=&mine=&version=（發送 KEY）；開著時每 15 秒抓一次（背景 60 秒），沒變只回 unchanged。
 *   點卡片：右側抽屜看細節，可開客人對話（回收件匣）、司機對話、取消。
 * ---------------------------------------------------------------------- */
const BOARD_FLEET_KEY = "loe_board_fleet_v1";
const BOARD_MINE_KEY = "loe_board_mine_v1";
const BOARD_REFRESH_MS = 15000;
const BOARD_HIDDEN_REFRESH_MS = 60000;
const BOARD_COLUMNS = [
  { id: "booking", label: "預約" }, { id: "pending", label: "未派" }, { id: "accepted", label: "承接" },
  { id: "arrived", label: "抵達" }, { id: "executing", label: "執行" },
];
const BOARD_WAIT_WARN_MINS = 5; // 未派／抵達等超過這麼久標紅
const board = {
  open: false, fleet: storeGet(BOARD_FLEET_KEY, "") || "", mine: storeGet(BOARD_MINE_KEY, false) === true,
  q: "", data: null, fleets: [], version: "", loading: false, error: "", timer: 0, run: 0, selected: "", at: 0,
};
const boardChatOpen = () => !!driverChat.host && driverChat.host === inbox.el.boardChat; // 司機對話開在看板抽屜裡
const boardMinsSince = (iso) => { const t = msOf(iso); return t ? Math.max(0, Math.floor((Date.now() - t) / 60000)) : null; };
function boardSource(o) {
  if (o.lineChatUrl) return "懶惰蟲";
  if (o.clientLineGroup) return "群組叫車";
  if (o.createdType === "client" || o.source === "client") return o.createdViaAi ? "AI 叫車" : "客叫";
  return { discord: "Discord", system: "後台", store: "店家", line: "LINE" }[o.createdType || o.source] || "";
}
function boardCustomer(o) {
  if (o.clientLineGroup) return [o.clientRequesterName, o.clientUserName].filter(Boolean).join(" / ");
  return o.clientUserName || o.note || "";
}
// 每欄卡片右上角的時間：未派等多久、承接多久到、抵達等多久、執行上車多久、預約時間
function boardTime(col, o) {
  if (col === "booking") return { text: o.scheduledAt ? inboxTime(msOf(o.scheduledAt)) : "", late: false };
  if (col === "pending") { const m = boardMinsSince(o.createdAt); return { text: m == null ? "" : `已等 ${m} 分`, late: m >= BOARD_WAIT_WARN_MINS }; }
  if (col === "accepted") {
    if (o.delayMins > 0) return { text: `遲到 ${o.delayMins} 分`, late: true };
    return { text: o.estPickupMins > 0 ? `約 ${o.estPickupMins} 分到` : o.acceptanceTime ? `接單 ${inboxTime(msOf(o.acceptanceTime))}` : "", late: false };
  }
  if (col === "arrived") { const m = boardMinsSince(o.arrivedAt); return { text: m == null ? "" : `已等 ${m} 分`, late: m >= BOARD_WAIT_WARN_MINS }; }
  const m = boardMinsSince(o.pickedUpAt);
  return { text: m == null ? "" : `上車 ${m} 分`, late: false };
}
const boardCar = (o) => [o.carPlate && `${o.carPlate}${o.carColor ? `(${o.carColor})` : ""}`, o.driverNo].filter(Boolean).join(" · ");
function boardMatches(o) {
  const q = board.q.trim().toLowerCase();
  if (!q) return true;
  return [o.shortId, o.pickupAddress, o.destAddress, o.carPlate, o.driverNo, o.driverName, boardCustomer(o), o.oriTextDisplay || o.oriText, o.createdBy]
    .some((v) => String(v || "").toLowerCase().includes(q));
}
function boardFind(id) {
  for (const c of BOARD_COLUMNS) {
    const o = (board.data?.[c.id] || []).find((x) => x.id === id);
    if (o) return { col: c, order: o };
  }
  return null;
}
function openBoard() {
  if (board.open) return;
  board.open = true;
  if (driverChat.host === inbox.el.dchat) closeDriverChat();
  inbox.el.body.hidden = true;
  inbox.el.board.hidden = false;
  renderInboxHeader();
  renderBoard();
  loadBoard();
}
function closeBoard() {
  if (!board.open) return;
  board.open = false;
  clearTimeout(board.timer);
  board.run++;
  if (boardChatOpen()) closeDriverChat();
  board.selected = "";
  inbox.el.board.hidden = true;
  inbox.el.body.hidden = false;
  renderInboxHeader();
}
function scheduleBoard() {
  clearTimeout(board.timer);
  if (!board.open) return;
  board.timer = setTimeout(loadBoard, document.visibilityState === "visible" ? BOARD_REFRESH_MS : BOARD_HIDDEN_REFRESH_MS);
}
async function loadBoard(force) {
  if (!board.open) return;
  clearTimeout(board.timer);
  if (!hasLineExtAuth()) { board.error = "請先按上方「身份授權」"; renderBoard(); return; }
  const run = ++board.run;
  board.loading = true;
  renderBoardToolbar();
  const q = `&fleet=${encodeURIComponent(board.fleet)}&mine=${board.mine}` + (force || !board.data ? "" : `&version=${encodeURIComponent(board.version)}`);
  try {
    const res = await lineExtApi("GET", "/line-ext/dispatch-board", undefined, q);
    if (run !== board.run) return;
    board.fleets = res.fleets || [];
    board.at = Date.now();
    board.error = "";
    if (!res.unchanged && res.board) {
      board.data = res.board;
      board.version = res.version || "";
      if (res.fleet !== board.fleet) { board.fleet = res.fleet; storeSet(BOARD_FLEET_KEY, board.fleet); }
    }
  } catch (e) {
    if (run !== board.run) return;
    board.error = e.message || String(e);
  }
  board.loading = false;
  renderBoard();
  scheduleBoard();
}
function setBoardScope(patch) {
  Object.assign(board, patch, { data: null, version: "", selected: "" });
  storeSet(BOARD_FLEET_KEY, board.fleet);
  storeSet(BOARD_MINE_KEY, board.mine);
  if (boardChatOpen()) closeDriverChat();
  renderBoard();
  loadBoard(true);
}
function renderBoard() {
  renderBoardToolbar();
  renderBoardColumns();
  renderBoardDrawer();
}
// 工具列只在車隊清單／車隊／模式變了才重建（輪詢重畫不打斷搜尋框打字），更新時間與重新整理按鈕就地更新
function renderBoardToolbar() {
  const bar = inbox.el.boardBar;
  if (!bar) return;
  const sig = JSON.stringify([board.fleets.map((f) => f.code), board.fleet, board.mine]);
  if (bar.dataset.sig !== sig) {
    bar.dataset.sig = sig;
    bar.textContent = "";
    const fleetSel = board.fleets.length > 1
      ? ih("select", { class: "loe-board-select", "aria-label": "車隊", onchange: (e) => setBoardScope({ fleet: e.currentTarget.value }) },
        board.fleets.map((f) => { const opt = ih("option", { value: f.code, text: f.name || f.code }); opt.selected = f.code === board.fleet; return opt; }))
      : board.fleets.length ? ih("strong", { text: board.fleets[0].name || board.fleets[0].code }) : null;
    const search = ih("input", { class: "loe-board-search", type: "search", value: board.q, placeholder: "搜尋單號、地址、車牌、司機、客人", "aria-label": "搜尋訂單" });
    search.addEventListener("input", () => { board.q = search.value; renderBoardColumns(); });
    const scopeBtn = (mine, text) => ih("button", { type: "button", class: "loe-inbox-btn" + (board.mine === mine ? " on" : ""),
      "aria-pressed": board.mine === mine ? "true" : "false", onclick: () => board.mine !== mine && setBoardScope({ mine }) }, text);
    bar.append(...[
      ih("strong", { class: "loe-board-title", text: "訂單看板" }),
      fleetSel,
      ih("span", { class: "loe-board-seg" }, scopeBtn(false, "全部"), scopeBtn(true, "自己")),
      search,
      ih("span", { class: "loe-board-spacer" }),
      ih("span", { class: "loe-inbox-muted loe-board-status" }),
      ih("button", { type: "button", class: "loe-inbox-btn loe-board-refresh", html: ic("refresh"), onclick: () => loadBoard(true) }, ih("span", { text: "重新整理" })),
    ].filter(Boolean));
  }
  bar.querySelector(".loe-board-status").textContent = board.loading ? "更新中…" : board.at ? `更新於 ${inboxTime(board.at)}` : "";
  bar.querySelector(".loe-board-refresh").disabled = board.loading;
}
function renderBoardColumns() {
  const host = inbox.el.boardCols;
  if (!host) return;
  host.textContent = "";
  if (board.error && !board.data) { host.append(ih("div", { class: "loe-inbox-empty err", text: board.error })); return; }
  if (!board.data) { host.append(ih("div", { class: "loe-inbox-empty", text: "讀取訂單中…" })); return; }
  for (const c of BOARD_COLUMNS) {
    const list = (board.data[c.id] || []).filter(boardMatches);
    const total = board.data.counts?.[c.id] ?? list.length;
    host.append(ih("section", { class: `loe-board-col ${c.id}`, "aria-label": c.label },
      ih("div", { class: "loe-board-col-head" },
        ih("span", { class: `loe-board-dot ${c.id}` }),
        ih("strong", { text: c.label }),
        ih("span", { class: "loe-board-count", text: board.q ? `${list.length}／${total}` : String(total) })),
      ih("div", { class: "loe-board-cards" },
        list.length ? list.map((o) => boardCard(c.id, o)) : ih("div", { class: "loe-board-none", text: board.q ? "沒有符合的單" : "沒有單" }))));
  }
}
function boardCard(col, o) {
  const t = boardTime(col, o);
  const src = boardSource(o);
  const car = boardCar(o);
  return ih("button", { type: "button", class: "loe-board-card" + (board.selected === o.id ? " selected" : ""),
    onclick: () => { board.selected = board.selected === o.id ? "" : o.id; if (boardChatOpen()) closeDriverChat(); renderBoardColumns(); renderBoardDrawer(); } },
    ih("span", { class: "loe-board-card-top" },
      ...[ih("strong", { text: o.shortId || "" }),
        src ? ih("span", { class: "loe-board-src", text: src }) : null,
        o.units > 1 ? ih("span", { class: "loe-board-src", text: `${o.units}台` }) : null,
        ih("span", { class: "loe-board-spacer" }),
        t.text ? ih("span", { class: "loe-board-time" + (t.late ? " late" : ""), text: t.text }) : null].filter(Boolean)),
    ih("span", { class: "loe-board-addr", text: o.pickupAddress || o.oriTextDisplay || o.oriText || "" }),
    ...[boardCustomer(o) ? ih("span", { class: "loe-board-sub", text: boardCustomer(o) }) : null,
      car ? ih("span", { class: "loe-board-sub", text: car }) : col !== "pending" && col !== "booking" ? null : ih("span", { class: "loe-board-sub muted", text: "尚未派到車" })].filter(Boolean));
}
// 抽屜：訂單細節＋動作（開客人對話／在官方視窗開啟／司機對話／取消）
function renderBoardDrawer() {
  const host = inbox.el.boardDrawer;
  if (!host) return;
  const found = board.selected && boardFind(board.selected);
  host.hidden = !found;
  if (!found) { host.textContent = ""; return; }
  if (boardChatOpen()) return; // 司機對話開著時不重畫（輪詢不打斷打字）
  host.textContent = "";
  const { col, order: o } = found;
  const chatUrl = o.lineChatUrl || o.oaChatUrl || "";
  const [, gid, chatId] = chatUrl.match(/chat\.line\.biz\/(U[0-9a-f]{32})\/chat\/([CU][0-9a-f]{32})/i) || [];
  const inInbox = gid && inbox.botById.has(gid);
  const hasDriver = !!o.driverId;
  const row = (label, value) => value ? ih("div", { class: "loe-board-kv" }, ih("span", { text: label }), ih("span", { text: value })) : null;
  const when = (iso) => iso ? inboxTime(msOf(iso)) : "";
  const summary = { id: o.id, shortId: o.shortId, hasDriver, column: col.id, columnLabel: col.label };
  const chatHost = ih("div", { class: "loe-board-dchat" });
  inbox.el.boardChat = chatHost;
  host.append(
    ih("div", { class: "loe-board-drawer-head" },
      ih("span", { class: `loe-board-pill ${col.id}`, text: col.label }),
      ih("strong", { text: o.shortId || "" }),
      boardSource(o) ? ih("span", { class: "loe-board-src", text: boardSource(o) }) : null,
      ih("span", { class: "loe-board-spacer" }),
      ih("button", { type: "button", class: "loe-inbox-x", html: ic("x"), "aria-label": "關閉訂單細節", onclick: () => { board.selected = ""; renderBoardColumns(); renderBoardDrawer(); } })),
    ih("div", { class: "loe-board-actions" },
      ...[inInbox ? ih("button", { type: "button", class: "loe-inbox-btn primary", html: ic("message-square"), onclick: () => boardOpenChat(gid, chatId) }, ih("span", { text: "開啟客人對話" })) : null,
        chatUrl && !inInbox ? ih("a", { class: "loe-inbox-btn", href: chatUrl, target: "_blank", rel: "noopener", html: ic("external-link") }, ih("span", { text: "在官方視窗開啟" })) : null,
        hasDriver ? ih("button", { type: "button", class: "loe-inbox-btn", html: ic("message-square"),
          onclick: () => openDriverChat({ host: chatHost, orders: [summary], orderId: o.id, onClose: () => { chatHost.textContent = ""; renderBoardDrawer(); } }) }, ih("span", { text: "司機對話" })) : null,
        ih("button", { type: "button", class: "loe-inbox-btn loe-board-cancel", text: "取消",
          onclick: () => cancelLineExtOrder(summary, (done) => { if (done) { board.selected = ""; setTimeout(() => loadBoard(true), 800); } }) }),
      ].filter(Boolean)),
    ih("div", { class: "loe-board-kvs" },
      ...[row("上車", o.pickupAddress), row("下車", o.destAddress), row("客人", boardCustomer(o)),
        row("司機", [o.driverNo, o.driverName].filter(Boolean).join(" ")), row("車輛", [boardCar(o), o.carModel].filter(Boolean).join(" · ")),
        row("預約", when(o.scheduledAt)), row("派單", when(o.createdAt)), row("接單", when(o.acceptanceTime)),
        row("抵達", when(o.arrivedAt)), row("上車時間", when(o.pickedUpAt)), row("建單", o.createdBy),
        row("原文", o.oriTextDisplay || o.oriText)].filter(Boolean)),
    ...(chatUrl ? [] : [ih("div", { class: "loe-inbox-muted loe-board-note", text: "這張單沒有對應到 LINE 對話（例如 Discord、後台派的單）。" })]),
    chatHost,
  ); // 原生 append 會把 null 印成文字，條件項目用展開
}
// 回收件匣打開這位客人的對話（不在清單裡就先抓進來）
async function boardOpenChat(botId, chatId) {
  const key = inboxKey(botId, chatId);
  if (!inbox.chats.has(key) && !(await inboxFetchChat(botId, chatId))) return toast("找不到這位客人的對話", "err", 3000);
  closeBoard();
  inboxOpenChat(key);
}

// 載入時註冊的事件／計時器：由 main.js 的 uturnMain() 呼叫一次。
function initBoard() {
  document.addEventListener("visibilitychange", () => { if (board.open && document.visibilityState === "visible") loadBoard(); });
}

export { board, closeBoard, initBoard, openBoard };
