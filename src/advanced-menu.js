// LINE 聊天室頂端的「進階功能」選單（同步客戶、群發、身份授權等入口）。
import { lineAuthDoneText, saveLineCookie } from "./core/backend.js";
import { ic } from "./core/icons.js";
import { getOaId } from "./core/page-context.js";
import { openLineCustomers } from "./line/broadcast.js";
import { lineLastSyncLabel, lineSyncResultText, refreshLineLastSync, syncLineData } from "./line/sync.js";
import { closePrefixPopover } from "./prefix.js";
import { getDispatcher } from "./settings.js";
import { toast } from "./ui/toast.js";

let lineAdvancedMenu = null;
function closeLineAdvancedMenu(restoreFocus = false) {
  const entry = lineAdvancedMenu;
  if (!entry) return;
  entry.menu.hidden = true;
  entry.anchor.setAttribute("aria-expanded", "false");
  entry.cleanup?.();
  entry.cleanup = null;
  if (restoreFocus && entry.anchor.isConnected) entry.anchor.focus();
}
function enhanceLineAdvancedMenu() {
  if (location.hostname !== "chat.line.biz" || window.top !== window.self) return;
  if (lineAdvancedMenu && !lineAdvancedMenu.anchor.isConnected) {
    closeLineAdvancedMenu();
    lineAdvancedMenu.menu.remove();
    lineAdvancedMenu = null;
  }
  const version = document.querySelector("header .loe-version-chip");
  if (!version || lineAdvancedMenu) return;
  const anchor = document.createElement("button");
  anchor.id = "loe-line-advanced-button";
  anchor.type = "button";
  anchor.className = "loe-import-btn";
  anchor.innerHTML = ic("settings") + "<span>進階功能</span>";
  const arrow = document.createElement("span");
  arrow.textContent = "▾"; arrow.setAttribute("aria-hidden", "true");
  anchor.appendChild(arrow);
  anchor.setAttribute("aria-haspopup", "menu");
  anchor.setAttribute("aria-expanded", "false");
  anchor.setAttribute("aria-controls", "loe-line-advanced-menu");
  const menu = document.createElement("div");
  menu.id = "loe-line-advanced-menu";
  menu.className = "loe-advanced-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-labelledby", anchor.id);
  menu.hidden = true;
  menu.addEventListener("click", (event) => event.stopPropagation());
  lineAdvancedMenu = { anchor, menu, cleanup: null, groupId: "", account: "" };
  const availableItems = () => [...menu.querySelectorAll("button:not(:disabled)")];
  const show = (last = false) => {
    if (!menu.hidden) { const items = availableItems(); (last ? items.at(-1) : items[0])?.focus(); return; }
    closePrefixPopover();
    menu.hidden = false;
    anchor.setAttribute("aria-expanded", "true");
    lineAdvancedMenu.groupId = getOaId(); lineAdvancedMenu.account = getDispatcher();
    const syncGroup = lineAdvancedMenu.groupId;
    lineAdvancedMenu.refreshSyncLabel?.();
    refreshLineLastSync(syncGroup).then(() => { if (getOaId() === syncGroup) lineAdvancedMenu?.refreshSyncLabel?.(); });
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 8))}px`;
    const outside = (event) => {
      if (!menu.contains(event.target) && !anchor.contains(event.target)) closeLineAdvancedMenu();
    };
    const dismiss = () => closeLineAdvancedMenu();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    lineAdvancedMenu.cleanup = () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
    const items = availableItems(); (last ? items.at(-1) : items[0])?.focus();
  };
  anchor.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation();
    if (menu.hidden) show(); else closeLineAdvancedMenu(true);
  });
  anchor.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); show(event.key === "ArrowUp");
    }
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeLineAdvancedMenu(true); return; }
    if (event.key === "Tab") { closeLineAdvancedMenu(true); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = availableItems(), index = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
      (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  });
  const actions = [
    {
      id: "loe-line-cookie-button",
      label: "身份授權",
      icon: "shield-check",
      title: "授權設定中的後台帳號使用目前的 LINE 登入狀態",
      run: () => saveLineCookie(),
      done: (result) => result.cancelled ? null : lineAuthDoneText(result),
    },
    {
      id: "loe-line-sync-button",
      label: "同步客戶與記事本",
      icon: "refresh",
      title: "讀完 LINE 全部對話與記事本，分批上傳後整份更新目前官方帳號的後端客戶清單與記事本",
      run: syncLineData,
      done: lineSyncResultText,
    },
    {
      id: "loe-line-customers-button",
      label: "群發訊息",
      icon: "send",
      title: "選擇客戶並編輯要傳送的訊息",
      run: openLineCustomers,
      done: () => null,
    },
  ];
  for (const action of actions) {
    const button = document.createElement("button");
    button.id = action.id;
    button.type = "button";
    button.className = "loe-console-button";
    button.setAttribute("role", "menuitem");
    button.tabIndex = -1;
    button.title = action.title;
    button.insertAdjacentHTML("beforeend", ic(action.icon));
    const label = document.createElement("span"); label.textContent = action.label;
    button.appendChild(label);
    // 同步按鈕後面顯示最後同步時間
    const idleLabel = () => action.id === "loe-line-sync-button" ? action.label + lineLastSyncLabel(getOaId()) : action.label;
    if (action.id === "loe-line-sync-button")
      lineAdvancedMenu.refreshSyncLabel = () => { if (!button.disabled) label.textContent = idleLabel(); };
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      closeLineAdvancedMenu(true);
      if (!/^U[0-9a-f]{32}$/i.test(getOaId())) {
        toast("請先選擇 LINE 官方帳號");
        return;
      }
      // 同步要跑幾分鐘，期間客服可能切換對話；只要還在同一個官方帳號就顯示結果
      const oaId = getOaId();
      button.disabled = true;
      label.textContent = "處理中…";
      try {
        const result = await action.run();
        if (getOaId() === oaId) {
          const message = result ? action.done(result) : "讀取未完成，請稍後重試";
          if (message) toast(message);
        }
      } catch (error) {
        if (getOaId() === oaId)
          toast(error.message || "操作失敗，請稍後重試", "error", 6000);
      } finally {
        button.disabled = false;
        label.textContent = idleLabel();
      }
    });
    menu.appendChild(button);
  }
  document.body.appendChild(menu);
  version.insertAdjacentElement("beforebegin", anchor);
}

export { closeLineAdvancedMenu, enhanceLineAdvancedMenu, lineAdvancedMenu };
