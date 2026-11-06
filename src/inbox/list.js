// 收件匣中欄「官方訊息」清單：篩選、搜尋、每列的群編／AI／訂單狀態。
import { aiBots } from "../ai-toggle.js";
import { hasLineExtAuth } from "../core/backend.js";
import { ic } from "../core/icons.js";
import { inboxAiLabel, inboxQueueAi } from "./ai.js";
import { inboxAssigneeLabel, inboxEnabledIds } from "./chats.js";
import { INBOX_FILTERS, INBOX_ORDER_FILTERS_COLLAPSED_KEY, ih, inbox, inboxBotColor, inboxBotName, inboxGroupLabel, inboxTime } from "./core.js";
import { inboxChatColumns, inboxRefreshBoards, orderColumnLabel, renderInboxOrderFilters } from "./order-status.js";
import { inboxOpenChat } from "./send.js";
import { inboxAvatar, inboxVisibleChats } from "./shell.js";
import { storeSet } from "../core/store.js";
import { getChatOverrides, getPrefixForGid } from "../settings.js";

function renderInboxList() {
  const filters = inbox.el.filters, rows = inbox.el.rows;
  if (!filters || !rows) return;
  filters.textContent = "";
  // 未讀／待處理／處理完畢掛數量（同下面訂單狀態：已載入且符合目前搜尋的對話數＝點下去看到的列數）
  const counted = new Set(["unread", "followUp", "done"]);
  for (const f of INBOX_FILTERS) {
    if (f.id === "mine" && !inbox.me?.bizId) continue;
    const n = counted.has(f.id) ? inboxVisibleChats(inbox.orderFilter, f.id).length : 0;
    filters.append(ih("button", {
      type: "button", class: "loe-inbox-chip" + (inbox.filter === f.id ? " on" : ""), "aria-pressed": inbox.filter === f.id ? "true" : "false",
      onclick: () => { inbox.filter = f.id; renderInboxList(); },
    }, f.label, n ? ih("span", { class: "n", text: String(n) }) : null));
  }
  if (hasLineExtAuth())
    filters.append(ih("button", { type: "button", class: "loe-inbox-chip loe-inbox-chip-refresh", html: ic("refresh"), disabled: inbox.boardRefreshing,
      title: "重新整理預約／未派／承接／抵達／執行的數量", "aria-label": "重新整理訂單狀態數量", onclick: inboxRefreshBoards }));
  // 訂單狀態那排可往上收起（篩選照常生效；收起時有選狀態就顯示在這顆上提醒）
  if (hasLineExtAuth() && inboxEnabledIds().some((id) => inbox.board.get(id))) {
    const collapsed = inbox.orderFiltersCollapsed;
    const active = collapsed && inbox.orderFilter ? orderColumnLabel(inbox.orderFilter) : "";
    filters.append(ih("button", { type: "button", class: "loe-inbox-chip loe-inbox-chip-refresh loe-inbox-chip-fold" + (active ? " on" : ""), html: ic(collapsed ? "chevron-down" : "chevron-up"),
      title: collapsed ? "展開訂單狀態篩選" : "收起訂單狀態篩選", "aria-label": collapsed ? "展開訂單狀態篩選" : "收起訂單狀態篩選", "aria-expanded": collapsed ? "false" : "true",
      onclick: () => { inbox.orderFiltersCollapsed = !collapsed; storeSet(INBOX_ORDER_FILTERS_COLLAPSED_KEY, inbox.orderFiltersCollapsed); renderInboxList(); } },
      active ? ih("span", { class: "loe-inbox-chip-fold-active", text: active }) : null));
  }
  renderInboxOrderFilters();
  rows.textContent = "";
  const chats = inboxVisibleChats();
  const overrides = getChatOverrides();
  for (const c of chats) {
    const selected = inbox.selected === c.key;
    const group = (overrides[c.key] && overrides[c.key].group) || getPrefixForGid(c.botId);
    const ai = inboxAiLabel(c);
    if (aiBots.get(c.botId) === true) inboxQueueAi(c);
    const row = ih("button", { type: "button", class: "loe-inbox-row" + (selected ? " selected" : ""), "aria-current": selected ? "true" : null, onclick: () => inboxOpenChat(c.key) },
      inboxAvatar(c),
      ih("span", { class: "loe-inbox-row-main" },
        ih("span", { class: "loe-inbox-row-top" },
          // 選項「不顯示官方帳號名稱」：有群編就只顯示群編（沒群編仍顯示名稱，才分得出是哪個帳號）
          inbox.hideOaName && group ? null : ih("span", { class: "loe-inbox-oa-chip", text: inboxBotName(c.botId).slice(0, 6), title: inboxBotName(c.botId) }),
          group ? ih("span", { class: "loe-inbox-tag group", text: inboxGroupLabel(group) || group, title: `${inboxBotName(c.botId)}・派單預設群編：${group}` }) : null,
          c.pinnedAt ? ih("span", { class: "loe-inbox-pin", html: ic("pin"), title: "已釘選" }) : null,
          ih("span", { class: "loe-inbox-row-name", text: c.name, title: c.name }), // 名字被「…」縮掉時滑過去看全名
          ih("span", { class: "loe-inbox-row-time", text: inboxTime(c.at) }),
        ),
        ih("span", { class: "loe-inbox-row-mid" },
          ih("span", { class: "loe-inbox-row-preview", text: c.preview, title: c.preview || "" }),
          c.unread ? ih("span", { class: "loe-inbox-unread" + (c.unreadCount ? "" : " dot"), text: c.unreadCount ? String(c.unreadCount) : "" }) : null,
        ),
        ih("span", { class: "loe-inbox-row-meta" },
          ...inboxChatColumns(c).map((col) => ih("span", { class: `loe-inbox-tag ord ${col}`, text: orderColumnLabel(col) })),
          ai ? ih("span", { class: `loe-inbox-tag ${ai.cls}`, text: ai.text }) : null,
          c.followedUp ? ih("span", { class: "loe-inbox-tag", text: "待處理" }) : null,
          c.done ? ih("span", { class: "loe-inbox-tag done", text: "處理完畢" }) : null,
          inboxAssigneeLabel(c) ? ih("span", { class: "loe-inbox-muted", text: inboxAssigneeLabel(c) }) : null,
        ),
      ),
    );
    const oaChip = row.querySelector(".loe-inbox-oa-chip");
    if (oaChip) oaChip.style.background = inboxBotColor(c.botId);
    if (selected) row.style.borderLeftColor = inboxBotColor(c.botId);
    rows.append(row);
  }
  if (!chats.length) rows.append(ih("div", { class: "loe-inbox-empty", text: !inboxEnabledIds().length ? "打開左邊的帳號開關開始監聽。" : (inbox.el.listSearch?.value || "").trim() ? "沒有符合搜尋的對話。" : "沒有符合的對話。篩選記得有「未讀」跟「全部」可切換。" }));
}

export { renderInboxList };
