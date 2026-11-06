// 對話內訊息搜尋（同 LINE 聊天室右上「搜尋」）：輸入框下方「搜尋」鈕打開訊息區上方的搜尋列，
// GET …/chats/{chat}/messages/search?query=…&limit=20（有 next 可再抓），結果下拉列出誰、片段、時間；
// 點一筆或按上下鍵跳到那則（不在已載入的訊息裡就用 ?backward= 往前翻頁找），關鍵字標黃。
import { inboxPreview } from "./chats.js";
import { ih, inbox, inboxApi, inboxBotName, inboxTime } from "./core.js";
import { inboxSelectedChat } from "./send.js";
import { renderInboxThread } from "./thread.js";

const MSEARCH_LIMIT = 20;
const MSEARCH_MAX_PAGES = 40; // 往前翻最多 40 頁（2000 則）找不到就放棄
const ms = { open: false, chatKey: "", query: "", list: [], total: 0, next: "", idx: -1, busy: false, error: "" };

function toggleInboxSearch() { if (ms.open) closeInboxSearch(); else openInboxSearch(); }
function openInboxSearch() {
  const chat = inboxSelectedChat();
  if (!chat || !inbox.el.msearch) return;
  Object.assign(ms, { open: true, chatKey: chat.key, query: "", list: [], total: 0, next: "", idx: -1, busy: false, error: "" });
  inbox.el.msearch.hidden = false;
  inbox.el.msearchInput.value = "";
  renderInboxSearch();
  inbox.el.msearchInput.focus();
}
function closeInboxSearch() {
  if (!ms.open) return;
  ms.open = false; ms.list = []; ms.idx = -1;
  if (inbox.el.msearch) inbox.el.msearch.hidden = true;
  clearInboxHits();
}
async function inboxSearchRun(query, more = false) {
  const chat = inboxSelectedChat();
  query = String(query || "").trim();
  if (!chat || !query || ms.busy) return;
  if (!more) { ms.query = query; ms.list = []; ms.total = 0; ms.next = ""; ms.idx = -1; clearInboxHits(); }
  ms.busy = true; ms.error = ""; renderInboxSearch();
  try {
    const q = new URLSearchParams({ query, limit: String(MSEARCH_LIMIT) });
    if (more && ms.next) q.set("next", ms.next);
    const data = await inboxApi("GET", `/api/v2/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/messages/search?${q}`);
    if (!ms.open || ms.query !== query) return;
    ms.list = ms.list.concat((data?.list || []).filter((m) => m?.message?.id));
    ms.total = Number(data?.total) || ms.list.length;
    ms.next = data?.next || "";
  } catch (e) { ms.error = e.message || String(e); }
  ms.busy = false;
  renderInboxSearch();
}
// 跳到第 i 筆（0＝最新）：不在已載入的串裡就往前翻頁，找到後重畫、捲到那則、標黃
async function inboxSearchGo(i) {
  const chat = inboxSelectedChat();
  const hit = ms.list[i];
  if (!chat || !hit || ms.busy) return;
  ms.idx = i; renderInboxSearch();
  const id = hit.message.id;
  const th = inbox.threads.get(chat.key);
  if (!th) return;
  if (!th.list.some((m) => m.message?.id === id)) {
    ms.busy = true; renderInboxSearch();
    try {
      for (let page = 0; page < MSEARCH_MAX_PAGES && th.backward; page++) {
        const data = await inboxApi("GET", `/api/v3/bots/${chat.botId}/chats/${encodeURIComponent(chat.chatId)}/messages?backward=${encodeURIComponent(th.backward)}`);
        if (!ms.open || inbox.threads.get(chat.key) !== th) return;
        const have = new Set(th.list.map((m) => m.message?.id).filter(Boolean));
        const older = (data?.list || []).filter((m) => m && (m.type === "message" || m.type === "messageSent") && !have.has(m.message?.id)).reverse();
        th.list = older.concat(th.list);
        th.backward = data?.backward || "";
        if (older.some((m) => m.message?.id === id)) break;
      }
    } catch (e) { ms.error = e.message || String(e); }
    ms.busy = false;
    renderInboxThread(); // 重畫後再標
  }
  renderInboxSearch();
  requestAnimationFrame(() => { if (!inboxSearchApplyHit()) { ms.error = "這則訊息已不在可載入的範圍"; renderInboxSearch(); } });
}
// 把目前這筆標黃並捲到中間；訊息串重畫（新訊息進來）後也要再做一次，不然會跳回最底
function inboxSearchApplyHit() {
  const hit = ms.open && ms.idx >= 0 ? ms.list[ms.idx] : null;
  if (!hit || !inbox.el.thMsgs) return false;
  clearInboxHits();
  const el = inbox.el.thMsgs.querySelector(`.loe-inbox-msg[data-id="${hit.message.id}"]`);
  if (!el) return false;
  el.classList.add("hit");
  markInboxText(el.querySelector(".loe-inbox-bubble"), ms.query);
  el.scrollIntoView({ block: "center" });
  return true;
}
// renderInboxThread 畫完呼叫：搜尋定位中就留在那則
function inboxSearchAfterRender() {
  if (ms.open && ms.idx >= 0 && inbox.selected === ms.chatKey) inboxSearchApplyHit();
}
function clearInboxHits() {
  const host = inbox.el.thMsgs;
  if (!host) return;
  host.querySelectorAll(".loe-inbox-msg.hit").forEach((el) => el.classList.remove("hit"));
  host.querySelectorAll("mark.loe-hit").forEach((mk) => mk.replaceWith(document.createTextNode(mk.textContent)));
}
// 把節點裡文字中的關鍵字包成 <mark>（不分大小寫）
function markInboxText(root, query) {
  if (!root || !query) return;
  const q = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.toLowerCase().includes(q)) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue, lower = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let last = 0, at;
    while ((at = lower.indexOf(q, last)) !== -1) {
      if (at > last) frag.append(text.slice(last, at));
      frag.append(ih("mark", { class: "loe-hit", text: text.slice(at, at + q.length) }));
      last = at + q.length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}
// 片段：關鍵字標粗（下拉列表用）
function snippetNodes(text, query) {
  const span = ih("span", { class: "loe-inbox-msearch-snippet", text });
  markInboxText(span, query);
  return span;
}
function renderInboxSearch() {
  const { msearchCount, msearchPrev, msearchNext, msearchList } = inbox.el;
  if (!msearchList) return;
  const chat = inboxSelectedChat();
  msearchCount.textContent = ms.busy ? "…" : ms.query ? (ms.idx >= 0 ? `${ms.idx + 1} / ${ms.total}` : String(ms.total)) : "";
  msearchPrev.disabled = ms.busy || ms.idx < 0 || ms.idx >= ms.list.length - 1; // ▲ 更舊
  msearchNext.disabled = ms.busy || ms.idx <= 0; // ▼ 更新
  msearchList.textContent = "";
  msearchList.hidden = !ms.query || (ms.idx >= 0 && !ms.error); // 跳過去後收起列表，再按 Enter／點輸入框會再開
  if (msearchList.hidden) return;
  if (ms.error) msearchList.append(ih("div", { class: "loe-inbox-empty err", text: ms.error }));
  else if (!ms.busy && !ms.list.length) msearchList.append(ih("div", { class: "loe-inbox-empty", text: "沒有符合的訊息" }));
  ms.list.forEach((item, i) => {
    const who = item.type === "messageSent" ? inboxBotName(item.source?.userId || chat?.botId) : (chat?.name || "");
    msearchList.append(ih("button", { type: "button", class: "loe-inbox-msearch-item" + (i === ms.idx ? " on" : ""), onclick: () => inboxSearchGo(i) },
      ih("span", { class: "loe-inbox-msearch-who" }, ih("strong", { text: who }), ih("span", { text: inboxTime(item.timestamp) })),
      snippetNodes(inboxPreview(item) || "[訊息]", ms.query)));
  });
  if (ms.next) msearchList.append(ih("button", { type: "button", class: "loe-inbox-btn", text: ms.busy ? "讀取中…" : `載入更多（還有 ${Math.max(0, ms.total - ms.list.length)} 筆）`, disabled: ms.busy, onclick: () => inboxSearchRun(ms.query, true) }));
}
function initInboxSearch() {
  const { msearchInput, msearchPrev, msearchNext, msearchClose } = inbox.el;
  if (!msearchInput) return;
  msearchInput.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    if (e.key === "Enter") { e.preventDefault(); const q = msearchInput.value.trim(); if (q && q === ms.query && ms.list.length) { ms.idx = -1; renderInboxSearch(); } else inboxSearchRun(q); }
    else if (e.key === "Escape") { e.preventDefault(); closeInboxSearch(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); inboxSearchGo(ms.idx + 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); inboxSearchGo(ms.idx - 1); }
  });
  msearchInput.addEventListener("focus", () => { if (ms.query && ms.list.length) { ms.idx = -1; renderInboxSearch(); } }); // 回到輸入框就再展開結果列表
  msearchPrev.addEventListener("click", () => inboxSearchGo(ms.idx + 1));
  msearchNext.addEventListener("click", () => inboxSearchGo(ms.idx - 1));
  msearchClose.addEventListener("click", closeInboxSearch);
}

export { closeInboxSearch, inboxSearchAfterRender, initInboxSearch, toggleInboxSearch };
