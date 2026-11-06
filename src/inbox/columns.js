// 收件匣三條直的分隔線：拖拉調整左欄（官方帳號）、中欄（官方訊息）、右側欄（司機對話／記事本）的寬度，對話欄吃剩下的；記在本機，雙擊回預設。
import { storeSet } from "../core/store.js";
import { INBOX_COL_WIDTHS_KEY, inbox } from "./core.js";

const COL_MIN = { rail: 180, list: 260, side: 280 };
const COL_MAX_RATIO = 0.6; // 單欄最多佔整個收件匣寬度的六成
const colEl = (col) => ({ rail: inbox.el.railAside, list: inbox.el.listSection, side: inbox.el.side })[col];

function inboxApplyColumns() {
  for (const col of ["rail", "list", "side"]) {
    const el = colEl(col);
    if (!el) continue;
    const w = Number(inbox.colWidths[col]) || 0;
    el.style.flexBasis = w ? `${w}px` : "";
    if (col === "side") el.style.width = w ? `${w}px` : "";
  }
}
function initInboxColumns() {
  inboxApplyColumns();
  for (const split of document.querySelectorAll(".loe-inbox-vsplit")) {
    const col = split.dataset.col;
    split.addEventListener("pointerdown", (e) => {
      const el = colEl(col);
      if (e.button !== 0 || !el) return;
      const startX = e.clientX, startW = el.getBoundingClientRect().width;
      const max = Math.max(COL_MIN[col], Math.floor((inbox.el.body?.clientWidth || window.innerWidth) * COL_MAX_RATIO));
      const move = (ev) => {
        const delta = ev.clientX - startX;
        const w = Math.round(Math.min(Math.max(col === "side" ? startW - delta : startW + delta, COL_MIN[col]), max)); // 右側欄是往左拉變寬
        inbox.colWidths[col] = w;
        inboxApplyColumns();
        ev.preventDefault();
      };
      const up = () => {
        split.classList.remove("dragging");
        split.removeEventListener("pointermove", move); split.removeEventListener("pointerup", up); split.removeEventListener("pointercancel", up);
        storeSet(INBOX_COL_WIDTHS_KEY, inbox.colWidths);
      };
      split.classList.add("dragging");
      split.setPointerCapture(e.pointerId);
      split.addEventListener("pointermove", move); split.addEventListener("pointerup", up); split.addEventListener("pointercancel", up);
      e.preventDefault();
    });
    split.addEventListener("dblclick", () => { delete inbox.colWidths[col]; storeSet(INBOX_COL_WIDTHS_KEY, inbox.colWidths); inboxApplyColumns(); });
  }
}

export { initInboxColumns };
