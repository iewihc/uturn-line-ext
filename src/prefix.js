// 群編前綴：頂部帳號名稱旁的 chip、設定小視窗（前綴、Webhook、後台帳號、車隊、店配覆寫）。
import { httpGetJson } from "./core/backend.js";
import { API_BASE, PREFIX_CHIP_CLASS, UTURN_BUILD } from "./core/constants.js";
import { ic } from "./core/icons.js";
import { getOaId, getOaName } from "./core/page-context.js";
import { applyFleetConfig, createFleetPicker } from "./fleet.js";
import { syncRemoteConfig, toggleReplySyncMenu } from "./remote-config.js";
import { fixEmailTypo, getDispatcher, getFleet, getPrefix, setDispatcher, setFleet, setPrefix } from "./settings.js";
import { toast } from "./ui/toast.js";

/* ---------------------------------------------------------------------- *
 * Prefix setting (頂部帳號名稱旁，一組，對應目前 OA 帳號)
 * ---------------------------------------------------------------------- */
const GEAR_ICON = ic("settings");
function renderPrefixChip() {
  const chip = document.querySelector(`.${PREFIX_CHIP_CLASS}`);
  if (!chip) return;
  const prefix = getPrefix();
  chip.classList.toggle("loe-prefix-empty", !prefix);
  chip.textContent = "";
  chip.insertAdjacentHTML("beforeend", GEAR_ICON);
  const span = document.createElement("span");
  span.className = "loe-prefix-text";
  span.textContent = prefix ? prefix : "設定前綴";
  chip.appendChild(span);
  chip.title = prefix ? `目前前綴：${prefix}（點擊編輯）` : "設定轉發前綴";
}
function openPrefixPopover(anchor) {
  closePrefixPopover();
  const pop = document.createElement("div");
  pop.className = "loe-prefix-pop";
  const title = document.createElement("div");
  title.className = "loe-pop-title";
  title.textContent = "轉發設定";

  // 顯示目前綁定的官方帳號（每個帳號各自獨立）
  const acct = document.createElement("div");
  acct.style.cssText =
    "display:inline-flex;align-items:center;margin-bottom:8px;padding:3px 9px;border-radius:999px;background:#eef4ff;color:#0b57d0;font-size:12px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  acct.textContent = `此帳號：${getOaName() || getOaId()}`;

  // 前綴
  const hint = document.createElement("div");
  hint.className = "loe-pop-hint";
  hint.innerHTML =
    "群編前綴（不用加斜線，派單時會自動補上）。例如填「W0」。（僅套用於此帳號）";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "例如：W0";
  input.value = getPrefix();

  // 後台帳號（Email）— 全部帳號共用，顯示為這張單在 Discord 的發送者
  const whoHint = document.createElement("div");
  whoHint.className = "loe-pop-hint";
  whoHint.style.marginTop = "4px";
  whoHint.textContent = "UTurn後台帳號（Email，全部帳號共用，設定一次即可）：";
  const whoInput = document.createElement("input");
  whoInput.type = "email";
  whoInput.placeholder = "例如：dispatcher@uturn.com";
  whoInput.value = getDispatcher();

  // 車隊 — 搜尋後從清單選取（存代碼，不讓使用者手填打錯）；設定後台帳號後，
  // 依此向後端拉該車隊的 Webhook 與官方/店配設定
  const fleetHint = document.createElement("div");
  fleetHint.className = "loe-pop-hint";
  fleetHint.style.marginTop = "4px";
  fleetHint.textContent = "請搜尋並選擇您的車隊";
  const fleetPicker = createFleetPicker(getFleet());

  const actions = document.createElement("div");
  actions.className = "loe-pop-actions";
  const clearBtn = document.createElement("button");
  clearBtn.className = "loe-btn-ghost";
  clearBtn.textContent = "清除";
  clearBtn.addEventListener("click", () => {
    setPrefix("");
    setDispatcher("");
    setFleet("");
    closePrefixPopover();
    toast("已清除前綴、後台帳號與車隊");
  });
  const saveBtn = document.createElement("button");
  saveBtn.className = "loe-btn-primary";
  saveBtn.textContent = "儲存";
  // 離開欄位就先更正，使用者看得到改成什麼
  whoInput.addEventListener("blur", () => {
    const fixed = fixEmailTypo(whoInput.value);
    if (fixed !== whoInput.value.trim()) {
      whoInput.value = fixed;
      toast("已幫你把 Email 更正為 " + fixed);
    }
  });
  saveBtn.addEventListener("click", () => {
    const typed = whoInput.value.trim();
    const acct = fixEmailTypo(typed);
    if (acct !== typed) {
      whoInput.value = acct;
      toast("已幫你把 Email 更正為 " + acct);
    }
    if (acct && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acct)) {
      whoInput.focus();
      toast("後台帳號請輸入正確的 Email 格式");
      return;
    }
    // 車隊必須從搜尋清單選中（舊設定對不到現有車隊，如車隊已改代碼，也要重選）
    const fleet = fleetPicker.resolve();
    if (fleet.error) {
      fleetPicker.input.focus();
      toast(fleet.error);
      return;
    }
    setPrefix(input.value.trim());
    setDispatcher(acct);
    setFleet(fleet.code);
    closePrefixPopover();
    toast(
      "已儲存設定" +
        (input.value.trim() ? "（前綴：" + input.value.trim() + "）" : ""),
    );
    // 設定後台帳號後才驅動：拉該帳號的快速回覆與該車隊的 Webhook/設定
    syncRemoteConfig();
  });
  actions.appendChild(clearBtn);
  actions.appendChild(saveBtn);

  pop.appendChild(title);
  pop.appendChild(acct);
  pop.appendChild(hint);
  pop.appendChild(input);
  pop.appendChild(whoHint);
  pop.appendChild(whoInput);
  pop.appendChild(fleetHint);
  pop.appendChild(fleetPicker.el);
  pop.appendChild(actions);
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = Math.round(r.bottom + 8) + "px";
  pop.style.left =
    Math.round(Math.min(r.left, window.innerWidth - 296)) + "px";
  input.focus();
  const onKey = (e) => {
    if (e.key === "Enter") saveBtn.click();
    if (e.key === "Escape") closePrefixPopover();
  };
  input.addEventListener("keydown", onKey);
  whoInput.addEventListener("keydown", onKey);
  fleetPicker.input.addEventListener("keydown", onKey);
  pop.addEventListener("click", (e) => e.stopPropagation());
  openPrefixPopover._pop = pop;
}
function closePrefixPopover() {
  if (openPrefixPopover._pop) {
    openPrefixPopover._pop.remove();
    openPrefixPopover._pop = null;
  }
}
function enhancePrefixChip() {
  const header = document.querySelector("header");
  if (!header) return;
  if (header.querySelector(`.${PREFIX_CHIP_CLASS}`)) return;
  const dd = header.querySelector(".dropdown.btn-group");
  if (!dd) return;
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = PREFIX_CHIP_CLASS;
  chip.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (openPrefixPopover._pop) closePrefixPopover();
    else openPrefixPopover(chip);
  });
  dd.insertAdjacentElement("afterend", chip);

  // 同步群編設定（向後端拉目前車隊的群編/店配/webhook 設定並套用）
  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "loe-import-btn";
  importBtn.insertAdjacentHTML("beforeend", ic("download"));
  const importLabel = document.createElement("span");
  importLabel.textContent = "同步群編";
  importBtn.appendChild(importLabel);
  importBtn.title = "向後端拉目前車隊（設定面板）的群編/店配設定並套用";
  importBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const fleet = getFleet();
    if (!fleet) {
      toast("請先在設定面板選擇車隊");
      return;
    }
    try {
      const data = await httpGetJson(
        `${API_BASE}/line-ext-config?fleet=${encodeURIComponent(fleet)}&t=${Date.now()}`,
      );
      const r = applyFleetConfig(data);
      // toast 帶出車隊名稱（後端一併回傳）：車隊選錯（拉到別隊設定）時一眼可見
      toast(
        `已同步 ${data.fleetName || fleet}：${r.gidCount} 個帳號群編、${r.chatCount} 筆店配覆寫`,
      );
    } catch (err) {
      // 失敗原因直接呈現（HTTP 4xx/5xx、timeout、network）
      toast(`同步失敗（${(err && err.message) || "網路錯誤"}），請稍後再試`);
    }
  });
  chip.insertAdjacentElement("afterend", importBtn);

  // 同步快捷回覆（選單：車隊統一模板 / 自己的模板；匯入＝整組取代本地）
  const replySyncBtn = document.createElement("button");
  replySyncBtn.type = "button";
  replySyncBtn.className = "loe-import-btn";
  replySyncBtn.insertAdjacentHTML("beforeend", ic("download"));
  const replySyncLabel = document.createElement("span");
  replySyncLabel.textContent = "同步快捷";
  replySyncBtn.appendChild(replySyncLabel);
  replySyncBtn.title =
    "匯入/更新車隊統一模板＋同步自己的個人模板（並存顯示，車隊模板匯入後常駐）";
  replySyncBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleReplySyncMenu(replySyncBtn);
  });
  importBtn.insertAdjacentElement("afterend", replySyncBtn);

  // 估價按鈕（頂部，放在「一鍵匯入所有設定」旁邊）
  const estBtn = document.createElement("button");
  estBtn.type = "button";
  estBtn.className = "loe-import-btn";
  estBtn.insertAdjacentHTML("beforeend", ic("calculator"));
  const estLabel = document.createElement("span");
  estLabel.textContent = "估價";
  estBtn.appendChild(estLabel);
  estBtn.title = "估價（開啟計費網站）";
  estBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open("https://calc-fare.mr-chi-tech.com/", "_blank", "noopener");
  });
  replySyncBtn.insertAdjacentElement("afterend", estBtn); // 順序：同步群編設定 → 同步快捷 → 估價

  // 多開收件匣入口（新分頁開 ?uturnInbox=1；這一頁本身不開任何 SSE）
  const inboxLink = document.createElement("a");
  inboxLink.id = "loe-inbox-link";
  inboxLink.className = "loe-import-btn";
  inboxLink.href = "/?uturnInbox=1";
  inboxLink.target = "_blank";
  inboxLink.rel = "noopener";
  inboxLink.style.textDecoration = "none";
  inboxLink.title = "收件匣：同時監聽多個官方帳號的新訊息並直接回覆（需身份授權）";
  inboxLink.insertAdjacentHTML("beforeend", ic("inbox"));
  const inboxLabel = document.createElement("span");
  inboxLabel.textContent = "收件匣";
  inboxLink.appendChild(inboxLabel);
  estBtn.insertAdjacentElement("afterend", inboxLink);

  // 版本號放在工具列末端，進階功能按鈕會插在它前面。
  const verChip = document.createElement("span");
  verChip.className = "loe-version-chip";
  verChip.textContent = "v" + UTURN_BUILD;
  verChip.title = "懶惰蟲版本 v" + UTURN_BUILD;
  inboxLink.insertAdjacentElement("afterend", verChip);

  renderPrefixChip();
}

export { GEAR_ICON, closePrefixPopover, enhancePrefixChip, openPrefixPopover, renderPrefixChip };
