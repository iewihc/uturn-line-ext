// 收件匣欄位左右折疊：官方訊息／聊天／司機對話與記事本都能像「官方帳號」一樣收成一條直排字的窄條，點一下展開；記住。
import { storeGet, storeSet } from "../core/store.js";
import { ic } from "../core/icons.js";
import { INBOX_COLS_COLLAPSED_KEY, inbox } from "./core.js";

const COL_LABEL = { list: "官方訊息", thread: "聊天", side: "司機對話・記事本" };
const colEl = (col) => ({ list: inbox.el.listSection, thread: inbox.el.thread, side: inbox.el.side })[col];

function inboxApplyCollapse() {
  for (const col of Object.keys(COL_LABEL)) {
    const el = colEl(col);
    if (!el) continue;
    const on = !!inbox.colsCollapsed[col];
    el.classList.toggle("collapsed", on);
    let strip = el.querySelector(":scope > .loe-inbox-col-strip");
    if (!strip) {
      strip = document.createElement("button");
      strip.type = "button"; strip.className = "loe-inbox-col-strip"; strip.dataset.colToggle = col;
      strip.title = `展開${COL_LABEL[col]}`; strip.setAttribute("aria-label", strip.title);
      strip.innerHTML = `${ic(col === "side" ? "chevron-left" : "chevron-right")}<span class="loe-inbox-rail-strip-text">${COL_LABEL[col]}</span>`;
      el.prepend(strip);
    }
  }
}
function inboxToggleCol(col) {
  if (!(col in COL_LABEL)) return;
  inbox.colsCollapsed[col] = !inbox.colsCollapsed[col];
  storeSet(INBOX_COLS_COLLAPSED_KEY, inbox.colsCollapsed);
  inboxApplyCollapse();
}
// 欄位標題列用的收起鈕（list 往左、thread 往左、side 往右）
function inboxColToggleButton(col) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "loe-inbox-x loe-inbox-col-toggle"; b.dataset.colToggle = col;
  b.title = `收起${COL_LABEL[col]}`; b.setAttribute("aria-label", b.title);
  b.innerHTML = ic(col === "side" ? "chevron-right" : "chevron-left");
  return b;
}
function initInboxCollapse() {
  inbox.colsCollapsed = Object.assign({ list: false, thread: false, side: false }, storeGet(INBOX_COLS_COLLAPSED_KEY, null) || {});
  // 收起鈕／窄條都靠事件委派：標題列重畫也不用重綁
  inbox.el.body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-col-toggle]");
    if (b) { e.stopPropagation(); inboxToggleCol(b.dataset.colToggle); }
  });
  inboxApplyCollapse();
}

export { inboxApplyCollapse, inboxColToggleButton, initInboxCollapse };
