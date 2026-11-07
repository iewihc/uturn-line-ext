// 派單視窗：群編＋上車地址＋筆記組成派單原文，送 Discord／後端，派單後自動回覆與標記待處理。
import { DISPATCH_BUTTON_CLASS, DISPATCH_POP_CLASS } from "./core/constants.js";
import { INBOX_MODE } from "./core/env.js";
import { ic } from "./core/icons.js";
import { getChatId, getCustomerName, getOaId } from "./core/page-context.js";
import { getReplies } from "./core/store.js";
import { sendForward, tryApiDispatch } from "./forward.js";
import { inboxFollowUp } from "./inbox/chat-tools.js";
import { inboxReloadSelectedOrders } from "./inbox/orders.js";
import { inboxSend } from "./inbox/send.js";
import { getAutoReply, getCurrentOverride, getDispatchTemplate, getDispatcher, getDriverRelay, getFleetSystemNoti, getMarkFollowUp, getMemoInclude, getPrefix, getSystemNoti, setAutoReply, setDispatchTemplate, setDriverRelay, setMarkFollowUp, setMemoInclude, setSystemNoti } from "./settings.js";
import { fillReplyTextarea } from "./ui/reply-input.js";
import { toast } from "./ui/toast.js";

/* ---------------------------------------------------------------------- *
 * 派單 (dispatch) — 手動填寫上車地址＋備註，加上前綴送到 Discord，
 * 並把「尋車中」訊息填入輸入框
 * ---------------------------------------------------------------------- */
const TRUCK_ICON = ic("truck");
// 固定格式：群編/地址 [note:筆記] mailto:後台帳號
// 群編不需自行加斜線，這裡自動補上一個（已有斜線也不會重複）。
// 例：W0/虎尾高中 note:王小明 mailto:dc@gmail.com
function buildDispatchPayload(groupCode, address, memo) {
  const email = getDispatcher();
  const g = (groupCode || "").replace(/\/+$/, ""); // 去掉尾端斜線，統一補一個
  let body = g ? `${g}/${address}` : address;
  if (memo) body += ` note:${memo}`; // 筆記（司機看不到，內部備記用）
  if (email) body += ` mailto:${email}`;
  return body;
}
function dispatchEscHandler(e) {
  if (e.key === "Escape") {
    e.stopPropagation();
    closeDispatchPopover();
  }
}
// 視窗拖曳：按住標題列移動；放開後記住左上角（本次頁面有效），再開啟就放回同一位置
let dispatchPopPos = null;
function dispatchPopDrag(pop, handle) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = pop.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    pop.style.bottom = "auto";
    pop.style.left = r.left + "px";
    pop.style.top = r.top + "px";
    pop.classList.add("dragging");
    const move = (ev) => {
      const left = Math.min(Math.max(ev.clientX - dx, 0), window.innerWidth - 80); // 至少留 80px 在畫面內
      const top = Math.min(Math.max(ev.clientY - dy, 0), window.innerHeight - 40);
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.style.maxHeight = Math.max(200, window.innerHeight - top - 12) + "px";
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      pop.classList.remove("dragging");
      dispatchPopPos = { left: pop.offsetLeft, top: pop.offsetTop };
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
}
function closeDispatchPopover() {
  if (openDispatchPopover._pop) {
    openDispatchPopover._pop.remove();
    openDispatchPopover._pop = null;
  }
  document.removeEventListener("keydown", dispatchEscHandler, true);
}
// 自動回覆：填入訊息並按下「傳送」
function autoSendReply(text) {
  if (INBOX_MODE) { inboxSend(text).catch(() => {}); return true; }
  fillReplyTextarea(text, true);
  const sendBtn = document.querySelector(
    ".send-group.btn-group input.btn, .send-group.btn-group button.btn",
  );
  if (sendBtn) {
    window.setTimeout(() => {
      try {
        sendBtn.click();
      } catch (_) {}
    }, 120);
    return true;
  }
  return false;
}
// 標記目前對話為「待處理」：點 LINE 自己的待處理按鈕（用它的驗證 token，API 直打會 403）。
// 實際 DOM（2026/07 在 chat.line.biz live 驗證）：
//   <a class="btn btn-sm btn-outline-info"><i class="las la-chats"></i>待處理</a>
//   已標記時 btn-outline-info 變 btn-outline-success，其餘不變（無 title/active/aria-pressed）。
// 另有一種只剩 icon 沒文字的版型（使用者截圖，滑過顯示 tooltip「設為『待處理』」，
// 桌機縮到 552px 重現不出來，疑似平板/手機版），所以認按鈕不能只靠文字：
// 用 icon（la-chats／la-chat-check）＋文字＋tooltip 屬性三重保險。
// 按鈕的 tooltip 文案（title / aria-label / data-original-title 都可能放）
function followUpHintText(el) {
  return (
    (el.getAttribute("title") || "") +
    " " +
    (el.getAttribute("aria-label") || "") +
    " " +
    (el.getAttribute("data-original-title") || "")
  );
}
let followUpBtnCache = null;
function findFollowUpBtn() {
  // 找這顆按鈕要掃全頁 a.btn/button.btn 並讀 textContent，是最貴的查詢；
  // 成對找到的結果只要還在 DOM 上就直接沿用。
  if (followUpBtnCache && followUpBtnCache.isConnected) return followUpBtnCache;
  followUpBtnCache = null;
  const hintText = followUpHintText;
  const isFollowUpEl = (el) =>
    !!el.querySelector(".la-chats") ||
    (el.textContent || "").trim() === "待處理" ||
    hintText(el).includes("待處理");
  const isDoneEl = (el) =>
    !!el.querySelector(".la-chat-check") ||
    (el.textContent || "").trim() === "處理完畢" ||
    hintText(el).includes("處理完畢");
  // 排除本擴充自己的元素（loe-*）與下拉切換鈕（左側篩選停在「待處理」時，下拉鈕文字也是「待處理」）
  const btns = [...document.querySelectorAll("a.btn, button.btn")].filter(
    (el) =>
      !/(^|\s)loe-|dropdown-toggle/.test(String(el.className || "")) &&
      el.getAttribute("data-toggle") !== "dropdown" &&
      !el.getAttribute("aria-haspopup"),
  );
  // 最可靠的定位：旁邊有「處理完畢」兄弟按鈕的「待處理」才是聊天室頂端的狀態列
  //（左側清單的「待處理」篩選不會跟「處理完畢」成對出現，不會誤點）。
  const paired = btns.find(
    (el) =>
      isFollowUpEl(el) &&
      el.parentElement &&
      [...el.parentElement.children].some(
        (sib) => sib !== el && isDoneEl(sib),
      ),
  );
  if (paired) return (followUpBtnCache = paired);
  // 沒找到成對的（LINE 又改版？）：退回舊法，只在聊天室頂端區域用文字找（不快取，等成對的出現）
  return (
    [
      ...document.querySelectorAll(
        ".sub-header a, .sub-header button, header a, header button",
      ),
    ].find((b) => (b.textContent || "").trim().includes("待處理")) || null
  );
}
function isFollowUpMarked(btn) {
  // 實際觀察：未標記是 btn-outline-info（藍）、標記後轉 success（綠）。
  const cls = String(btn.className || "");
  return (
    /btn-outline-success|\bbtn-success\b|\bactive\b/.test(cls) ||
    btn.getAttribute("aria-pressed") === "true"
  );
}
// 穩健標記：輪詢等待按鈕就緒（送出/換頁後可能還沒 render）。點下去後持續確認，
// 被 LINE 切回未標記（例如自動回覆送達後 LINE 重設狀態）就補點，最多點 3 次、
// 每次點完等 ~900ms 再判斷（避免連點把標記切掉）。連續 3 輪都已標記才算完成，
// 整體最多 ~10 秒；到時停止重試。
function markFollowUp() {
  if (INBOX_MODE) { inboxFollowUp().catch(() => {}); return; }
  const STEP = 300,
    MAX = 10000,
    MAX_CLICKS = 3;
  let waited = 0,
    clicks = 0,
    cooldown = 0,
    stable = 0;
  (function loop() {
    let btn = null;
    try {
      btn = findFollowUpBtn();
    } catch (_) {}
    if (btn && isFollowUpMarked(btn)) {
      stable++;
      if (stable >= 3) return; // 已標記且狀態穩定，完成
    } else {
      stable = 0;
      if (btn) {
        if (cooldown > 0) cooldown--;
        else if (clicks < MAX_CLICKS) {
          try {
            btn.click();
          } catch (_) {}
          clicks++;
          cooldown = 3;
        }
      }
    }
    waited += STEP;
    if (waited < MAX) {
      window.setTimeout(loop, STEP);
      return;
    }
  })();
}
function openDispatchPopover(prefillAddress) {
  closeDispatchPopover();
  // 對話連結綁定「開啟面板當下」的對話（#39435：面板掛在 body、切對話不會關，
  // 送出時才讀 location 會抓到別人的對話）；開啟時拍不到快照才退回送出當下的網址
  const chatIdAtOpen = getChatId();
  const oaIdAtOpen = getOaId();
  // 錨點：原生頁的派單鈕；收件匣則是輸入框旁的「派車」鈕（之前找不到就退回置中貼頂，離手很遠）
  const anchor = document.querySelector(`.${DISPATCH_BUTTON_CLASS}, .loe-inbox-dispatch`);
  const pop = document.createElement("div");
  pop.className = DISPATCH_POP_CLASS;
  pop.addEventListener("click", (e) => e.stopPropagation());

  const title = document.createElement("div");
  title.className = "loe-pop-title";
  title.textContent = "派單";
  title.title = "按住拖曳可移動視窗";
  dispatchPopDrag(pop, title);

  const closeX = document.createElement("button");
  closeX.type = "button";
  closeX.className = "loe-pop-close";
  closeX.textContent = "×";
  closeX.title = "關閉";
  closeX.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeDispatchPopover();
  });

  // 系統自動通知：司機承接／抵達／客上時，後端用「建單人員」的懶惰蟲身份授權，
  // 依車隊複製模板自動把車牌／追蹤連結等送進這個對話（需先完成身份授權）
  const notiWrap = document.createElement("label");
  notiWrap.className = "loe-check loe-sysnoti-check";
  notiWrap.style.margin = "10px 0 4px";
  notiWrap.title = "司機承接、抵達、客上時，系統用你的懶惰蟲身份授權，依車隊複製模板自動傳訊息給這位客人";
  // 車隊設定（後台 › 複製設定 › 懶惰蟲自動通知）：關閉＝鎖住不能勾；預設勾選＝每次開窗先勾好；列出會送哪些節點
  const fleetNoti = getFleetSystemNoti();
  const fleetNotiOff = !!fleetNoti && fleetNoti.enabled === false;
  const notiChk = document.createElement("input");
  notiChk.type = "checkbox";
  notiChk.disabled = fleetNotiOff;
  notiChk.checked = !fleetNotiOff && (fleetNoti?.defaultOn === true || getSystemNoti());
  notiChk.addEventListener("change", () => setSystemNoti(notiChk.checked));
  const notiText = document.createElement("span");
  const notiNodes = fleetNoti && Array.isArray(fleetNoti.nodes) ? fleetNoti.nodes : null;
  notiText.textContent = fleetNotiOff
    ? "系統自動通知（車隊已關閉，後台 › 複製設定）"
    : notiNodes
      ? `系統自動通知（會送：${notiNodes.length ? notiNodes.join("、") : "車隊沒開任何節點"}）`
      : "系統自動通知（承接／抵達／客上自動傳給客人）";
  if (fleetNotiOff) notiWrap.style.opacity = "0.55";
  notiWrap.appendChild(notiChk);
  notiWrap.appendChild(notiText);

  // 司機↔客人轉傳：司機在 App「聯繫客戶」傳的話，後端用建單人員的懶惰蟲身份授權加「司機說：」送進這個對話；
  // 預設不勾、勾過記住；派單後在訂單列「司機↔客人」隨時開關。沒有聊天室（不帶 linechaturl:）時不會有作用
  const relayWrap = document.createElement("label");
  relayWrap.className = "loe-check loe-sysnoti-check";
  relayWrap.style.margin = "4px 0";
  relayWrap.title = "司機可在 App 直接跟客人說話，訊息會加「司機說：」轉到這個對話；派單後可在訂單列隨時開關";
  const relayChk = document.createElement("input");
  relayChk.type = "checkbox";
  relayChk.checked = getDriverRelay();
  relayChk.addEventListener("change", () => setDriverRelay(relayChk.checked));
  const relayText = document.createElement("span");
  relayText.textContent = "司機↔客人轉傳（司機可在 App 直接跟客人說話，會加「司機說：」）";
  relayWrap.appendChild(relayChk);
  relayWrap.appendChild(relayText);

  // 依設定檔決定預設：此對話有店配覆寫就用覆寫的群編＋固定上車地址，否則用此帳號前綴
  const override = getCurrentOverride();

  // 群編（預設帶入設定的前綴／店配覆寫，可自行編輯）
  const groupLabel = document.createElement("label");
  groupLabel.className = "loe-fld";
  groupLabel.textContent = "群編（預設為設定的前綴，可改；不用加斜線）";
  const groupInput = document.createElement("input");
  groupInput.type = "text";
  groupInput.placeholder = "例如：W0";
  groupInput.value =
    override && override.group ? override.group : getPrefix();

  const addrLabel = document.createElement("label");
  addrLabel.className = "loe-fld";
  addrLabel.textContent = "上車地址";
  const addrInput = document.createElement("textarea");
  addrInput.rows = 2;
  addrInput.placeholder = "例如：墨鐵 20:30有行李箱";
  // 優先順序：轉發帶入的地址 > 店配固定上車地址
  if (prefillAddress) addrInput.value = prefillAddress;
  else if (override && override.pickup) addrInput.value = override.pickup;

  // 筆記（預約單可記客戶名稱，司機看不到；組成時變成 note:）
  const memoLabel = document.createElement("label");
  memoLabel.className = "loe-fld";
  memoLabel.textContent = "筆記(選填，司機看不到)";
  const memoInput = document.createElement("input");
  memoInput.type = "text";
  memoInput.placeholder = "例如：王小明（會變成 note:王小明）";
  memoInput.value = getCustomerName(); // 預設帶入目前客戶名稱（含 emoji），可自行改

  // 是否把筆記帶入派單（控制 note: 是否出現在預覽與送出內容）
  const memoChkWrap = document.createElement("label");
  memoChkWrap.className = "loe-check";
  const memoChk = document.createElement("input");
  memoChk.type = "checkbox";
  memoChk.checked = getMemoInclude();
  const memoChkText = document.createElement("span");
  memoChkText.textContent = "帶入乘客姓名";
  memoChkWrap.appendChild(memoChk);
  memoChkWrap.appendChild(memoChkText);

  // 是否標記「待處理」（有勾才標記）
  const markChkWrap = document.createElement("label");
  markChkWrap.className = "loe-check";
  const markChk = document.createElement("input");
  markChk.type = "checkbox";
  markChk.checked = getMarkFollowUp();
  const markChkText = document.createElement("span");
  markChkText.textContent = "標記待處理";
  markChkWrap.appendChild(markChk);
  markChkWrap.appendChild(markChkText);
  markChk.addEventListener("change", () => setMarkFollowUp(markChk.checked));

  // 取目前要送出的筆記值（沒勾就視為空）
  const currentMemo = () => (memoChk.checked ? memoInput.value.trim() : "");
  // 對話連結（linechaturl:）— 送出時加在最後；預覽不顯示。
  // 用開啟面板當下的快照，切過對話再送出也指向原本的客人
  const lineUrlSuffix = () => {
    const chat = chatIdAtOpen || getChatId();
    const oa = chatIdAtOpen ? oaIdAtOpen : getOaId();
    if (!chat) return "";
    return ` linechaturl:https://chat.line.biz/${oa}/chat/${chat}`;
  };

  // 預覽單號（即時顯示送出的完整字串）
  const previewLabel = document.createElement("label");
  previewLabel.className = "loe-fld";
  previewLabel.textContent = "預覽單號（實際送出內容）";
  const preview = document.createElement("div");
  preview.className = "loe-preview";
  function refreshPreview() {
    const a = addrInput.value.trim();
    preview.textContent = a
      ? buildDispatchPayload(groupInput.value.trim(), a, currentMemo())
      : "（填入上車地址後顯示）";
  }
  groupInput.addEventListener("input", refreshPreview);
  addrInput.addEventListener("input", refreshPreview);
  memoInput.addEventListener("input", refreshPreview);
  memoChk.addEventListener("change", () => {
    setMemoInclude(memoChk.checked);
    refreshPreview();
  });

  // 派單後自動回覆客人（可選範本）
  const chkWrap = document.createElement("div");
  chkWrap.className = "loe-check";
  const chkLabel = document.createElement("label");
  chkLabel.style.cssText =
    "display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;";
  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.checked = getAutoReply();
  const chkText = document.createElement("span");
  chkText.textContent = "派單後自動回覆客人";
  chkLabel.appendChild(chk);
  chkLabel.appendChild(chkText);
  // 範本下拉（從快速回覆範本）
  const reps = getReplies();
  const tplSelect = document.createElement("select");
  tplSelect.className = "loe-tpl-select";
  reps.forEach((r, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = r.name || (r.text || "").slice(0, 10);
    tplSelect.appendChild(o);
  });
  let selIdx = reps.findIndex(
    (r) => (r.name || "") === getDispatchTemplate(),
  );
  if (selIdx < 0) selIdx = reps.findIndex((r) => (r.name || "") === "安排");
  if (selIdx < 0) selIdx = 0;
  if (reps.length) tplSelect.value = String(selIdx);
  tplSelect.addEventListener("change", () => {
    const r = reps[Number(tplSelect.value)];
    if (r) setDispatchTemplate(r.name || "");
  });
  const selectedReplyText = () => {
    const r = reps[Number(tplSelect.value)];
    return r ? r.text : "";
  };
  chkWrap.appendChild(chkLabel);
  chkWrap.appendChild(tplSelect);

  const actions = document.createElement("div");
  actions.className = "loe-pop-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "loe-btn-ghost";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", closeDispatchPopover);
  const sendBtn = document.createElement("button");
  sendBtn.className = "loe-btn-primary";
  sendBtn.textContent = "確認";
  sendBtn.addEventListener("click", async () => {
    const address = addrInput.value.trim();
    if (!address) {
      addrInput.focus();
      return;
    }
    // 預覽用的內容不含對話連結；送出時才在最後加上 linechaturl:
    const payload =
      buildDispatchPayload(groupInput.value.trim(), address, currentMemo()) +
      lineUrlSuffix();
    const auto = chk.checked;
    setAutoReply(auto); // 記住選擇
    sendBtn.disabled = true;
    try {
      // 1) 直接派單 API：返回即建單結果（成功=綠、失敗=紅，失敗不回覆客人不標記）
      const api = await tryApiDispatch(payload, notiChk.checked, relayChk.checked);
      if (api) {
        closeDispatchPopover();
        if (api.success) {
          if (auto) autoSendReply(selectedReplyText());
          toast(
            `✅ 派單成功：${api.oriText || ""}` +
              (api.shortId ? `（單號 ${api.shortId}）` : "") +
              (auto ? "，已自動回覆客人" : "") +
              (api.systemNoti ? "，已開系統自動通知" : "") +
              (relayChk.checked && lineUrlSuffix() ? "，已開司機↔客人轉傳" : ""),
            "ok",
            5000,
          );
          if (api.systemNotiWarning)
            window.setTimeout(() => toast("⚠️ " + api.systemNotiWarning, "warn", 8000), 600);
          if (INBOX_MODE) inboxReloadSelectedOrders();
          if (markChk.checked) window.setTimeout(markFollowUp, 500);
        } else {
          // 建單失敗：不自動回覆客人、不標記待處理，避免「已安排」卻沒單
          toast(
            `❌ 派單失敗：${api.message || "未知原因"}`,
            "err",
            8000,
          );
        }
        return;
      }

      // 2) 後端不可達 → fallback webhook 老路（後端掛了無從確認結果，誠實告知請去頻道看）
      const how = await sendForward(payload);
      closeDispatchPopover();
      if (auto) {
        autoSendReply(selectedReplyText());
        toast(
          how === "discord"
            ? "⚠️ 已送出到 Discord，但後端暫時無法確認建單結果，請至頻道確認（已自動回覆客人）"
            : "已複製（未設定 Webhook），並已自動回覆客人",
          how === "discord" ? "warn" : undefined,
          how === "discord" ? 6000 : undefined,
        );
      } else {
        // 不勾選：只送派單，不在輸入框帶入任何訊息
        toast(
          how === "discord"
            ? "⚠️ 已送出到 Discord，但後端暫時無法確認建單結果，請至頻道確認"
            : "已複製（未設定 Webhook）",
          how === "discord" ? "warn" : undefined,
          how === "discord" ? 6000 : undefined,
        );
      }
      // 有勾選「標記待處理」才標記目前這個對話（在自動回覆送出之後）
      if (markChk.checked) window.setTimeout(markFollowUp, 500);
    } catch (err) {
      sendBtn.disabled = false;
      toast("派單失敗：" + (err && err.message ? err.message : "未知錯誤"), "err");
    }
  });
  actions.appendChild(cancelBtn);
  actions.appendChild(sendBtn);

  pop.appendChild(title);
  pop.appendChild(closeX);
  pop.appendChild(groupLabel);
  pop.appendChild(groupInput);
  pop.appendChild(addrLabel);
  pop.appendChild(addrInput);
  pop.appendChild(memoLabel);
  pop.appendChild(memoInput);
  // 勾選同一行
  memoChkWrap.style.marginTop = "0";
  markChkWrap.style.marginTop = "0";
  const checksRow = document.createElement("div");
  checksRow.style.cssText =
    "display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:10px;";
  checksRow.appendChild(memoChkWrap);
  checksRow.appendChild(markChkWrap);
  pop.appendChild(checksRow);
  pop.appendChild(previewLabel);
  pop.appendChild(preview);
  pop.appendChild(notiWrap); // 系統自動通知放在「派單後自動回覆客人」正上方
  pop.appendChild(relayWrap);
  pop.appendChild(chkWrap);
  pop.appendChild(actions);
  document.body.appendChild(pop);
  refreshPreview();

  // 定位：上次拖過就放回同一位置（仍在畫面內才算）；否則貼著按鈕上方、右緣對齊（靠近手的位置），
  // 高度不超過按鈕上方可用空間，避免跑出畫面或抖動
  const W = pop.offsetWidth || 300;
  const H = pop.offsetHeight || 400;
  const saved = dispatchPopPos;
  pop.style.top = "auto";
  if (saved && saved.left + 80 <= window.innerWidth && saved.top + 40 <= window.innerHeight) {
    pop.style.left = Math.max(0, saved.left) + "px";
    pop.style.top = Math.max(0, saved.top) + "px";
    pop.style.maxHeight = Math.max(200, window.innerHeight - saved.top - 12) + "px";
  } else if (anchor) {
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.round(Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8))) + "px";
    pop.style.bottom = Math.round(window.innerHeight - r.top + 8) + "px";
    pop.style.maxHeight = Math.round(r.top - 16) + "px";
  } else {
    pop.style.left = Math.round(window.innerWidth - W - 24) + "px";
    pop.style.top = Math.round(Math.max(12, window.innerHeight - H - 24)) + "px";
    pop.style.maxHeight = window.innerHeight - 24 + "px";
  }
  addrInput.focus();
  // ESC 全域可關（不需焦點在窗內）；capture 搶在 LINE 頁面自身的 ESC 行為前
  document.addEventListener("keydown", dispatchEscHandler, true);
  openDispatchPopover._pop = pop;
}
function addDispatchButton() {
  const group = document.querySelector(".send-group.btn-group");
  if (!group) return;
  if (!group.parentElement.querySelector(`.${DISPATCH_BUTTON_CLASS}`)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = DISPATCH_BUTTON_CLASS;
    btn.title = "派單（填寫上車地址，自動帶入前綴並送到 Discord）";
    btn.insertAdjacentHTML("beforeend", TRUCK_ICON);
    const label = document.createElement("span");
    label.textContent = "派單";
    btn.appendChild(label);
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openDispatchPopover._pop) closeDispatchPopover();
      else openDispatchPopover();
    });
    group.insertAdjacentElement("beforebegin", btn);
  }
}

export { addDispatchButton, closeDispatchPopover, findFollowUpBtn, openDispatchPopover };
