// 複製文字到剪貼簿與「已複製」回饋。
import { COPIED_CLASS } from "../core/constants.js";
import { CHECK_ICON, COPY_ICON, ERROR_ICON } from "../core/icons.js";

/* ---------------------------------------------------------------------- *
 * Copy
 * ---------------------------------------------------------------------- */
function getMessageText(chatBody) {
  const node =
    chatBody.querySelector("[data-copy-target].chat-item-text") ||
    chatBody.querySelector(".chat-item-text") ||
    chatBody.querySelector(".chat-item-loc .small"); // 位置訊息：地址在這
  return node ? node.innerText.trim() : "";
}
async function copyText(text) {
  if (!text) return false;
  if (typeof GM_setClipboard === "function") {
    GM_setClipboard(text, "text");
    return true;
  }
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  return ok;
}
function flashCopied(button, ok) {
  button.innerHTML = ok ? CHECK_ICON : ERROR_ICON;
  button.classList.toggle(COPIED_CLASS, ok);
  window.setTimeout(() => {
    button.innerHTML = COPY_ICON;
    button.classList.remove(COPIED_CLASS);
  }, 1000);
}

export { copyText, flashCopied, getMessageText };
