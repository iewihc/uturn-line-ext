// 收件匣外框：標頭、授權閘門、左欄官方帳號列表、啟動與身份授權。
import { startDriverLive } from "./driver-live.js";
import { aiBots } from "../ai-toggle.js";
import { board, closeBoard, openBoard } from "../board.js";
import { hasLineExtAuth, lineAuthDoneText, saveLineCookie } from "../core/backend.js";
import { UTURN_BUILD } from "../core/constants.js";
import { ic } from "../core/icons.js";
import { storeSet } from "../core/store.js";
import { inboxConnect, inboxEnabledIds, inboxLoadChats, inboxSetEnabled, inboxUnreadTotal } from "./chats.js";
import { inboxLoadNotes, inboxMarkRead, renderInboxNotes } from "./chat-tools.js";
import { INBOX_AUTO_READ_KEY, INBOX_HIDE_OA_NAME_KEY, INBOX_PIN_DCHAT_KEY, INBOX_PIN_NOTES_KEY, INBOX_RAIL_COLLAPSED_KEY, INBOX_SOUND_KEY, ih, inbox, inboxBotName, inboxGroupLabel, inboxInitial } from "./core.js";
import { renderInboxList } from "./list.js";
import { inboxBeep, inboxSoundReady } from "./notify.js";
import { inboxChatColumns, inboxLoadBoard, inboxQueueLink, inboxScheduleBoard } from "./order-status.js";
import { inboxLoadOrders, renderInboxOrders } from "./orders.js";
import { renderInboxThread, renderInboxToasts } from "./thread.js";
import { GEAR_ICON } from "../prefix.js";
import { getChatOverrides, getDispatcher, getPrefixForGid } from "../settings.js";
import { toast } from "../ui/toast.js";

/* ---- 畫面 ---- */
function inboxRenderAll() {
  renderInboxHeader();
  renderInboxRail();
  renderInboxList();
  renderInboxThread();
  renderInboxToasts();
  const n = inboxUnreadTotal();
  document.title = (n ? `(${n}) ` : "") + "UTurn 收件匣";
}
/* ---- 右上「選項」：固定開啟司機對話／記事本、自動標已讀、提示音（都記在這台電腦） ---- */
function inboxOptionsButton() {
  const wrap = ih("div", { class: "loe-inbox-options" });
  const set = (key, field, value) => { inbox[field] = value; storeSet(key, value); };
  const row = (icon, label, checked, onChange, hint) => ih("label", { class: "loe-inbox-option" },
    ih("span", { class: "loe-inbox-option-icon", html: ic(icon) }),
    ih("span", { class: "loe-inbox-option-text" }, ih("span", { text: label }), hint ? ih("small", { text: hint }) : null),
    ih("input", { type: "checkbox", checked, onchange: (e) => onChange(e.currentTarget.checked) }));
  wrap.append(ih("button", { type: "button", class: "loe-inbox-btn" + (inbox.optionsOpen ? " on" : ""), html: GEAR_ICON, "aria-expanded": inbox.optionsOpen ? "true" : "false",
    onclick: (e) => { e.stopPropagation(); inbox.optionsOpen = !inbox.optionsOpen; renderInboxHeader(); } }, ih("span", { text: "選項" })));
  if (!inbox.optionsOpen) return wrap;
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  wrap.append(ih("div", { class: "loe-inbox-options-menu", role: "menu", "aria-label": "選項", onclick: (e) => e.stopPropagation() },
    ih("div", { class: "loe-inbox-options-group", text: "右欄" }),
    row("message-square", "固定開啟司機對話", inbox.pinDchat, (v) => { set(INBOX_PIN_DCHAT_KEY, "pinDchat", v); if (v && chat) { inbox.dchatAutoFor = ""; inboxLoadOrders(chat); } renderInboxOrders(); },
      "選到有司機的單就自動打開，多台開第一台"),
    row("notebook", "固定開啟記事本", inbox.pinNotes, (v) => {
      set(INBOX_PIN_NOTES_KEY, "pinNotes", v);
      if (v) { inbox.notesOpen = true; inbox.notesCollapsed = false; if (chat && !inbox.notes.has(chat.key)) inboxLoadNotes(chat); }
      renderInboxNotes(); renderInboxThread();
    }, "可以收起，但不會關掉"),
    ih("div", { class: "loe-inbox-options-group", text: "列表" }),
    row("eye-off", "不顯示官方帳號名稱", inbox.hideOaName, (v) => { set(INBOX_HIDE_OA_NAME_KEY, "hideOaName", v); renderInboxList(); }, "官方訊息每列只顯示群編（例如 0/），沒設群編的帳號仍顯示名稱"),
    ih("div", { class: "loe-inbox-options-group", text: "已讀" }),
    row("check-check", "開啟對話自動標已讀", inbox.autoRead, (v) => { set(INBOX_AUTO_READ_KEY, "autoRead", v); if (v && chat?.unread) inboxMarkRead(chat); },
      "不勾＝永遠不自動標，只有按「標為已讀」才標（回覆後也不標）"),
    ih("div", { class: "loe-inbox-options-group", text: "提示音" }),
    row("bell", "新訊息提示音", inbox.sound, (v) => {
      set(INBOX_SOUND_KEY, "sound", v);
      if (v) {
        inboxBeep(); // 使用者手勢裡建立／恢復 AudioContext
        if (typeof Notification === "function" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
      }
    }, "開啟時會響一聲"),
  ));
  return wrap;
}
function renderInboxHeader() {
  const host = inbox.el.header;
  if (!host) return;
  host.textContent = "";
  const live = [...inbox.conns.values()].filter((c) => c.status === "live").length;
  const stats = ih("div", { class: "loe-inbox-stats" },
    ih("span", { class: "loe-inbox-muted", text: "啟用帳號" }),
    ih("strong", { text: `${inboxEnabledIds().length}／${inbox.bots.length}` }),
    ih("span", { class: "loe-inbox-muted", text: "連線中" }),
    ih("strong", { text: String(live) }),
    ih("span", { class: "loe-inbox-muted", text: "未讀對話" }),
    ih("span", { class: "loe-inbox-badge", text: String(inboxUnreadTotal()) }),
  );
  const optionsBtn = inboxOptionsButton();
  const hint = inboxSoundReady() ? null : ih("span", { class: "loe-inbox-hint", text: "點一下頁面啟用提示音" });
  const authed = hasLineExtAuth();
  const authBtn = ih("button", {
    type: "button", class: "loe-inbox-btn" + (authed ? " on" : " warn"), html: ic("shield-check"),
    title: authed ? `已授權：${getDispatcher()}（點擊可重新授權）` : "收件匣需要身份授權才能使用",
    onclick: inboxAuthorize,
  }, ih("span", { text: authed ? "已授權" : "身份授權" }));
  const backBtn = ih("a", { class: "loe-inbox-btn", href: "https://chat.line.biz/", html: ic("external-link") }, ih("span", { text: "回 LINE 後台" }));
  host.append(...[
    ih("div", { class: "loe-inbox-brand" },
      ih("span", { class: "loe-inbox-logo", html: ic("inbox") }),
      ih("strong", { text: "UTurn 收件匣" }),
      ih("span", { class: "loe-inbox-muted", text: "懶惰蟲 v" + UTURN_BUILD }),
    ),
    authed ? stats : null,
    ih("div", { class: "loe-inbox-spacer" }),
    authed
      ? ih("div", { class: "loe-inbox-actions" },
        ih("button", { type: "button", class: "loe-inbox-btn" + (board.open ? " on" : ""), html: ic(board.open ? "inbox" : "truck"),
          "aria-pressed": board.open ? "true" : "false", onclick: () => (board.open ? closeBoard() : openBoard()) },
          ih("span", { text: board.open ? "回到對話" : "訂單看板" })),
        ih("button", { type: "button", class: "loe-inbox-btn", text: "全部開啟", onclick: () => inbox.bots.forEach((b) => { if (!inbox.enabled.has(b.botId)) inboxSetEnabled(b.botId, true); }) }),
        ih("button", { type: "button", class: "loe-inbox-btn", text: "全部關閉", onclick: () => inboxEnabledIds().forEach((id) => inboxSetEnabled(id, false)) }),
        authBtn, hint, optionsBtn, backBtn)
      : ih("div", { class: "loe-inbox-actions" }, authBtn, backBtn), // 沒授權：其他功能先不開
  ].filter(Boolean)); // 原生 append 會把 null 印成文字
}
// 沒有身份授權不得進收件匣：整頁蓋住只留「身份授權」；通過後才開始連線、讀對話、抓訂單狀態
function renderInboxGate() {
  const gate = inbox.el.gate;
  if (!gate) return;
  const locked = !hasLineExtAuth();
  gate.hidden = !locked;
  gate.textContent = "";
  if (!locked) { inboxStart(); return; }
  const account = getDispatcher();
  gate.append(ih("div", { class: "loe-inbox-gate-box" },
    ih("span", { class: "loe-inbox-gate-icon", html: ic("shield-check") }),
    ih("strong", { text: "需要身份授權才能使用收件匣" }),
    ih("p", { text: account
      ? `請輸入後台帳號 ${account} 的發送 KEY（後台發放，有效期一個月）。授權後才會開始監聽官方帳號、讀對話與訂單。`
      : "還沒設定後台帳號：請先到 LINE 聊天室的「轉發設定」填寫 UTurn 後台帳號（Email），再回到這裡授權。" }),
    ih("div", { class: "loe-inbox-gate-actions" },
      account ? ih("button", { type: "button", class: "loe-inbox-btn primary", html: ic("shield-check"), onclick: inboxAuthorize }, ih("span", { text: "身份授權" })) : null,
      ih("a", { class: "loe-inbox-btn", href: "https://chat.line.biz/", html: ic("external-link") }, ih("span", { text: account ? "回 LINE 後台" : "去 LINE 聊天室設定" })))));
}
// 授權通過且官方帳號清單讀完：接上已開帳號（只做一次）
function inboxStart() {
  if (inbox.started || !inbox.botsLoaded || !hasLineExtAuth()) return;
  inbox.started = true;
  for (const id of inboxEnabledIds()) {
    inboxConnect(id);
    inboxLoadChats(id).catch((e) => toast(`${inboxBotName(id)}：讀取對話失敗，${e.message}`, "err", 4000));
    inboxLoadBoard(id);
  }
  inboxScheduleBoard();
  startDriverLive();
}
// 收件匣的身份授權：同 LINE 後台選單的「身份授權」，用任一官方帳號讀目前的 LINE 登入；授權後馬上重抓需要 KEY 的資料
async function inboxAuthorize(e) {
  const btn = e.currentTarget;
  const botId = (inbox.selected && inbox.chats.get(inbox.selected)?.botId) || inboxEnabledIds()[0] || inbox.bots[0]?.botId;
  if (!botId) return toast("還沒讀到官方帳號，請稍候再試", "warn", 3000);
  btn.disabled = true;
  try {
    const result = await saveLineCookie(botId);
    if (result.cancelled) return;
    toast(lineAuthDoneText(result), "ok", 4000);
    inbox.linkProbed.clear();
    const first = !inbox.started;
    renderInboxGate(); // 第一次授權：這裡才開始連線、讀對話、抓訂單狀態
    renderInboxHeader();
    if (first) return;
    for (const id of inboxEnabledIds()) inboxLoadBoard(id);
    for (const c of inbox.chats.values()) inboxQueueLink(c);
    const sel = inbox.selected && inbox.chats.get(inbox.selected);
    if (sel) inboxLoadOrders(sel);
  } catch (err) {
    toast(err.message || "身份授權失敗", "err", 6000);
  } finally {
    btn.disabled = false;
    renderInboxHeader();
  }
}
function renderInboxRail() {
  const host = inbox.el.rail;
  if (!host) return;
  const q = (inbox.el.search?.value || "").trim().toLowerCase();
  host.textContent = "";
  for (const b of inbox.bots) {
    if (q && !b.name.toLowerCase().includes(q) && !getPrefixForGid(b.botId).toLowerCase().includes(q)) continue;
    const on = inbox.enabled.has(b.botId);
    const c = inbox.conns.get(b.botId);
    const status = on ? (c?.status || "connecting") : "off";
    const label = { live: "連線中", connecting: "連線中…", limit: c?.error || "連線數已滿", error: c?.error ? `重連中：${c.error}` : "重連中", off: "已關閉" }[status] || status;
    let unread = 0;
    if (on) { for (const ch of inbox.chats.values()) if (ch.botId === b.botId && ch.unread) unread++; }
    else unread = b.unreadCount;
    const avatar = b.iconUrl
      ? ih("img", { class: "loe-inbox-oa-avatar", src: b.iconUrl, alt: "" })
      : ih("span", { class: "loe-inbox-oa-avatar", text: b.name.slice(0, 1) });
    avatar.style.background = b.color;
    host.append(ih("div", { class: "loe-inbox-oa" + (on ? " on" : "") },
      avatar,
      ih("div", { class: "loe-inbox-oa-main" },
        ih("div", { class: "loe-inbox-oa-name" },
          ih("span", { class: "loe-inbox-oa-title", text: b.name, title: b.name }),
          getPrefixForGid(b.botId) ? ih("span", { class: "loe-inbox-tag group", text: inboxGroupLabel(getPrefixForGid(b.botId)) || getPrefixForGid(b.botId), title: `此帳號的派單預設群編：${getPrefixForGid(b.botId)}` }) : null,
        ),
        ih("div", { class: `loe-inbox-oa-status ${status}` },
          ih("span", { class: "loe-inbox-dot" }), ih("span", { text: label }),
          aiBots.get(b.botId) === true ? ih("span", { class: "loe-inbox-tag ai", text: "AI", title: "這個官方帳號有 AI 客服；對話標題列可切換 AI處理／轉人工" }) : null,
        ),
      ),
      unread > 0 ? ih("span", { class: "loe-inbox-badge", text: String(unread), title: on ? "未讀對話" : "LINE 回報的未讀數" }) : null,
      ih("button", {
        type: "button", class: "loe-inbox-switch", role: "switch", "aria-checked": on ? "true" : "false", "aria-label": `監聽 ${b.name}`,
        onclick: () => inboxSetEnabled(b.botId, !on),
      }, ih("span", { class: "loe-inbox-knob" })),
    ));
  }
  if (!inbox.bots.length) host.append(ih("div", { class: "loe-inbox-empty", text: "讀取官方帳號中…" }));
  if (inbox.el.foot) {
    inbox.el.foot.textContent = "";
    const ago = inbox.lastEventAt ? `${Math.max(0, Math.round((Date.now() - inbox.lastEventAt) / 1000))} 秒前` : "尚無";
    inbox.el.foot.append(
      ih("div", {}, "監聽中 ", ih("strong", { text: String([...inbox.conns.values()].filter((c) => c.es).length) }), " 個帳號"),
      ih("div", {}, "最後事件 ", ih("strong", { text: ago })),
    );
  }
}
// 左欄「官方帳號」收起／展開：只改版面，監聽與通知照常；記在本機，預設展開
function inboxApplyRail() {
  inbox.el.railAside?.classList.toggle("collapsed", inbox.railCollapsed);
}
function inboxToggleRail() {
  inbox.railCollapsed = !inbox.railCollapsed;
  storeSet(INBOX_RAIL_COLLAPSED_KEY, inbox.railCollapsed);
  inboxApplyRail();
}
// orderFilter：依訂單狀態篩選（預設目前選的；算各狀態數量時帶別的欄位）
function inboxVisibleChats(orderFilter = inbox.orderFilter) {
  const f = inbox.filter;
  const q = (inbox.el.listSearch?.value || "").trim().toLowerCase();
  const overrides = q ? getChatOverrides() : {};
  const groupOf = (c) => (overrides[c.key] && overrides[c.key].group) || getPrefixForGid(c.botId);
  const hit = (c) => !q || [c.name, c.preview, inboxBotName(c.botId), groupOf(c)].some((v) => String(v || "").toLowerCase().includes(q));
  return [...inbox.chats.values()]
    .filter((c) => inbox.enabled.has(c.botId) && hit(c))
    .filter((c) => {
      if (f === "unread") return c.unread;
      if (f === "unassigned") return !c.assignedBizId;
      if (f === "mine") return inbox.me && c.assignedBizId === inbox.me.bizId;
      return true;
    })
    .filter((c) => !orderFilter || inboxChatColumns(c).includes(orderFilter))
    .sort((a, b) => b.at - a.at);
}
// 客人頭像：LINE 的 preview 圖；沒有或載入失敗就退回名字第一個字
function inboxAvatar(chat) {
  const fallback = ih("span", { class: "loe-inbox-avatar", text: inboxInitial(chat.name) });
  if (!chat.avatarUrl) return fallback;
  const img = ih("img", { class: "loe-inbox-avatar", src: chat.avatarUrl, alt: "", loading: "lazy" });
  img.addEventListener("error", () => img.replaceWith(fallback), { once: true });
  return img;
}

export { inboxApplyRail, inboxAvatar, inboxRenderAll, inboxToggleRail, inboxVisibleChats, renderInboxGate, renderInboxHeader, renderInboxRail };
