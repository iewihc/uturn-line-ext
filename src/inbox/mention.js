// 收件匣群組「@標記」：輸入框打 @ 跳出成員清單（All＋成員，可打字篩選、↑↓ Enter 選），選了插入「@名字」；
// 送出時 inboxTextMessage 把「@名字」換成 textV2 的 {mention_i}＋substitution { type:"mention", mentionee:{ type:"user"|"all", userId } }
// （同 LINE 自家前端）。成員清單：GET /api/v1/bots/{bot}/chats/{群組}/members → { list:[{ userId, name, iconHash }] }，每個群組抓一次快取。
import { ic } from "../core/icons.js";
import { ih, inbox, inboxApi, inboxKey } from "./core.js";
import { inboxSelectedChat } from "./send.js";

const MENTION_ALL = { userId: "", name: "All", type: "all" };
const ms = { open: false, query: "", start: -1, index: 0, items: [] }; // start：輸入框裡 @ 的位置

const inboxIsGroup = (chat) => !!chat && (chat.chatType === "GROUP" || chat.chatType === "ROOM" || /^[CR]/.test(chat.chatId || ""));

async function inboxLoadMembers(chat) {
  const key = chat.key;
  let st = inbox.members.get(key);
  if (st) return st;
  st = { list: [], loading: true, error: "" };
  inbox.members.set(key, st);
  try {
    const r = await inboxApi("GET", `/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/members`);
    st.list = (r?.list || []).filter((m) => m && m.userId && m.name).map((m) => ({ userId: m.userId, name: String(m.name), lineName: String(m.name), type: "user" }));
  } catch (e) { st.error = e.message; }
  st.loading = false;
  if (ms.open && inbox.selected === key) renderInboxMention();
  // 成員 API 只給 LINE 原名；客服改過的暱稱在各自的一對一對話上，逐位查（已載入的直接用、沒有的抓一次），查到就改顯示暱稱
  inboxResolveMemberNicknames(chat, st).catch(() => {});
  return st;
}
async function inboxResolveMemberNicknames(chat, st) {
  let changed = false;
  await Promise.all(st.list.map(async (m) => {
    const loaded = inbox.chats.get(inboxKey(chat.botId, m.userId));
    let nick = loaded ? loaded.nickname : "";
    if (!loaded) {
      try {
        const item = await inboxApi("GET", `/api/v1/bots/${chat.botId}/chats/${encodeURIComponent(m.userId)}`);
        nick = String(item?.profile?.nickname || item?.nickname || "");
      } catch (_) { nick = ""; }
    }
    if (nick && nick !== m.name) { m.nickname = nick; m.name = nick; changed = true; }
  }));
  if (changed && ms.open && inbox.selected === chat.key) renderInboxMention();
}
// 這個群組認得的成員（含 All）：送出時把「@名字」對回 userId；有暱稱的，暱稱和原名都認
function inboxMentionTargets(chat) {
  const st = chat && inbox.members.get(chat.key);
  const out = [MENTION_ALL];
  for (const m of st?.list || []) {
    out.push(m);
    if (m.nickname && m.lineName && m.lineName !== m.nickname) out.push({ ...m, name: m.lineName });
  }
  return out;
}

function closeInboxMention() {
  ms.open = false; ms.items = [];
  const host = inbox.el.mention;
  if (host) { host.hidden = true; host.textContent = ""; }
}
// 輸入框內容改了：游標前有「@文字」且是群組就開清單
function inboxMentionOnInput() {
  const chat = inboxSelectedChat();
  const ta = inbox.el.textarea;
  if (!chat || !ta || !inboxIsGroup(chat)) return closeInboxMention();
  const before = ta.value.slice(0, ta.selectionStart ?? ta.value.length);
  const m = /(?:^|\s)@([^\s@]*)$/.exec(before);
  if (!m) return closeInboxMention();
  ms.open = true; ms.query = m[1]; ms.start = before.length - m[0].length + (m[0].startsWith("@") ? 0 : 1); ms.index = 0;
  inboxLoadMembers(chat);
  renderInboxMention();
}
function renderInboxMention() {
  const host = inbox.el.mention;
  if (!host) return;
  host.textContent = "";
  host.hidden = !ms.open;
  if (!ms.open) return;
  const chat = inboxSelectedChat();
  const st = chat && inbox.members.get(chat.key);
  const q = ms.query.toLowerCase();
  const seen = new Set();
  ms.items = inboxMentionTargets(chat).filter((m) => (!q || m.name.toLowerCase().includes(q) || (m.lineName || "").toLowerCase().includes(q)) && !seen.has(m.userId + m.type) && seen.add(m.userId + m.type)).slice(0, 30);
  if (ms.index >= ms.items.length) ms.index = 0;
  if (st?.loading && !ms.items.length) { host.append(ih("div", { class: "loe-inbox-mention-empty", text: "讀取成員中…" })); return; }
  if (!ms.items.length) { host.append(ih("div", { class: "loe-inbox-mention-empty", text: st?.error ? "讀不到成員：" + st.error : "沒有符合的成員" })); return; }
  host.append(ih("div", { class: "loe-inbox-mention-head" }, ih("span", { html: ic("message-circle") }), ih("span", { text: "標記成員（↑↓ 選、Enter 插入、Esc 關）" })));
  ms.items.forEach((m, i) => host.append(ih("button", { type: "button", class: "loe-inbox-mention-item" + (i === ms.index ? " on" : ""), onmousedown: (e) => e.preventDefault(), onclick: () => inboxMentionPick(i) },
    ih("span", { class: "loe-inbox-mention-at", text: "@" }), ih("span", { class: "loe-inbox-mention-name", text: m.name }),
    m.type === "all" ? ih("span", { class: "loe-inbox-muted", text: "所有人" }) : m.nickname && m.lineName !== m.name ? ih("span", { class: "loe-inbox-muted", text: m.lineName }) : null)));
}
// 把游標前的「@查詢」換成「@名字 」
function inboxMentionPick(i) {
  const m = ms.items[i];
  const ta = inbox.el.textarea;
  if (!m || !ta) return closeInboxMention();
  const caret = ta.selectionStart ?? ta.value.length;
  const token = `@${m.name} `;
  ta.value = ta.value.slice(0, ms.start) + token + ta.value.slice(caret);
  const pos = ms.start + token.length;
  ta.focus(); ta.setSelectionRange(pos, pos);
  closeInboxMention();
}
function inboxMentionOnKeydown(e) {
  if (!ms.open) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); if (ms.items.length) { ms.index = (ms.index + (e.key === "ArrowDown" ? 1 : ms.items.length - 1)) % ms.items.length; renderInboxMention(); } }
  else if ((e.key === "Enter" || e.key === "Tab") && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); if (ms.items.length) inboxMentionPick(ms.index); else closeInboxMention(); }
  else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeInboxMention(); }
}
function initInboxMention() {
  const ta = inbox.el.textarea;
  if (!ta) return;
  ta.addEventListener("input", inboxMentionOnInput);
  ta.addEventListener("keydown", inboxMentionOnKeydown); // 要在送出的 keydown 之前註冊（stopImmediatePropagation 才攔得住 Enter）
  ta.addEventListener("blur", () => setTimeout(closeInboxMention, 150));
  ta.addEventListener("click", inboxMentionOnInput);
}

export { closeInboxMention, initInboxMention, inboxIsGroup, inboxLoadMembers, inboxMentionTargets };
