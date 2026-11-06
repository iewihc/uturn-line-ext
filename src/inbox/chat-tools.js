// 收件匣對話的工具：待處理／處理完畢／釘選、改暱稱、記事本、標為已讀。
import { renderInboxSide } from "./side.js";
import { ic } from "../core/icons.js";
import { pageContext } from "../core/page-context.js";
import { storeSet } from "../core/store.js";
import { INBOX_NOTES_FONT, INBOX_NOTES_FONT_KEY, ih, inbox, inboxApi, inboxChatUrl, inboxTime } from "./core.js";
import { inboxDismissToast } from "./notify.js";
import { inboxRenderAll } from "./shell.js";
import { renderInboxThread } from "./thread.js";
import { firstText, toEpochMs } from "../line/sync.js";
import { toast } from "../ui/toast.js";
import { toggleInboxSearch } from "./msearch.js";

// 派單後「標記待處理」：LINE 的 followUp API（LINE 頁面是點它自己的按鈕）
async function inboxFollowUp() {
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  if (chat) await inboxSetChatFlag(chat, "followUp", true);
}
// LINE 的對話狀態（同 LINE 聊天室頂端那兩顆與「⋯」選單的釘選）：PUT／DELETE …/followUp（待處理）、…/done（處理完畢）、…/pin（釘選）
const INBOX_FLAG_LABEL = { followUp: "待處理", done: "處理完畢", pin: "釘選" };
async function inboxSetChatFlag(chat, flag, on) {
  if (inbox.flagBusy) return;
  inbox.flagBusy = chat.key;
  inboxRenderAll(); // 兩處按鈕（下方與標題列）一起變灰
  try {
    await inboxApi(on ? "PUT" : "DELETE", `/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/${flag}`, on ? {} : undefined);
    if (flag === "followUp") chat.followedUp = on; else if (flag === "done") chat.done = on; else chat.pinnedAt = on ? Date.now() : 0;
  } catch (e) { toast(`${on ? "設為" : "取消"}「${INBOX_FLAG_LABEL[flag]}」失敗：${e.message}`, "err", 3000); }
  inbox.flagBusy = "";
  inboxRenderAll();
}
// 對話狀態開關鈕（待處理／處理完畢在輸入框下方，釘選在對話標題列「標為已讀」旁）
const INBOX_FLAG_ON = { followUp: (c) => !!c.followedUp, done: (c) => !!c.done, pin: (c) => !!c.pinnedAt };
function inboxFlagButton(chat, flag, icon) {
  const on = INBOX_FLAG_ON[flag](chat);
  return ih("button", {
    type: "button", class: "loe-inbox-btn loe-inbox-flag" + (on ? " on" : ""), html: ic(icon), disabled: inbox.flagBusy === chat.key, "aria-pressed": on ? "true" : "false",
    title: on ? `取消「${INBOX_FLAG_LABEL[flag]}」` : flag === "pin" ? "釘選：這位客人固定在清單最上面（同 LINE 聊天室）" : `設為「${INBOX_FLAG_LABEL[flag]}」（同 LINE 聊天室的對話狀態）`,
    onclick: () => inboxSetChatFlag(chat, flag, !on),
  }, ih("span", { text: INBOX_FLAG_LABEL[flag] }));
}
// 輸入框下方右側：待處理／處理完畢（LINE 的對話狀態）＋搜尋訊息＋開啟官方
function renderInboxToolsRight(chat) {
  const host = inbox.el.toolsRight;
  if (!host) return;
  host.textContent = "";
  if (!chat) return;
  host.append(
    inboxFlagButton(chat, "followUp", "message-circle"),
    inboxFlagButton(chat, "done", "circle-check"),
    ih("button", { type: "button", class: "loe-inbox-btn", html: ic("search"), title: "搜尋這位客人的訊息（同 LINE 聊天室的搜尋）", onclick: toggleInboxSearch }, ih("span", { text: "搜尋" })),
    ih("a", { class: "loe-inbox-btn", href: inboxChatUrl(chat), target: "_blank", rel: "noopener", html: ic("external-link"), title: "在 LINE 官方聊天室開啟這位客人（新分頁）" }, ih("span", { text: "開啟官方" })));
}
// 改客人暱稱：LINE 的 nickname API；空字串＝清掉暱稱、恢復顯示原名
async function inboxRename(chat, nickname) {
  nickname = String(nickname || "").trim();
  await inboxApi("PUT", `/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/nickname`, { nickname });
  chat.nickname = nickname;
  chat.name = nickname || chat.lineName || "（未提供名稱）";
  if (pageContext && pageContext.botId === chat.botId && pageContext.chatId === chat.chatId) pageContext.customerName = chat.name;
  toast(nickname ? `已改為「${nickname}」` : "已清除暱稱，顯示 LINE 原名", "ok");
  inboxRenderAll();
}
async function inboxOwnerNames(botId) {
  let map = inbox.owners.get(botId);
  if (map) return map;
  map = new Map();
  try {
    const data = await inboxApi("GET", `/api/v1/bots/${botId}/owners`);
    for (const o of data?.list || []) if (o && typeof o.bizId === "string") map.set(o.bizId, firstText([o.name]));
  } catch (_) {}
  inbox.owners.set(botId, map);
  return map;
}
// 記事本：GET notes（20 則一頁，next 游標）；新增 POST { body }；刪除 DELETE /notes/{noteId}
async function inboxLoadNotes(chat, more = false) {
  const key = chat.key;
  let st = inbox.notes.get(key);
  if (!st) { st = { list: [], total: 0, next: "", loading: false, error: "" }; inbox.notes.set(key, st); }
  if (st.loading) return;
  st.loading = true; st.error = "";
  renderInboxNotes();
  try {
    const url = new URL(`/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/notes`, location.origin);
    url.searchParams.set("limit", "20"); url.searchParams.set("withTotal", "true");
    if (more && st.next) url.searchParams.set("next", st.next);
    const data = await inboxApi("GET", url.pathname + url.search);
    const list = (data?.list || []).filter((n) => n && typeof n.noteId === "string");
    st.list = more ? st.list.concat(list) : list;
    st.total = Number.isInteger(data?.total) ? data.total : st.list.length;
    st.next = typeof data?.next === "string" ? data.next : "";
    await inboxOwnerNames(chat.botId);
  } catch (e) { st.error = e.message; }
  st.loading = false;
  renderInboxNotes();
  renderInboxThread();
}
async function inboxAddNote(chat, body) {
  body = String(body || "").trim();
  if (!body) return false;
  await inboxApi("POST", `/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/notes`, { body });
  toast("已新增筆記", "ok");
  await inboxLoadNotes(chat);
  return true;
}
async function inboxDeleteNote(chat, noteId) {
  await inboxApi("DELETE", `/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/notes/${encodeURIComponent(noteId)}`);
  toast("已刪除筆記", "ok");
  await inboxLoadNotes(chat);
}
function renderInboxNotes() {
  const host = inbox.el.notes;
  if (!host) return;
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  host.hidden = !inbox.notesOpen || !chat;
  renderInboxSide();
  if (host.hidden) return;
  host.textContent = "";
  const st = inbox.notes.get(chat.key);
  const owners = inbox.owners.get(chat.botId) || new Map();
  const collapsed = inbox.notesCollapsed;
  const toggle = () => { inbox.notesCollapsed = !collapsed; renderInboxNotes(); };
  // 文字大小：A−／A+ 一次 1px、點數字回預設；有些客人筆記很多，可以縮小看更多或放大看清楚
  const font = inbox.notesFont || INBOX_NOTES_FONT.def;
  host.style.setProperty("--loe-notes-font", `${font}px`);
  const setFont = (px) => { inbox.notesFont = px === INBOX_NOTES_FONT.def ? 0 : px; storeSet(INBOX_NOTES_FONT_KEY, inbox.notesFont); renderInboxNotes(); };
  const fontBtn = (label, px, title) => ih("button", { type: "button", class: "loe-inbox-notes-zoom", text: label, title, disabled: px < INBOX_NOTES_FONT.min || px > INBOX_NOTES_FONT.max, onclick: () => setFont(px) });
  // 標題列點一下收起／展開（固定開啟也能收）；固定開啟時不能關，只能收
  host.append(ih("div", { class: "loe-inbox-notes-head" },
    ih("button", { type: "button", class: "loe-inbox-x", html: ic(collapsed ? "chevron-right" : "chevron-down"), "aria-expanded": collapsed ? "false" : "true",
      "aria-label": collapsed ? "展開記事本" : "收起記事本", onclick: toggle }),
    ih("strong", { class: "loe-inbox-notes-title", text: `記事本 ${st ? st.total : ""}`, onclick: toggle }),
    ih("span", { class: "loe-inbox-muted", text: "客人看不到" }),
    ih("span", { class: "loe-inbox-spacer" }),
    collapsed ? null : ih("span", { class: "loe-inbox-notes-zoom-wrap", title: "記事本文字大小" },
      fontBtn("A−", font - INBOX_NOTES_FONT.step, "縮小文字"),
      ih("button", { type: "button", class: "loe-inbox-notes-zoom num", text: `${font}`, title: "點一下回到預設大小", onclick: () => setFont(INBOX_NOTES_FONT.def) }),
      fontBtn("A+", font + INBOX_NOTES_FONT.step, "放大文字")),
    inbox.pinNotes ? null : ih("button", { type: "button", class: "loe-inbox-x", "aria-label": "關閉記事本", html: ic("x"), onclick: () => { inbox.notesOpen = false; renderInboxNotes(); renderInboxThread(); } }),
  ));
  if (collapsed) return;
  const ta = ih("textarea", { class: "loe-inbox-note-input", rows: "3", placeholder: "新增筆記（客人看不到，只有客服看得到）", "aria-label": "新增筆記" });
  const addBtn = ih("button", { type: "button", class: "loe-inbox-btn primary", text: "新增筆記", onclick: async () => {
    addBtn.disabled = true;
    try { if (await inboxAddNote(chat, ta.value)) ta.value = ""; } catch (e) { toast("新增筆記失敗：" + e.message, "err", 4000); }
    addBtn.disabled = false;
  } });
  host.append(ih("div", { class: "loe-inbox-note-add" }, ta, addBtn));
  const list = ih("div", { class: "loe-inbox-notes-list" });
  if (!st || (st.loading && !st.list.length)) list.append(ih("div", { class: "loe-inbox-empty", text: "讀取中…" }));
  else if (st.error) list.append(ih("div", { class: "loe-inbox-empty err", text: "讀取失敗：" + st.error }));
  else if (!st.list.length) list.append(ih("div", { class: "loe-inbox-empty", text: "還沒有筆記" }));
  for (const n of st?.list || []) {
    const del = ih("button", { type: "button", class: "loe-inbox-note-del", text: "刪除", onclick: async () => {
      if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "確定刪除？"; setTimeout(() => { del.dataset.armed = ""; del.textContent = "刪除"; }, 4000); return; }
      del.disabled = true;
      try { await inboxDeleteNote(chat, n.noteId); } catch (e) { toast("刪除筆記失敗：" + e.message, "err", 4000); del.disabled = false; }
    } });
    list.append(ih("div", { class: "loe-inbox-note" },
      ih("div", { class: "loe-inbox-note-body", text: firstText([n.body, n.text]) }),
      ih("div", { class: "loe-inbox-note-meta" },
        ih("span", { text: `${owners.get(n.userBizId) || "客服"} · ${inboxTime(toEpochMs(n.updatedAt || n.createdAt))}` }),
        ih("span", { class: "loe-inbox-spacer" }), del),
    ));
  }
  if (st && st.next) list.append(ih("button", { type: "button", class: "loe-inbox-btn", text: st.loading ? "讀取中…" : "載入更多", disabled: st.loading, onclick: () => inboxLoadNotes(chat, true) }));
  host.append(list);
}
async function inboxMarkRead(chat) {
  chat.unread = false; chat.unreadCount = 0;
  inboxDismissToast(chat.key);
  inboxRenderAll();
  try { await inboxApi("PUT", `/api/v2/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/markAsRead`, {}); }
  catch (e) { toast("標記已讀失敗：" + e.message, "err", 3000); }
}

export { inboxFlagButton, inboxFollowUp, inboxLoadNotes, inboxMarkRead, inboxRename, renderInboxNotes, renderInboxToolsRight };
