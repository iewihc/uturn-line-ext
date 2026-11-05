// $ 餘額紀錄（聊天窗帳本）：以 chatId 為鍵存後端，$ 按鈕顯示餘額、視窗新增項目。
import { httpGetJson, httpSendJson } from "./core/backend.js";
import { API_BASE } from "./core/constants.js";
import { getChatId, getCustomerName } from "./core/page-context.js";
import { getDispatcher } from "./settings.js";
import { toast } from "./ui/toast.js";

/* ---------------------------------------------------------------------- *
 * $ 餘額紀錄（聊天窗帳本）——以 chatId 為鍵存在後端，所有操作員共享。
 * ---------------------------------------------------------------------- */
const LEDGER_BUTTON_CLASS = "loe-ledger-button";
// $ 按鈕直接顯示當前對話餘額（延遲載入，不卡主 render；失敗保持 "$" 不重試轟炸）
let ledgerBalSeq = 0;
let ledgerBalNextTryAt = 0;
function updateLedgerButtonsText(chatId, balance) {
  document.querySelectorAll(`.${LEDGER_BUTTON_CLASS}`).forEach((b) => {
    b.dataset.loeChat = chatId;
    b.dataset.loeLoaded = "1";
    b.textContent =
      typeof balance === "number" ? `$${balance.toLocaleString()}` : "$";
  });
}
function refreshLedgerBalance(force) {
  const btn = document.querySelector(`.${LEDGER_BUTTON_CLASS}`);
  if (!btn) return;
  const chatId = getChatId();
  if (!chatId) return;
  if (!force && btn.dataset.loeChat === chatId && btn.dataset.loeLoaded === "1")
    return;
  if (!force && Date.now() < ledgerBalNextTryAt) return;
  // 換了對話先退回 "$"，避免短暫顯示上一個客戶的餘額
  if (btn.dataset.loeChat !== chatId) {
    document.querySelectorAll(`.${LEDGER_BUTTON_CLASS}`).forEach((b) => {
      b.dataset.loeChat = chatId;
      delete b.dataset.loeLoaded;
      b.textContent = "$";
    });
  }
  ledgerBalNextTryAt = Date.now() + 10000;
  const seq = ++ledgerBalSeq;
  httpGetJson(
    `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}&t=${Date.now()}`,
  )
    .then((data) => {
      if (seq !== ledgerBalSeq || getChatId() !== chatId) return;
      ledgerBalNextTryAt = 0;
      updateLedgerButtonsText(
        chatId,
        data && typeof data.balance === "number" ? data.balance : 0,
      );
    })
    .catch(() => {
      /* 失敗保持 "$"，10 秒後才允許再試 */
    });
}
function scheduleLedgerBalanceRefresh() {
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(() => refreshLedgerBalance(), { timeout: 2000 });
  else setTimeout(() => refreshLedgerBalance(), 800);
}
function closeLedger() {
  const m = document.querySelector(".loe-ledger-mask");
  if (m) m.remove();
  document.removeEventListener("keydown", ledgerEscHandler, true);
}
function ledgerEscHandler(e) {
  if (e.key === "Escape") {
    e.stopPropagation();
    closeLedger();
  }
}
function fmtLedgerDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function openLedger() {
  const chatId = getChatId();
  if (!chatId) {
    toast("請先進入某個對話再開啟餘額紀錄");
    return;
  }
  closeLedger();
  const mask = document.createElement("div");
  mask.className = "loe-modal-mask loe-ledger-mask";
  mask.addEventListener("click", (e) => {
    if (e.target === mask) closeLedger();
  });
  const modal = document.createElement("div");
  modal.className = "loe-modal";
  modal.addEventListener("click", (e) => e.stopPropagation());
  const head = document.createElement("div");
  head.className = "loe-modal-head";
  const custName = getCustomerName();
  head.innerHTML = "<span></span>";
  head.querySelector("span").textContent = custName
    ? `餘額紀錄｜${custName}`
    : "餘額紀錄";
  const closeBtn = document.createElement("button");
  closeBtn.className = "loe-modal-close";
  closeBtn.textContent = "×";
  closeBtn.title = "關閉";
  closeBtn.addEventListener("click", closeLedger);
  head.appendChild(closeBtn);
  const body = document.createElement("div");
  body.className = "loe-modal-body";

  const balanceEl = document.createElement("div");
  balanceEl.className = "loe-ledger-balance";
  balanceEl.textContent = "當前餘額：載入中…";
  const list = document.createElement("div");
  list.className = "loe-list";

  function render(data) {
    balanceEl.textContent = `當前餘額：${data.balance}`;
    updateLedgerButtonsText(chatId, data.balance);
    list.textContent = "";
    (data.records || []).forEach((r) => {
      const row = document.createElement("div");
      row.className = "loe-ledger-row";
      const left = document.createElement("span");
      left.textContent = r.item;
      const right = document.createElement("span");
      right.style.display = "inline-flex";
      right.style.alignItems = "center";
      const amt = document.createElement("span");
      amt.className = r.amount >= 0 ? "loe-amt-pos" : "loe-amt-neg";
      amt.textContent = (r.amount > 0 ? "+" : "") + r.amount;
      const date = document.createElement("span");
      date.className = "loe-ledger-date";
      date.textContent =
        fmtLedgerDate(r.createdAt) + (r.by ? ` ${r.by}` : "");
      const del = document.createElement("button");
      del.type = "button";
      del.className = "loe-ledger-del";
      del.textContent = "×";
      del.title = "刪除此筆（會回沖餘額）";
      del.addEventListener("click", async () => {
        if (!confirm(`刪除「${r.item} ${r.amount > 0 ? "+" : ""}${r.amount}」？餘額將回沖。`)) return;
        try {
          const updated = await httpSendJson(
            "DELETE",
            `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}&recordId=${encodeURIComponent(r.id)}`,
          );
          render(updated);
          toast("已刪除並回沖餘額");
        } catch (err) {
          toast(`刪除失敗（${(err && err.message) || "網路錯誤"}）`);
        }
      });
      right.appendChild(amt);
      right.appendChild(date);
      right.appendChild(del);
      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });
    if (!(data.records || []).length) {
      const empty = document.createElement("div");
      empty.style.color = "#94a3b8";
      empty.textContent = "尚無紀錄";
      list.appendChild(empty);
    }
  }

  // 新增表單：項目 / 種類(+−) / 金額
  const form = document.createElement("div");
  form.className = "loe-form";
  const formTitle = document.createElement("div");
  formTitle.className = "loe-form-title";
  formTitle.textContent = "新增紀錄";
  const itemInput = document.createElement("input");
  itemInput.className = "loe-input";
  itemInput.placeholder = "項目（例如：儲值、乘車扣）";
  const rowEl = document.createElement("div");
  rowEl.className = "loe-ledger-formrow";
  const signSel = document.createElement("select");
  signSel.className = "loe-input";
  [["+", "+"], ["-", "−"]].forEach(([v, label]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    signSel.appendChild(o);
  });
  const amtInput = document.createElement("input");
  amtInput.className = "loe-input loe-amt";
  amtInput.type = "number";
  amtInput.min = "1";
  amtInput.placeholder = "金額（例如 100）";
  rowEl.appendChild(signSel);
  rowEl.appendChild(amtInput);
  const actions = document.createElement("div");
  actions.className = "loe-form-actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "loe-btn-primary";
  saveBtn.textContent = "新增";
  actions.appendChild(saveBtn);
  form.appendChild(formTitle);
  form.appendChild(itemInput);
  form.appendChild(rowEl);
  form.appendChild(actions);

  saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const item = itemInput.value.trim();
    const raw = Math.abs(Number(amtInput.value));
    if (!item) {
      toast("請填寫項目");
      return;
    }
    if (!raw || !isFinite(raw)) {
      toast("請填寫正確的金額");
      return;
    }
    const amount = signSel.value === "-" ? -raw : raw;
    saveBtn.disabled = true;
    try {
      const data = await httpSendJson(
        "POST",
        `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}`,
        { item, amount, by: getDispatcher() || "" },
      );
      render(data);
      itemInput.value = "";
      amtInput.value = "";
      toast(`已新增：${item} ${amount > 0 ? "+" : ""}${amount}`);
    } catch (err) {
      toast(`新增失敗（${(err && err.message) || "網路錯誤"}），請稍後再試`);
    } finally {
      saveBtn.disabled = false;
    }
  });

  body.appendChild(balanceEl);
  body.appendChild(list);
  body.appendChild(form);
  modal.appendChild(head);
  modal.appendChild(body);
  mask.appendChild(modal);
  document.body.appendChild(mask);
  document.addEventListener("keydown", ledgerEscHandler, true);

  httpGetJson(
    `${API_BASE}/line-chat-ledger?chatId=${encodeURIComponent(chatId)}&t=${Date.now()}`,
  )
    .then(render)
    .catch((err) => {
      balanceEl.textContent = `載入失敗（${(err && err.message) || "網路錯誤"}）`;
    });
}
function addLedgerButton(phoneLink) {
  if (
    !phoneLink ||
    phoneLink.parentElement.querySelector(`.${LEDGER_BUTTON_CLASS}`)
  )
    return;
  const button = document.createElement("a");
  button.href = "#";
  button.role = "button";
  button.className = `mr-2 ${LEDGER_BUTTON_CLASS}`;
  button.setAttribute("aria-label", "餘額紀錄");
  button.title = "餘額紀錄（此對話）";
  button.textContent = "$";
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openLedger();
  });
  phoneLink.insertAdjacentElement("afterend", button);
  scheduleLedgerBalanceRefresh();
}

export { addLedgerButton, refreshLedgerBalance };
