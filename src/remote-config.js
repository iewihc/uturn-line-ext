// 雲端設定同步：依後台帳號拉快速回覆、依車隊拉 Webhook 等設定覆蓋本地快取。
import { httpGetJson } from "./core/backend.js";
import { API_BASE, FLEET_STORE_KEY, QR_MODE_KEY, STORE_KEY } from "./core/constants.js";
import { getReplies, hasImportedFleetReplies, storeSet } from "./core/store.js";
import { applyFleetConfig, fetchFleetConfig } from "./fleet.js";
import { refreshAllQuickMenus, renderQuickBar } from "./quick-reply/bar.js";
import { getDispatcher, getFleet } from "./settings.js";
import { toast } from "./ui/toast.js";

/* ---------------------------------------------------------------------- *
 * 遠端設定同步（account-gated）
 *   - 後台帳號(account) 一設定，才會去後端拉設定並覆蓋本地快取。
 *   - 快速回覆：GET /line-quick-replies?account=X（依帳號，無 auth）
 *   - 車隊設定：GET /line-ext-config?fleet=HELLO（依車隊，無 auth，含 Discord webhook）
 *   - 拉回的值直接寫進既有的本地 key（STORE_KEY / WEBHOOK_KEY）當快取，
 *     既有讀取流程不需改動；後端沒設定或離線時自動沿用本地/預設值。
 * ---------------------------------------------------------------------- */
async function syncRemoteQuickReplies(account, force) {
  if (!account) return;
  try {
    const data = await httpGetJson(
      `${API_BASE}/line-quick-replies?account=${encodeURIComponent(account)}&t=${Date.now()}`,
    );
    const replies = data && data.replies;
    // 自動同步：雲端空清單不覆蓋本地（防帳號打錯/新裝置誤清）；
    // 手動「同步個人」(force)：完全以雲端為準，空清單也套用
    if (Array.isArray(replies) && (replies.length || force)) {
      storeSet(STORE_KEY, replies);
      refreshAllQuickMenus();
      renderQuickBar();
    }
  } catch (_) {
    /* 離線/錯誤：沿用本地快取，不打擾使用者 */
  }
}
async function syncRemoteFleetConfig(fleet) {
  if (!fleet) return;
  const data = await fetchFleetConfig(fleet);
  if (data) applyFleetConfig(data); // 套用 webhook + 群編前綴 + 對話覆寫
}
/* ---- 「同步快捷回覆」：手動匯入模板（整組取代本地清單） ---- */
// 把快捷回覆清單推回後端個人副本（依帳號，無 auth）；沒帳號不推、離線靜默。
function pushRepliesToBackend(account, arr) {
  if (!account || typeof GM_xmlhttpRequest !== "function") return;
  GM_xmlhttpRequest({
    method: "PUT",
    url: `${API_BASE}/line-quick-replies?account=${encodeURIComponent(account)}`,
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ replies: Array.isArray(arr) ? arr : [] }),
  });
}
// 匯入/更新車隊統一模板：抓雲端最新 → 存本地常駐（與個人並存、唯讀）。
async function importFleetQuickReplies() {
  const fleet = getFleet();
  if (!fleet) {
    toast("請先在設定面板選擇車隊");
    return null;
  }
  const data = await httpGetJson(
    `${API_BASE}/line-fleet-quick-replies?fleet=${encodeURIComponent(fleet)}&t=${Date.now()}`,
  );
  const replies = (data && data.replies) || [];
  storeSet(FLEET_STORE_KEY, replies); // 常駐（含空清單——後台清空要跟著清）
  refreshAllQuickMenus();
  renderQuickBar();
  return replies;
}
// 已匯入者開頁自動刷新最新版；從未匯入（純個人模式）不動。
async function refreshFleetRepliesIfImported() {
  if (!hasImportedFleetReplies()) return;
  try {
    await importFleetQuickReplies();
  } catch (_) {
    /* 離線沿用本地常駐副本 */
  }
}
// 同步快捷（mode: "personal" | "fleet" | "both"）——同步對應來源並切換顯示模式：
// 個人=只顯示個人、車隊=只顯示車隊、個人＋車隊=並存（資料都保留，只影響顯示）
async function syncQuickReplies(mode) {
  const fleet = getFleet();
  const account = getDispatcher();
  const wantFleet = mode === "fleet" || mode === "both";
  const wantPersonal = mode === "personal" || mode === "both";
  if (wantPersonal && !account) {
    toast("請先在設定面板填寫後台帳號");
    return;
  }
  if (wantFleet && !fleet) {
    toast("請先在設定面板選擇車隊");
    return;
  }
  try {
    let fleetReplies = null;
    if (wantFleet) fleetReplies = await importFleetQuickReplies();
    if (wantPersonal) await syncRemoteQuickReplies(account, true); // 手動：以雲端為準
    storeSet(QR_MODE_KEY, mode); // 切換顯示模式
    renderQuickBar();
    const parts = [];
    if (wantFleet) parts.push(`車隊統一 ${fleetReplies ? fleetReplies.length : 0} 則`);
    if (wantPersonal) parts.push(`個人 ${getReplies().length} 則`);
    toast(`已同步快捷：${parts.join("、")}`);
  } catch (err) {
    toast(`同步失敗（${(err && err.message) || "網路錯誤"}），請稍後再試`);
  }
}
// 同步快捷小選單：同步個人 / 同步個人＋車隊
function toggleReplySyncMenu(anchor) {
  if (toggleReplySyncMenu._menu) {
    toggleReplySyncMenu._menu.remove();
    toggleReplySyncMenu._menu = null;
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "loe-prefix-pop";
  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.zIndex = "99999";
  menu.addEventListener("click", (e) => e.stopPropagation());
  [
    ["同步個人", "personal"],
    ["同步車隊", "fleet"],
    ["同步個人＋車隊", "both"],
  ].forEach(([label, mode]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "loe-import-btn";
    b.style.display = "block";
    b.style.width = "100%";
    b.style.marginBottom = "6px";
    b.textContent = label;
    b.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleReplySyncMenu._menu && toggleReplySyncMenu._menu.remove();
      toggleReplySyncMenu._menu = null;
      await syncQuickReplies(mode);
    });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  toggleReplySyncMenu._menu = menu;
  setTimeout(() => {
    document.addEventListener(
      "click",
      () => {
        if (toggleReplySyncMenu._menu) {
          toggleReplySyncMenu._menu.remove();
          toggleReplySyncMenu._menu = null;
        }
      },
      { once: true },
    );
  }, 0);
}
// 設定 account 後才驅動：沒帳號一律不動遠端設定。
function syncRemoteConfig() {
  const account = getDispatcher();
  if (!account) return;
  syncRemoteQuickReplies(account);
  syncRemoteFleetConfig(getFleet());
  refreshFleetRepliesIfImported(); // 車隊模板常駐者自動更新到雲端最新
}

export { pushRepliesToBackend, syncRemoteConfig, toggleReplySyncMenu };
