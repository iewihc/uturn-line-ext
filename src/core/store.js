// GM 儲存（localStorage 備援）與快速回覆的讀寫。
import { FLEET_STORE_KEY, STORE_KEY } from "./constants.js";
import { refreshAllQuickMenus, renderQuickBar } from "../quick-reply/bar.js";
import { pushRepliesToBackend } from "../remote-config.js";
import { getDispatcher } from "../settings.js";

/* ---------------------------------------------------------------------- *
 * Storage (GM with localStorage fallback)
 * ---------------------------------------------------------------------- */
function storeGet(key, def) {
  try {
    if (typeof GM_getValue === "function") {
      const v = GM_getValue(key);
      if (v != null) return typeof v === "string" ? JSON.parse(v) : v;
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch (_) {}
  return def;
}
function storeSet(key, val) {
  try {
    if (typeof GM_setValue === "function")
      GM_setValue(key, JSON.stringify(val));
  } catch (_) {}
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (_) {}
}
function getReplies() {
  const v = storeGet(STORE_KEY, null);
  return Array.isArray(v) ? v : []; // 不再內建預設樣板，一律由後端（依帳號）帶入
}
function getFleetReplies() {
  const v = storeGet(FLEET_STORE_KEY, null);
  return Array.isArray(v) ? v : [];
}
// 是否曾匯入車隊模板（匯入後常駐；沒匯入過＝純個人模式，開頁不自動抓）
function hasImportedFleetReplies() {
  return Array.isArray(storeGet(FLEET_STORE_KEY, null));
}
function setReplies(arr) {
  storeSet(STORE_KEY, arr);
  refreshAllQuickMenus();
  renderQuickBar();
  // ext 為主：本地改動（新增/編輯/刪除/排序）即時推回雲端個人副本，
  // 「匯入自己的模板」才拿得到最新內容（沒設帳號不推、離線靜默）
  pushRepliesToBackend(getDispatcher(), arr);
}

export { getFleetReplies, getReplies, hasImportedFleetReplies, setReplies, storeGet, storeSet };
