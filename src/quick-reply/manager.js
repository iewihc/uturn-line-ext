// 快速回覆管理視窗（新增／編輯／刪除／排序；車隊統一模板唯讀）。
import { getFleetReplies, getReplies, setReplies } from "../core/store.js";

/* ---------------------------------------------------------------------- *
 * Manager modal (add / edit / delete)
 * ---------------------------------------------------------------------- */
// 一列的名稱＋內容（車隊統一模板與個人模板共用）
function replyRowInfo(r) {
  const info = document.createElement("div");
  info.className = "loe-row-info";
  const nm = document.createElement("div");
  nm.className = "loe-row-name";
  nm.textContent = r.name || "(未命名)";
  const tx = document.createElement("div");
  tx.className = "loe-row-text";
  tx.textContent = r.text;
  info.appendChild(nm);
  info.appendChild(tx);
  return info;
}
function openManager() {
  closeManager();
  let editIndex = -1;

  const mask = document.createElement("div");
  mask.className = "loe-modal-mask";
  mask.addEventListener("click", (e) => {
    if (e.target === mask) closeManager();
  });

  const modal = document.createElement("div");
  modal.className = "loe-modal";

  const head = document.createElement("div");
  head.className = "loe-modal-head";
  head.innerHTML = `<span>快捷回覆管理（個人模板）</span>`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "loe-modal-close";
  closeBtn.textContent = "×";
  closeBtn.title = "關閉";
  closeBtn.addEventListener("click", closeManager);
  head.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "loe-modal-body";

  const list = document.createElement("div");
  list.className = "loe-list";

  const form = document.createElement("div");
  form.className = "loe-form";
  const formTitle = document.createElement("div");
  formTitle.className = "loe-form-title";
  formTitle.textContent = "新增快速回覆";
  const nameInput = document.createElement("input");
  nameInput.className = "loe-input";
  nameInput.placeholder = "名稱（選單顯示用，例如：車來了）";
  const textInput = document.createElement("textarea");
  textInput.className = "loe-textarea";
  textInput.placeholder = "貼上的內容文字";
  const actions = document.createElement("div");
  actions.className = "loe-form-actions";
  const saveBtn = document.createElement("button");
  saveBtn.className = "loe-btn-primary";
  saveBtn.textContent = "新增";
  const cancelEditBtn = document.createElement("button");
  cancelEditBtn.className = "loe-btn-ghost";
  cancelEditBtn.textContent = "取消編輯";
  cancelEditBtn.style.display = "none";
  actions.appendChild(saveBtn);
  actions.appendChild(cancelEditBtn);
  form.appendChild(formTitle);
  form.appendChild(nameInput);
  form.appendChild(textInput);
  form.appendChild(actions);

  function resetForm() {
    editIndex = -1;
    nameInput.value = "";
    textInput.value = "";
    formTitle.textContent = "新增快速回覆";
    saveBtn.textContent = "新增";
    cancelEditBtn.style.display = "none";
  }
  cancelEditBtn.addEventListener("click", resetForm);

  function renderList() {
    const replies = getReplies();
    list.textContent = "";
    // 車隊統一模板（後台維護，唯讀）——僅展示，不能編輯/刪除
    const fleetReps = getFleetReplies();
    if (fleetReps.length) {
      const note = document.createElement("div");
      note.className = "loe-mgr-fleet-note";
      note.textContent = "車隊統一模板（後台維護，唯讀）";
      list.appendChild(note);
      fleetReps.forEach((r) => {
        const row = document.createElement("div");
        row.className = "loe-row loe-row-fleet";
        const info = replyRowInfo(r);
        row.appendChild(info);
        list.appendChild(row);
      });
      const sep = document.createElement("div");
      sep.className = "loe-mgr-fleet-note";
      sep.textContent = "個人模板（可編輯）";
      list.appendChild(sep);
    }
    if (!replies.length) {
      const empty = document.createElement("div");
      empty.className = "loe-qr-empty";
      empty.textContent = "尚無項目";
      list.appendChild(empty);
      return;
    }
    replies.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "loe-row";
      const info = replyRowInfo(r);
      const act = document.createElement("div");
      act.className = "loe-row-actions";
      const up = document.createElement("button");
      up.className = "loe-mini";
      up.textContent = "↑";
      up.title = "上移";
      up.disabled = i === 0;
      up.addEventListener("click", () => {
        const arr = getReplies();
        if (i > 0) {
          [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
          setReplies(arr);
          renderList();
        }
      });
      const down = document.createElement("button");
      down.className = "loe-mini";
      down.textContent = "↓";
      down.title = "下移";
      down.disabled = i === replies.length - 1;
      down.addEventListener("click", () => {
        const arr = getReplies();
        if (i < arr.length - 1) {
          [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
          setReplies(arr);
          renderList();
        }
      });
      const ed = document.createElement("button");
      ed.className = "loe-mini";
      ed.textContent = "編輯";
      ed.addEventListener("click", () => {
        editIndex = i;
        nameInput.value = r.name || "";
        textInput.value = r.text || "";
        formTitle.textContent = "編輯快速回覆";
        saveBtn.textContent = "更新";
        cancelEditBtn.style.display = "";
        nameInput.focus();
      });
      const del = document.createElement("button");
      del.className = "loe-mini danger";
      del.textContent = "刪除";
      del.addEventListener("click", () => {
        const arr = getReplies();
        arr.splice(i, 1);
        setReplies(arr);
        if (editIndex === i) resetForm();
        renderList();
      });
      act.appendChild(up);
      act.appendChild(down);
      act.appendChild(ed);
      act.appendChild(del);
      row.appendChild(info);
      row.appendChild(act);
      list.appendChild(row);
    });
  }

  saveBtn.addEventListener("click", () => {
    const text = textInput.value.trim();
    if (!text) {
      textInput.focus();
      return;
    }
    const name = nameInput.value.trim() || text.slice(0, 12);
    const arr = getReplies();
    if (editIndex >= 0 && editIndex < arr.length) {
      arr[editIndex] = { name, text };
    } else {
      arr.push({ name, text });
    }
    setReplies(arr);
    resetForm();
    renderList();
  });

  const listHint = document.createElement("div");
  listHint.className = "loe-qr-empty";
  listHint.style.cssText = "text-align:left;padding:0 0 8px;color:#94a3b8;";
  listHint.textContent =
    "用 ↑ ↓ 調整順序；對話框上方會顯示全部（可左右滑動）。";
  body.appendChild(listHint);
  body.appendChild(list);
  body.appendChild(form);
  modal.appendChild(head);
  modal.appendChild(body);
  mask.appendChild(modal);
  document.body.appendChild(mask);
  renderList();
  nameInput.focus();

  mask._loeEsc = (e) => {
    if (e.key === "Escape") closeManager();
  };
  document.addEventListener("keydown", mask._loeEsc);
  openManager._mask = mask;
}
function closeManager() {
  const mask = openManager._mask;
  if (mask) {
    if (mask._loeEsc) document.removeEventListener("keydown", mask._loeEsc);
    mask.remove();
    openManager._mask = null;
  }
}

export { openManager };
