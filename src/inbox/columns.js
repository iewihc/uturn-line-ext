// 收件匣的分隔線：三條直的拖拉調整左欄（官方帳號）、中欄（官方訊息）、右側欄（司機對話／記事本）的寬度，對話欄吃剩下的；
// 一條橫的在訊息串與輸入區之間，拖拉調整回覆輸入框高度。都記在本機，雙擊回預設。
import { storeSet } from "../core/store.js";
import { INBOX_COL_WIDTHS_KEY, INBOX_COMPOSER_H_KEY, inbox } from "./core.js";

const COL_MIN = { rail: 180, list: 260, side: 280 };
const COL_MAX_RATIO = 0.6; // 單欄最多佔整個收件匣寬度的六成
const COMPOSER_MIN = 60; // 同 .loe-inbox-textarea 的 min-height
const THREAD_MIN = 160; // 輸入框拉高時訊息串至少留這麼高
const colEl = (col) => ({ rail: inbox.el.railAside, list: inbox.el.listSection, side: inbox.el.side })[col];

// 共用的拖拉：pointerdown 時 start(e) 回傳 { move(ev), end() }（回 null 就不開始）；期間加 .dragging、用 pointer capture
function inboxDragSplit(split, start) {
  split.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const h = start(e);
    if (!h) return;
    const move = (ev) => { h.move(ev); ev.preventDefault(); };
    const up = () => {
      split.classList.remove("dragging");
      split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", up); split.removeEventListener("pointercancel", up);
      h.end();
    };
    split.classList.add("dragging");
    split.setPointerCapture(e.pointerId);
    split.addEventListener("pointermove", move); split.addEventListener("pointerup", up); split.addEventListener("pointercancel", up);
    e.preventDefault();
  });
}

function inboxApplyColumns() {
  for (const col of ["rail", "list", "side"]) {
    const el = colEl(col);
    if (!el) continue;
    const w = Number(inbox.colWidths[col]) || 0;
    el.style.flexBasis = w ? `${w}px` : "";
    if (col === "side") el.style.width = w ? `${w}px` : "";
  }
}
function inboxApplyComposer() {
  const ta = inbox.el.textarea;
  if (ta) ta.style.height = inbox.composerHeight ? `${inbox.composerHeight}px` : "";
}
function inboxSaveComposer(h) {
  inbox.composerHeight = h;
  storeSet(INBOX_COMPOSER_H_KEY, h);
}
function initInboxColumns() {
  inboxApplyColumns();
  inboxApplyComposer();
  for (const split of document.querySelectorAll(".loe-inbox-vsplit")) {
    const col = split.dataset.col;
    inboxDragSplit(split, (e) => {
      const el = colEl(col);
      if (!el) return null;
      const startX = e.clientX, startW = el.getBoundingClientRect().width;
      const max = Math.max(COL_MIN[col], Math.floor((inbox.el.body?.clientWidth || window.innerWidth) * COL_MAX_RATIO));
      return {
        move(ev) {
          const delta = ev.clientX - startX;
          inbox.colWidths[col] = Math.round(Math.min(Math.max(col === "side" ? startW - delta : startW + delta, COL_MIN[col]), max)); // 右側欄是往左拉變寬
          inboxApplyColumns();
        },
        end() { storeSet(INBOX_COL_WIDTHS_KEY, inbox.colWidths); },
      };
    });
    split.addEventListener("dblclick", () => { delete inbox.colWidths[col]; storeSet(INBOX_COL_WIDTHS_KEY, inbox.colWidths); inboxApplyColumns(); });
  }
  // 訊息串／輸入區之間：往上拉輸入框變高（訊息串至少留 THREAD_MIN）
  const { thSplit, textarea: ta, thMsgs } = inbox.el;
  if (!thSplit || !ta) return;
  inboxDragSplit(thSplit, (e) => {
    const startY = e.clientY, startH = ta.getBoundingClientRect().height;
    const max = Math.max(COMPOSER_MIN, startH + (thMsgs?.clientHeight || 0) - THREAD_MIN);
    return {
      move(ev) { ta.style.height = `${Math.round(Math.min(Math.max(startH - (ev.clientY - startY), COMPOSER_MIN), max))}px`; },
      end() { inboxSaveComposer(parseInt(ta.style.height, 10) || 0); },
    };
  });
  thSplit.addEventListener("dblclick", () => { inboxSaveComposer(0); inboxApplyComposer(); });
  // 輸入框右下角原生的拉角也能調，放開時一樣記住
  ta.addEventListener("pointerup", () => {
    const h = parseInt(ta.style.height, 10) || 0;
    if (h !== inbox.composerHeight) inboxSaveComposer(h);
  });
}

export { inboxDragSplit, initInboxColumns };
