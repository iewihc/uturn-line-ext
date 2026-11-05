// 收件匣右欄：上半司機對話（停靠時）、下半記事本，中間可拖拉；固定開啟司機對話但這位客人沒有單時留一條說明。
import { storeSet } from "../core/store.js";
import { liveOrders } from "../orders.js";
import { INBOX_SIDE_SPLIT_KEY, inbox } from "./core.js";

const SIDE_MIN_PX = 140; // 拖拉時上下各至少留這麼高

function renderInboxSide() {
  const { side, sideSplit, sideEmpty, dchat, notes } = inbox.el;
  if (!side) return;
  const chat = inbox.selected && inbox.chats.get(inbox.selected);
  const dchatDocked = !!dchat && !dchat.hidden && dchat.parentElement === side;
  const notesShown = !!chat && inbox.notesOpen;
  const st = chat && inbox.orders.get(chat.key);
  // 固定開啟司機對話、這位客人訂單讀完了卻沒有已派到司機的單：司機對話縮成一條說明
  const noDriver = !!chat && inbox.pinDchat && !dchatDocked && !!st && !st.loading && !liveOrders(st.list).some((o) => o.hasDriver);
  side.hidden = !(dchatDocked || notesShown || noDriver);
  sideEmpty.hidden = !noDriver;
  sideEmpty.textContent = noDriver ? "司機對話　這位客人沒有已派到司機的進行中訂單" : "";
  const both = dchatDocked && notesShown && !inbox.notesCollapsed;
  sideSplit.hidden = !both;
  side.classList.toggle("split", both);
  if (dchat) dchat.style.flexBasis = both && inbox.dchatHeight ? `${inbox.dchatHeight}px` : "";
  if (notes) notes.classList.toggle("collapsed", inbox.notesCollapsed);
}

// 中間的分隔條：拖拉調整司機對話高度（記住）；雙擊回預設
function initInboxSide() {
  const { side, sideSplit, dchat } = inbox.el;
  if (!sideSplit) return;
  sideSplit.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !dchat) return;
    const top = side.getBoundingClientRect().top;
    const max = side.clientHeight - SIDE_MIN_PX;
    const move = (ev) => {
      inbox.dchatHeight = Math.round(Math.min(Math.max(ev.clientY - top, SIDE_MIN_PX), max));
      dchat.style.flexBasis = `${inbox.dchatHeight}px`;
      ev.preventDefault();
    };
    const up = () => {
      sideSplit.removeEventListener("pointermove", move); sideSplit.removeEventListener("pointerup", up); sideSplit.removeEventListener("pointercancel", up);
      storeSet(INBOX_SIDE_SPLIT_KEY, inbox.dchatHeight);
    };
    sideSplit.setPointerCapture(e.pointerId);
    sideSplit.addEventListener("pointermove", move); sideSplit.addEventListener("pointerup", up); sideSplit.addEventListener("pointercancel", up);
  });
  sideSplit.addEventListener("dblclick", () => { inbox.dchatHeight = 0; storeSet(INBOX_SIDE_SPLIT_KEY, 0); renderInboxSide(); });
}

export { initInboxSide, renderInboxSide };
