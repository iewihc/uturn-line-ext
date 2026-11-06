// 收件匣右欄對話：訊息串、輸入框與工具列、貼圖面板、選擇內容視窗、通知卡片。
import { BUBBLE_CLASS, BUTTON_CLASS, FORWARD_BUTTON_CLASS, TEXT_PAD_CLASS } from "../core/constants.js";
import { COPY_ICON, FORWARD_ICON, ic } from "../core/icons.js";
import { openDispatchPopover } from "../dispatch.js";
import { inboxFlagButton, inboxLoadNotes, inboxMarkRead, inboxRename, renderInboxNotes, renderInboxToolsRight } from "./chat-tools.js";
import { inboxAssigneeLabel, inboxPreview } from "./chats.js";
import { inboxColToggleButton } from "./collapse.js";
import { INBOX_CONTENT_TABS, closeInboxContents, inboxLoadContents, inboxLoadPacks, inboxUseContent } from "./contents.js";
import { ih, inbox, inboxBotColor, inboxBotName, inboxChatUrl, inboxGroupLabel, inboxTime } from "./core.js";
import { inboxEmojiUrl, inboxMediaNode, inboxPackTabUrl, inboxStickerUrl, inboxTextNodes } from "./media.js";
import { inboxDismissAllToasts, inboxDismissToast } from "./notify.js";
import { inboxRelayControls } from "./relay.js";
import { inboxOpenDriverChatFor, renderInboxOrders } from "./orders.js";
import { inboxEmojiToken, inboxInsertAtCaret, inboxOpenChat, inboxSelectedChat, inboxSendSticker, inboxSetReply } from "./send.js";
import { inboxAvatar, renderInboxHeader } from "./shell.js";
import { GEAR_ICON, closePrefixPopover, openPrefixPopover } from "../prefix.js";
import { renderQuickBar } from "../quick-reply/bar.js";
import { getChatOverrides, getPrefix, getPrefixForGid } from "../settings.js";
import { copyText, flashCopied } from "../ui/copy.js";
import { toast } from "../ui/toast.js";
import { inboxSearchAfterRender } from "./msearch.js";

// 回覆（引用）：客人訊息下方的「回覆」鈕（LINE 給了 quoteToken 的才能引用）；官方自己送出的不給回覆
function inboxReplyButton(chat, m, out) {
  const msg = m.message;
  if (!msg?.id || !msg.quoteToken) return null; // 客人或自己送的都能回覆（LINE 允許引用自己的訊息）；沒 quoteToken 的（舊訊息、部分類型）不能
  return ih("button", { type: "button", class: "loe-relay-btn", text: "回覆", title: "回覆這則訊息（同 LINE 聊天室的「回覆」，對方會看到引用）",
    onclick: () => inboxSetReply({ id: msg.id, quoteToken: msg.quoteToken, text: inboxPreview(m) || "[訊息]", who: out ? inboxBotName(chat.botId) : chat.name }) });
}
// 泡泡裡的引用塊：被引用的那則在這串裡就顯示誰說了什麼
function inboxQuoteNode(chat, th, quotedId) {
  const src = th?.list.find((x) => x.message?.id === quotedId);
  const who = src ? (src.type === "messageSent" ? inboxBotName(chat.botId) : chat.name) : "";
  return ih("span", { class: "loe-inbox-quote" }, who ? ih("strong", { text: who }) : null, ih("span", { text: src ? (inboxPreview(src) || "[訊息]") : "（引用的訊息不在這裡）" }));
}
function renderInboxThread() {
  const { thHead, thMsgs, thComposer, thEmpty } = inbox.el;
  if (!thHead) return;
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  thHead.textContent = "";
  thMsgs.textContent = "";
  if (!chat) {
    thHead.hidden = true; thMsgs.hidden = true; thComposer.hidden = true; thEmpty.hidden = false;
    renderInboxNotes();
    renderInboxOrders();
    renderInboxPicker();
    renderInboxContents();
    return;
  }
  thHead.hidden = false; thMsgs.hidden = false; thComposer.hidden = false; thEmpty.hidden = true;
  // 選項「不顯示官方帳號名稱」且這個帳號有群編：標題列不放帳號名（群編在右邊那顆齒輪鈕上）
  const oaChip = inbox.hideOaName && getPrefix() ? null : ih("span", { class: "loe-inbox-oa-chip", text: inboxBotName(chat.botId), title: inboxBotName(chat.botId) });
  if (oaChip) oaChip.style.setProperty("--oa", inboxBotColor(chat.botId));
  const state = [inboxAssigneeLabel(chat), chat.pinnedAt ? "已釘選" : "", chat.followedUp ? "待處理" : "", chat.done ? "處理完畢" : "", `最後訊息 ${inboxTime(chat.at)}`].filter(Boolean).join(" · ");
  if (!inbox.el.aiSlot) { inbox.el.aiSlot = ih("span", { class: "loe-inbox-ai-slot" }); }
  if (!inbox.el.sysNotiSlot) { inbox.el.sysNotiSlot = ih("span", { class: "loe-inbox-ai-slot" }); }
  let title;
  if (inbox.renaming) {
    // 輸入框先帶目前顯示的名字（有暱稱就是暱稱，沒有就是 LINE 原名），從它改起；
    // 存的時候若跟原名一樣就當作沒有暱稱（不把原名當暱稱存進去）
    const input = ih("input", { class: "loe-inbox-rename", type: "text", value: chat.name, placeholder: chat.lineName || "暱稱", "aria-label": "客人暱稱", maxlength: "20" });
    const save = async () => {
      const next = input.value.trim();
      try { await inboxRename(chat, next === chat.lineName ? "" : next); inbox.renaming = false; }
      catch (e) { toast("改暱稱失敗：" + e.message, "err", 4000); }
      renderInboxThread();
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); save(); } if (e.key === "Escape") { inbox.renaming = false; renderInboxThread(); } });
    title = ih("div", { class: "loe-inbox-th-name" }, input,
      ih("button", { type: "button", class: "loe-inbox-btn primary", text: "儲存", onclick: save }),
      ih("button", { type: "button", class: "loe-inbox-btn", text: "取消", onclick: () => { inbox.renaming = false; renderInboxThread(); } }),
      oaChip);
    setTimeout(() => { input.focus(); input.select(); }, 0);
  } else {
    title = ih("div", { class: "loe-inbox-th-name" },
      ih("strong", { text: chat.name }),
      ih("button", { type: "button", class: "loe-inbox-x loe-inbox-rename-btn", html: ic("pencil"), "aria-label": "修改客人暱稱", title: chat.nickname ? `暱稱「${chat.nickname}」，LINE 原名「${chat.lineName}」（點擊修改）` : "修改客人暱稱（LINE 原名不會變）",
        onclick: () => { inbox.renaming = true; renderInboxThread(); } }),
      oaChip);
  }
  const notesCount = inbox.notes.get(chat.key)?.total;
  thHead.append(...[
    inboxAvatar(chat),
    ih("div", { class: "loe-inbox-th-title" },
      title,
      ih("div", { class: "loe-inbox-muted", text: (chat.nickname && chat.lineName ? `原名 ${chat.lineName} · ` : "") + state }),
    ),
    ih("div", { class: "loe-inbox-spacer" }),
    inbox.el.sysNotiSlot, // 系統自動通知（renderInboxOrders 填）
    ih("button", { type: "button", class: "loe-inbox-btn" + (inbox.notesOpen ? " on" : ""), html: ic("notebook"), "aria-pressed": inbox.notesOpen ? "true" : "false", title: "這位客人的 LINE 記事本（客人看不到）",
      onclick: () => { inbox.notesOpen = !inbox.notesOpen; inbox.notesCollapsed = false; if (inbox.notesOpen && !inbox.notes.has(chat.key)) inboxLoadNotes(chat); renderInboxNotes(); renderInboxThread(); } },
      ih("span", { text: "記事本" + (Number.isInteger(notesCount) ? ` ${notesCount}` : "") })),
    (() => {
      const prefix = getPrefix(); // pageContext 已指向這個帳號
      return ih("button", { type: "button", class: "loe-inbox-btn loe-inbox-prefix" + (prefix ? "" : " empty"), html: GEAR_ICON,
        title: prefix ? `此官方帳號的預設群編：${prefix}（點擊修改）` : "設定此官方帳號的預設群編",
        onclick: (e) => { e.stopPropagation(); if (openPrefixPopover._pop) closePrefixPopover(); else openPrefixPopover(e.currentTarget); } },
        ih("span", { text: inboxGroupLabel(prefix) || (prefix ? prefix : "設定群編") }));
    })(),
    inbox.el.aiSlot, // AI處理／轉人工（renderAiToggle 掛進來；沒有 AI 的帳號是空的）
    // 選項「開啟對話自動標已讀」勾了就會自動標，手動鈕不再顯示
    inbox.autoRead ? null : ih("button", { type: "button", class: "loe-inbox-btn", html: ic("check-check"), disabled: !chat.unread, onclick: () => inboxMarkRead(chat) }, ih("span", { text: "標為已讀" })),
    inboxFlagButton(chat, "pin", "pin"),
    inboxColToggleButton("thread"),
  ].filter(Boolean)); // 原生 append 會把 null 印成文字
  renderInboxToolsRight(chat);
  const th = inbox.threads.get(chat.key);
  if (!th || th.loading) thMsgs.append(ih("div", { class: "loe-inbox-empty", text: "讀取訊息中…" }));
  else if (th.error) thMsgs.append(ih("div", { class: "loe-inbox-empty err", text: "讀取失敗：" + th.error }));
  else if (!th.list.length) thMsgs.append(ih("div", { class: "loe-inbox-empty", text: "還沒有訊息" }));
  let lastDay = "";
  for (const m of th?.list || []) {
    const day = m.timestamp ? new Date(m.timestamp).toDateString() : "";
    if (day && day !== lastDay) {
      lastDay = day;
      const d = new Date(m.timestamp);
      thMsgs.append(ih("div", { class: "loe-inbox-day", text: d.toDateString() === new Date().toDateString() ? "今天" : `${d.getMonth() + 1}/${d.getDate()}` }));
    }
    const out = m.type === "messageSent";
    const meta = m.pending ? "傳送中…" : m.failed ? `傳送失敗：${m.error || ""}` : inboxTime(m.timestamp);
    const readMark = out && !m.pending && !m.failed && m.timestamp && m.timestamp <= (chat.userReadAt || 0) ? "已讀 · " : ""; // 客人已讀（同 LINE 聊天室）
    const text = inboxPreview(m) || "[訊息]";
    const isText = !!m.message && (m.message.type === "text" || m.message.type === "textV2" || m.message.type === "location");
    const mediaNode = inboxMediaNode(chat.botId, m);
    const withActions = isText && !m.pending && !m.failed;
    // 位置訊息：複製／派車用「名稱 地址」（沒有就經緯度），不是預覽的「[位置]」
    const loc = m.message?.type === "location" ? m.message : null;
    const actionText = loc ? ([loc.title, loc.address].filter(Boolean).join(" ") || `${loc.latitude},${loc.longitude}`) : text;
    // AI 客服回的是卡片（LINE 回成 text 但 originalType=flex；也涵蓋 template／imagemap／cardType），另一種樣式標示
    const orig = m.message && m.message.originalType;
    const isCard = out && !!(orig && orig !== "text" || (m.message && ["flex", "template", "imagemap", "cardType"].includes(m.message.type)));
    // 與 LINE 聊天室同一套：泡泡掛 BUBBLE_CLASS／TEXT_PAD_CLASS，右上角常駐「派單」「複製」
    const quote = m.message?.quotedMessageId ? inboxQuoteNode(chat, th, m.message.quotedMessageId) : null; // 這則是回覆（引用）哪一則
    // 位置訊息也是 media 泡泡，但要掛派車／複製（之前 media 一律不掛，位置就點不了）
    const bubble = mediaNode
      ? ih("div", { class: "loe-inbox-bubble media" + (withActions ? ` ${BUBBLE_CLASS} ${TEXT_PAD_CLASS} loe-has-forward` : "") }, quote, mediaNode)
      : ih("div", { class: "loe-inbox-bubble" + (withActions ? ` ${BUBBLE_CLASS} ${TEXT_PAD_CLASS} loe-has-forward` : "") },
        quote, isCard ? ih("span", { class: "loe-inbox-card-label", text: "AI 卡片回覆" }) : null, ...inboxTextNodes(m.message, text));
    if (withActions) {
      bubble.append(
        ih("button", { type: "button", class: FORWARD_BUTTON_CLASS, html: FORWARD_ICON, "aria-label": "帶入派車", "data-loe-tip": "派車",
          onclick: (e) => { e.stopPropagation(); openDispatchPopover(actionText); } }),
        ih("button", { type: "button", class: BUTTON_CLASS, html: COPY_ICON, "aria-label": "複製這則訊息", "data-loe-tip": "複製",
          onclick: async (e) => { e.stopPropagation(); const btn = e.currentTarget; try { flashCopied(btn, await copyText(actionText)); } catch (_) { flashCopied(btn, false); } } }),
      );
    }
    thMsgs.append(ih("div", { class: "loe-inbox-msg" + (out ? " out" : " in") + (m.failed ? " failed" : "") + (isCard ? " card" : ""), "data-id": m.message?.id || null },
      bubble,
      ih("div", { class: "loe-inbox-msg-meta" },
        out ? readMark + (isCard ? `AI 回覆 · ${meta}` : meta) : `${meta} · ${chat.name}`,
        m.pending || m.failed ? null : inboxReplyButton(chat, m, out),
        m.pending || m.failed ? null : inboxRelayControls(m)),
    ));
  }
  thMsgs.scrollTop = thMsgs.scrollHeight;
  inboxSearchAfterRender(); // 搜尋定位中：留在那則、重新標黃
  // 圖片載入後才撐開高度：還停在底部就跟著捲到底，最新的訊息（常是客人剛傳的圖）才不會被擠到下面看不到
  inbox.threadAtBottom = true;
  for (const img of thMsgs.querySelectorAll("img")) {
    if (!img.complete) img.addEventListener("load", () => { if (inbox.threadAtBottom) thMsgs.scrollTop = thMsgs.scrollHeight; }, { once: true });
  }
  renderInboxNotes();
  renderInboxOrders();
  // 換了對話才清輸入框，同一對話重繪時保留草稿
  if (thComposer.dataset.key !== chat.key) {
    thComposer.dataset.key = chat.key;
    inbox.el.textarea.value = "";
    inbox.emojiTokens.clear();
    inbox.picker = null;
    inbox.contents = null;
    renderQuickBar(inbox.el.quickBar, inboxInsertText);
    renderInboxPicker();
    renderInboxContents();
  }
}
/* ---- 貼圖／表情貼面板（跟 LINE 一樣夾在訊息串和輸入框之間；貼圖點了直接送，表情貼插進輸入框） ---- */
function renderInboxPicker() {
  const host = inbox.el.picker;
  if (!host) return;
  const chat = inboxSelectedChat();
  const p = inbox.picker;
  host.textContent = "";
  host.hidden = !p || !chat;
  inbox.el.tools?.querySelector('[data-tool="sticker"]')?.classList.toggle("on", !host.hidden);
  if (host.hidden) return;
  host.className = `loe-inbox-picker ${p.kind}`;
  const key = `${chat.botId}/${p.kind}`;
  if (!inbox.packs.has(key)) inboxLoadPacks(chat.botId, p.kind);
  const st = inbox.packs.get(key);
  const packs = st.list;
  if (!packs.some((x) => x.id === p.pkg)) p.pkg = packs[0]?.id || "";
  const pack = packs.find((x) => x.id === p.pkg);
  const isSticker = p.kind === "sticker";
  host.append(
    // 分頁列：貼圖包多時只有中間那段橫向捲動，✕ 固定在最右邊（之前 ✕ 跟著捲、欄窄就被推到看不見，面板關不掉）
    ih("div", { class: "loe-inbox-picker-tabs" },
      ih("div", { class: "loe-inbox-picker-scroll" },
        ...[["sticker", "貼圖"], ["emoji", "表情貼"]].map(([k, label]) => ih("button", { type: "button", class: "loe-inbox-picker-kind" + (p.kind === k ? " on" : ""), text: label,
          onclick: () => { inbox.picker = { kind: k, pkg: "" }; renderInboxPicker(); } })),
        ih("span", { class: "loe-inbox-picker-sep" }),
        ...packs.map((x) => ih("button", { type: "button", class: "loe-inbox-picker-tab" + (p.pkg === x.id ? " on" : ""), title: x.id,
          onclick: () => { p.pkg = x.id; renderInboxPicker(); } },
          ih("img", { src: inboxPackTabUrl(p.kind, x.id), alt: "", loading: "lazy" }))),
      ),
      ih("button", { type: "button", class: "loe-inbox-x loe-inbox-picker-close", "aria-label": "收起", title: "收起（Esc）", html: ic("x"), onclick: () => { inbox.picker = null; renderInboxPicker(); } }),
    ),
    ih("div", { class: "loe-inbox-picker-grid" },
      st.loading && !packs.length ? ih("div", { class: "loe-inbox-empty", text: "讀取中…" })
        : st.error ? ih("div", { class: "loe-inbox-empty err", text: "讀取失敗：" + st.error })
        : !pack ? ih("div", { class: "loe-inbox-empty", text: `這個官方帳號沒有可用的${isSticker ? "貼圖" : "表情貼"}` })
        : pack.items.map((id) => ih("button", { type: "button", title: isSticker ? "傳送這張貼圖" : "插入這個表情貼",
          onclick: () => { if (isSticker) inboxSendSticker(pack.id, id); else inboxInsertAtCaret(inboxEmojiToken(pack.id, id)); } },
          ih("img", { src: isSticker ? inboxStickerUrl(id) : inboxEmojiUrl(pack.id, id, true), alt: "", loading: "lazy" }))),
    ),
  );
}
/* ---- 選擇內容視窗 ---- */
function renderInboxContents() {
  const host = inbox.el.modal;
  if (!host) return;
  const chat = inboxSelectedChat();
  const c = inbox.contents;
  host.textContent = "";
  host.hidden = !c || !chat;
  if (host.hidden) return;
  const spec = INBOX_CONTENT_TABS[c.tab];
  const key = `${chat.botId}/${c.tab}`;
  if (!inbox.contentLists.has(key)) inboxLoadContents(chat.botId, c.tab);
  const st = inbox.contentLists.get(key);
  const body = ih("div", { class: "loe-inbox-modal-body" },
    ...st.list.map((x) => {
      const id = String(spec.id(x));
      const on = c.selected === id;
      return ih("button", { type: "button", class: "loe-inbox-content-item" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
        onclick: () => { c.selected = on ? null : id; renderInboxContents(); } },
        spec.img(x) ? ih("img", { src: spec.img(x), alt: "", loading: "lazy" }) : null,
        ih("div", { class: "loe-inbox-content-text" }, ih("strong", { text: spec.title(x) || "（未命名）" }), ih("div", { class: "desc", text: spec.desc(x) })));
    }),
    st.loading ? ih("div", { class: "loe-inbox-empty", text: "讀取中…" })
      : st.error ? ih("div", { class: "loe-inbox-empty err", text: "讀取失敗：" + st.error })
      : !st.list.length ? ih("div", { class: "loe-inbox-empty", text: `這個官方帳號還沒有${spec.label}` })
      : !st.done ? ih("button", { type: "button", class: "loe-inbox-btn loe-inbox-more", text: "載入更多", onclick: () => inboxLoadContents(chat.botId, c.tab, true) }) : null,
  );
  const item = st.list.find((x) => String(spec.id(x)) === c.selected);
  host.append(ih("div", { class: "loe-inbox-modal-box", role: "dialog", "aria-modal": "true", "aria-label": "選擇內容" },
    ih("div", { class: "loe-inbox-modal-head" },
      ih("span", { text: "選擇內容" }),
      ih("span", { class: "loe-inbox-muted", text: inboxBotName(chat.botId) }),
      ih("span", { class: "loe-inbox-spacer" }),
      ih("button", { type: "button", class: "loe-inbox-x", "aria-label": "關閉", html: ic("x"), onclick: closeInboxContents })),
    ih("div", { class: "loe-inbox-modal-tabs" },
      ...Object.entries(INBOX_CONTENT_TABS).map(([k, s]) => ih("button", { type: "button", class: "loe-inbox-modal-tab" + (c.tab === k ? " on" : ""), text: s.label,
        onclick: () => { c.tab = k; c.selected = null; renderInboxContents(); } }))),
    body,
    ih("div", { class: "loe-inbox-modal-foot" },
      ih("button", { type: "button", class: "loe-inbox-btn", text: "取消", onclick: closeInboxContents }),
      ih("button", { type: "button", class: "loe-inbox-btn primary", text: spec.action, disabled: !item, onclick: () => inboxUseContent(chat, c.tab, item) })),
  ));
}
function inboxInsertText(text) {
  const ta = inbox.el.textarea;
  if (!ta) return;
  const cur = ta.value;
  ta.value = cur && !/\n$/.test(cur) ? cur + "\n" + text : cur + text;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}
function renderInboxToasts() {
  const host = inbox.el.toasts;
  if (!host) return;
  host.textContent = "";
  const all = [...inbox.toasts.values()].sort((a, b) => (b.at || 0) - (a.at || 0)); // 最新在前
  // 右上角只露最新幾張沒縮回的；其餘（含縮回鈴鐺的）摺成一列
  const shown = inbox.notifOpen ? [] : all.filter((t) => !t.folded).slice(0, inbox.toastMax);
  for (const t of shown) { const card = inboxToastCard(t); if (card) host.append(card); }
  const rest = all.length - shown.length;
  if (rest > 0 && !inbox.notifOpen) {
    host.append(ih("div", { class: "loe-inbox-toast-fold" },
      ih("button", { type: "button", class: "loe-inbox-toast-fold-open", onclick: () => { inbox.notifOpen = true; renderInboxToasts(); } },
        ih("span", { html: ic("chevron-down") }), ih("span", { text: shown.length ? `還有 ${rest} 則，點開看全部` : `${rest} 則通知，點開看全部` })),
      ih("button", { type: "button", class: "loe-inbox-toast-fold-clear", text: "全部關閉", onclick: () => { inboxDismissAllToasts(); renderInboxToasts(); } }),
    ));
  }
  renderInboxNotifDrawer(all);
  renderInboxHeader(); // 鈴鐺數字
}
// 鈴鐺打開的通知清單：所有還沒處理的通知，最新在上；處理（在收件匣回覆／司機對話／×）才消失
function renderInboxNotifDrawer(all) {
  const host = inbox.el.notif;
  if (!host) return;
  host.textContent = "";
  host.hidden = !inbox.notifOpen;
  if (host.hidden) return;
  const body = inbox.el.body?.getBoundingClientRect();
  if (body) host.style.setProperty("--loe-notif-top", `${Math.round(body.top)}px`);
  host.append(ih("div", { class: "loe-inbox-notif-head" },
    ih("span", { html: ic("bell") }),
    ih("strong", { text: all.length ? `通知 ${all.length} 則` : "沒有新通知" }),
    ih("span", { class: "loe-inbox-spacer" }),
    all.length ? ih("button", { type: "button", class: "loe-inbox-btn", text: "全部關閉", onclick: () => { inboxDismissAllToasts(); renderInboxToasts(); } }) : null,
    ih("button", { type: "button", class: "loe-inbox-x", "aria-label": "關閉通知清單", html: ic("x"), onclick: () => { inbox.notifOpen = false; renderInboxToasts(); } }),
  ));
  const list = ih("div", { class: "loe-inbox-notif-list" });
  for (const t of all) { const card = inboxToastCard(t); if (card) list.append(card); }
  if (!all.length) list.append(ih("div", { class: "loe-inbox-empty", text: "客人或司機來訊會出現在這裡" }));
  host.append(list);
}
// 一張通知卡（右上角堆疊與鈴鐺清單共用）
function inboxToastCard(t) {
  if (t.kind === "driver") return inboxDriverToastCard(t);
  const chat = inbox.chats.get(t.key);
  if (!chat) return null;
  const chip = ih("span", { class: "loe-inbox-oa-chip", text: inboxBotName(chat.botId).slice(0, 8), title: inboxBotName(chat.botId) });
  chip.style.setProperty("--oa", inboxBotColor(chat.botId));
  // 群編標籤同對話列（店配覆寫優先，否則此帳號的預設前綴）；選項「不顯示官方帳號名稱」時只留群編
  const overrides = getChatOverrides();
  const group = (overrides[t.key] && overrides[t.key].group) || getPrefixForGid(chat.botId);
  const open = () => { inbox.notifOpen = false; inboxOpenChat(t.key); };
  const card = ih("div", { class: "loe-inbox-toast", role: "status" },
    ih("div", { class: "loe-inbox-toast-top" },
      inbox.hideOaName && group ? null : chip,
      group ? ih("span", { class: "loe-inbox-tag group", text: inboxGroupLabel(group) || group, title: `${inboxBotName(chat.botId)}・派單預設群編：${group}` }) : null,
      ih("strong", { class: "loe-inbox-row-name", text: chat.name, title: chat.name }),
      t.count > 1 ? ih("span", { class: "loe-inbox-badge", text: `${t.count} 則` }) : null,
      ih("span", { class: "loe-inbox-toast-time", text: inboxTime(t.at || Date.now()) }),
      ih("button", { type: "button", class: "loe-inbox-x", "aria-label": "關閉通知", html: ic("x"), onclick: () => { inboxDismissToast(t.key); renderInboxToasts(); } }),
    ),
    ih("div", { class: "loe-inbox-toast-body", text: t.lines.join("\n") }),
    ih("div", { class: "loe-inbox-toast-actions" },
      ih("button", { type: "button", class: "loe-inbox-btn primary", html: ic("message-circle"), onclick: open }, ih("span", { text: "在收件匣回覆" })),
      ih("a", { class: "loe-inbox-btn", href: inboxChatUrl(chat), target: "_blank", rel: "noopener", html: ic("external-link") }, ih("span", { text: "開官方" })),
    ),
    t.folded ? null : ih("span", { class: "loe-inbox-toast-timer" }),
  );
  card.style.borderLeftColor = inboxBotColor(chat.botId);
  return card;
}

// 司機對話通知卡：單號＋司機、最近幾則；「司機對話」開那位客人的對話並打開這一台的司機對話
function inboxDriverToastCard(t) {
  const chat = t.chatKey && inbox.chats.get(t.chatKey);
  const close = () => { inboxDismissToast(t.key); renderInboxToasts(); };
  // 兩列：第一列「司機」＋車號（長了用 … 縮，不再和客人名字擠同一行）；第二列單號、客人、幾則
  const card = ih("div", { class: "loe-inbox-toast driver", role: "status" },
    ih("div", { class: "loe-inbox-toast-top" },
      ih("span", { class: "loe-inbox-tag ord", text: "司機" }),
      ih("strong", { class: "loe-inbox-row-name", text: t.driverNo || "司機", title: t.driverNo || "" }),
      ih("span", { class: "loe-inbox-toast-time", text: inboxTime(t.at || Date.now()) }),
      ih("button", { type: "button", class: "loe-inbox-x", "aria-label": "關閉通知", html: ic("x"), onclick: close }),
    ),
    ih("div", { class: "loe-inbox-toast-sub" },
      t.shortId ? ih("span", { class: "loe-inbox-toast-order", text: t.shortId, title: "訂單" }) : null,
      chat ? ih("span", { class: "loe-inbox-toast-who", text: chat.name, title: chat.name }) : null,
      t.count > 1 ? ih("span", { class: "loe-inbox-badge", text: `${t.count} 則` }) : null,
    ),
    t.oriText ? ih("div", { class: "loe-inbox-toast-ori", text: t.oriText, title: t.oriText }) : null, // 派單原文（小字，一行）
    ih("div", { class: "loe-inbox-toast-body", text: t.lines.join("\n") }),
    chat ? ih("div", { class: "loe-inbox-toast-actions" },
      ih("button", { type: "button", class: "loe-inbox-btn primary", html: ic("message-square"), onclick: () => { close(); inbox.notifOpen = false; inboxOpenDriverChatFor(chat.key, t.orderId); } }, ih("span", { text: "司機對話" })),
    ) : null,
    t.folded ? null : ih("span", { class: "loe-inbox-toast-timer" }),
  );
  if (chat) card.style.borderLeftColor = inboxBotColor(chat.botId);
  return card;
}

export { inboxInsertText, renderInboxContents, renderInboxPicker, renderInboxThread, renderInboxToasts };
