// 車隊雲端設定：套用 /line-ext-config、車隊清單與選擇器。
import { httpGetJson } from "./core/backend.js";
import { API_BASE } from "./core/constants.js";
import { renderPrefixChip } from "./prefix.js";
import { setChatOverrides, setPrefixForGid, setWebhook } from "./settings.js";

// 套用一份車隊雲端設定（後端 /line-ext-config 回應）到本地：
//   - official(無 chatId)：設該 OA 的群編前綴
//   - store(有 chatId)：該對話固定群編＋上車地址
//   - 一併套用 Discord webhook（每車隊一個）
// 設定來源已從硬編碼 CONFIG 改為後端 DB（admin「懶惰蟲配置」頁維護）。
function applyFleetConfig(data) {
  const entries = (data && data.entries) || [];
  const overrides = {};
  let gidCount = 0,
    chatCount = 0;
  entries.forEach((e) => {
    if (!e.groupId) return;
    if (e.chatId) {
      overrides[`${e.groupId}/${e.chatId}`] = {
        group: e.group || "",
        pickup: e.pickup || "",
      };
      chatCount++;
    } else {
      setPrefixForGid(e.groupId, e.group || "");
      gidCount++;
    }
  });
  setChatOverrides(overrides);
  if (data && typeof data.discordWebhook === "string" && data.discordWebhook) {
    setWebhook(data.discordWebhook);
  }
  renderPrefixChip();
  return { gidCount, chatCount };
}
async function fetchFleetConfig(fleet) {
  if (!fleet) return null;
  try {
    return await httpGetJson(
      `${API_BASE}/line-ext-config?fleet=${encodeURIComponent(fleet)}&t=${Date.now()}`,
    );
  } catch (_) {
    return null;
  }
}
// 可選車隊（公開端點 GET /fleets）：只列啟用、非懲罰車隊；同頁共用一次請求，失敗下次重抓
let fleetOptionsPromise = null;
function loadFleetOptions() {
  if (!fleetOptionsPromise) {
    fleetOptionsPromise = httpGetJson(`${API_BASE}/fleets`)
      .then((list) =>
        (Array.isArray(list) ? list : [])
          .filter((f) => f && f.name && f.name !== "*" && f.isActive && !f.isBan)
          .map((f) => {
            const displayName = (f.displayName || "").trim() || f.name;
            return {
              code: f.name,
              displayName,
              label: displayName === f.name ? f.name : `${displayName}（${f.name}）`,
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant")),
      )
      .catch((e) => {
        fleetOptionsPromise = null;
        throw e;
      });
  }
  return fleetOptionsPromise;
}
// 車隊比對鍵：與後端 FleetLabelKey 同口徑（去空白、去 emoji 變體符號 FE0E/FE0F、轉大寫）
function fleetLabelKey(s) {
  return (s || "").replace(/\s+/g, "").replace(/[\uFE0E\uFE0F]/g, "").toUpperCase();
}
// 車隊搜尋選取：輸入滿 2 個字才列出符合的車隊（代碼或顯示名稱包含即中，不一次攤出全部）；
// 完全符合的代碼／名稱不受字數限制（如單字代碼 W）。存的是選中的車隊代碼。
const FLEET_SEARCH_MIN_CHARS = 2;
const FLEET_SEARCH_MAX_RESULTS = 8;
function createFleetPicker(current) {
  const wrap = document.createElement("div");
  wrap.className = "loe-fleet-picker";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "輸入車隊名稱或代碼（至少 2 個字）";
  input.setAttribute("aria-label", "車隊");
  input.autocomplete = "off";
  input.value = current;
  const list = document.createElement("div");
  list.className = "loe-fleet-suggest";
  list.hidden = true;
  wrap.appendChild(input);
  wrap.appendChild(list);

  let options = null; // null＝列表尚未載入或載入失敗
  let selected = null; // 目前選中的車隊（{code,label,displayName}）
  let results = [];
  const matchExact = (text) => {
    const key = fleetLabelKey(text);
    return (
      (key &&
        (options || []).find(
          (o) => fleetLabelKey(o.code) === key || fleetLabelKey(o.displayName) === key,
        )) ||
      null
    );
  };
  const pick = (opt) => {
    selected = opt;
    input.value = opt.label;
    list.hidden = true;
  };
  const renderResults = () => {
    list.textContent = "";
    const text = input.value.trim();
    const key = fleetLabelKey(text);
    results = [];
    if (options && key) {
      const exact = matchExact(text);
      results =
        [...text].length < FLEET_SEARCH_MIN_CHARS
          ? exact
            ? [exact]
            : []
          : options.filter(
              (o) =>
                fleetLabelKey(o.code).includes(key) ||
                fleetLabelKey(o.displayName).includes(key),
            );
      results = results.slice(0, FLEET_SEARCH_MAX_RESULTS);
    }
    results.forEach((o) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = o.label;
      // mousedown 只擋失焦（輸入框 blur 會收清單）；click 才選，事件落在面板內不會觸發點外面關閉
      item.addEventListener("mousedown", (e) => e.preventDefault());
      item.addEventListener("click", () => pick(o));
      list.appendChild(item);
    });
    list.hidden = results.length === 0;
  };
  input.addEventListener("input", () => {
    selected = matchExact(input.value);
    renderResults();
  });
  input.addEventListener("blur", () => (list.hidden = true));
  // Enter 有搜尋結果時選第一筆，不觸發面板的儲存
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !list.hidden && results.length) {
      e.preventDefault();
      e.stopImmediatePropagation();
      pick(results[0]);
    }
  });

  loadFleetOptions()
    .then((loaded) => {
      options = loaded;
      const hit = matchExact(input.value);
      if (hit) pick(hit);
    })
    .catch(() => {});

  return {
    el: wrap,
    input,
    // 回傳要存的車隊代碼；error 表示不可儲存
    resolve() {
      const text = input.value.trim();
      if (!text) return { code: "" };
      if (selected) return { code: selected.code };
      if (!options)
        return text === current
          ? { code: current } // 列表載入失敗：未改動就沿用原設定
          : { error: "車隊列表載入失敗，請稍後再試" };
      return { error: "查無此車隊，請輸入至少 2 個字後從清單選擇" };
    },
  };
}

export { applyFleetConfig, createFleetPicker, fetchFleetConfig, fleetLabelKey };
