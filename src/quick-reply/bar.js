// 快速回覆：輸入框上方的氣泡列、快速回覆選單、工具列按鈕。
import { QR_BAR_CLASS, QR_CHIP_CLASS, QR_MODE_KEY, QUICK_BUTTON_CLASS, QUICK_MENU_CLASS, QUICK_MENU_OPEN_CLASS } from "../core/constants.js";
import { QUICK_ICON } from "../core/icons.js";
import { getFleetReplies, getReplies, storeGet } from "../core/store.js";
import { addLedgerButton } from "../ledger.js";
import { openManager } from "./manager.js";
import { fillReplyTextarea, getEditorHost } from "../ui/reply-input.js";

/* ---------------------------------------------------------------------- *
 * Quick reply menu
 * ---------------------------------------------------------------------- */
function closeQuickReplyMenus(except) {
  document
    .querySelectorAll(`.${QUICK_BUTTON_CLASS}.${QUICK_MENU_OPEN_CLASS}`)
    .forEach((b) => {
      if (b !== except) {
        b.classList.remove(QUICK_MENU_OPEN_CLASS);
        b.setAttribute("aria-expanded", "false");
      }
    });
}
function populateQuickMenu(menu) {
  menu.textContent = "";
  // 選單只保留「管理 / 新增快速回覆」一項（快速回覆清單已顯示在輸入框上方的氣泡列）
  const manage = document.createElement("button");
  manage.type = "button";
  manage.className = "loe-qr-manage";
  manage.textContent = "管理 / 新增快速回覆";
  manage.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeQuickReplyMenus();
    openManager();
  });
  menu.appendChild(manage);
}
function refreshAllQuickMenus() {
  document
    .querySelectorAll(`.${QUICK_MENU_CLASS}`)
    .forEach(populateQuickMenu);
}
// 輸入框上方的快捷氣泡列（最多前 5 個；點了帶入對話框）
// onPick：點氣泡時要把範本塞到哪裡（LINE 聊天室＝原生輸入框；收件匣＝自己的 textarea）
function renderQuickBar(bar, onPick) {
  bar = bar || document.querySelector(`.${QR_BAR_CLASS}`);
  if (!bar) return;
  // 收件匣的氣泡列第一次會帶自己的 onPick；之後管理視窗存檔觸發的 renderQuickBar() 沒帶參數，沿用上次的
  if (onPick) bar._loePick = onPick;
  onPick = onPick || bar._loePick || fillReplyTextarea;
  bar.textContent = "";
  const addChip = (r, isFleet) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = QR_CHIP_CLASS + (isFleet ? " loe-qr-chip-fleet" : "");
    chip.textContent = r.name || r.text;
    chip.title = (isFleet ? "【車隊統一】" : "") + r.text;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPick(r.text);
    });
    bar.appendChild(chip);
  };
  // 顯示模式：同步個人=只顯示個人、同步車隊=只顯示車隊、同步個人＋車隊=並存
  const mode = storeGet(QR_MODE_KEY, "both") || "both";
  if (mode !== "personal") getFleetReplies().forEach((r) => addChip(r, true));
  if (mode !== "fleet") getReplies().forEach((r) => addChip(r, false));
}
function ensureQuickBar() {
  const host = getEditorHost();
  if (!host) return;
  const editorArea = host.closest(".editor-area");
  const col = editorArea ? editorArea.parentElement : null;
  if (!col) return;
  let bar = col.querySelector(`:scope > .${QR_BAR_CLASS}`);
  if (bar) return; // 已存在就不要重建（避免每次 observer 觸發都重繪造成忙迴圈）
  bar = document.createElement("div");
  bar.className = QR_BAR_CLASS;
  col.insertBefore(bar, col.firstChild);
  renderQuickBar(bar);
}
function addQuickReplyButton(phoneLink) {
  if (
    !phoneLink ||
    phoneLink.parentElement.querySelector(`.${QUICK_BUTTON_CLASS}`)
  )
    return;
  const button = document.createElement("a");
  button.href = "#";
  button.role = "button";
  button.className = `mr-2 ${QUICK_BUTTON_CLASS}`;
  button.setAttribute("aria-label", "快速回覆");
  button.setAttribute("aria-expanded", "false");
  button.title = "快速回覆";
  // 內嵌 SVG icon，與通話邀請 (la-chat-phone) icon 對齊
  button.insertAdjacentHTML("beforeend", QUICK_ICON);
  // 點擊直接開「快捷回覆管理」modal（原本先彈一層只有一個選項的選單）
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openManager();
  });
  phoneLink.insertAdjacentElement("afterend", button);
}
function enhanceQuickReplyToolbars(root = document) {
  root.querySelectorAll("i.lar.la-chat-phone.la-fw.la-lg").forEach((icon) => {
    const a = icon.closest("a");
    addQuickReplyButton(a);
    // $ 放在快速回覆按鈕右邊
    const quickBtn = a && a.parentElement.querySelector(`.${QUICK_BUTTON_CLASS}`);
    addLedgerButton(quickBtn || a);
  });
}

export { closeQuickReplyMenus, enhanceQuickReplyToolbars, ensureQuickBar, refreshAllQuickMenus, renderQuickBar };
