// 轉發：組「前綴＋地址」送 Discord webhook 或後端派單 API，每則地址訊息旁的轉發鈕。
import { API_BASE, FORWARD_BUTTON_CLASS } from "./core/constants.js";
import { FORWARD_ICON } from "./core/icons.js";
import { openDispatchPopover } from "./dispatch.js";
import { getDispatcher, getWebhook } from "./settings.js";
import { copyText } from "./ui/copy.js";
import { httpSendJson } from "./core/backend.js";

/* ---------------------------------------------------------------------- *
 * Forward (轉發) — 地址訊息專用
 * ---------------------------------------------------------------------- *
 * 目前動作為「組好『前綴 + 地址』並複製到剪貼簿 + 顯示提示」。
 * 之後要改成送到 Discord 等服務時，只要改寫 sendForward() 即可。
 */
// 送到 Discord webhook（用 GM_xmlhttpRequest 以避開 CORS）；沒設定則複製到剪貼簿
function postToDiscord(url, content) {
  // 帶上派單人員 → 顯示為該則訊息的發送者（webhook username 覆寫，後端不需改動）
  const body = { content };
  const who = getDispatcher();
  if (who) body.username = who;
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest === "function") {
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(body),
        onload: (res) =>
          res.status >= 200 && res.status < 300
            ? resolve()
            : reject(new Error("HTTP " + res.status)),
        onerror: () => reject(new Error("network")),
        ontimeout: () => reject(new Error("timeout")),
      });
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) =>
          r.ok ? resolve() : reject(new Error("HTTP " + r.status)),
        )
        .catch(reject);
    }
  });
}
/* 直接派單（API 優先）：後端同步建單、返回即結果。
 * 回 null = 後端不可達（網路錯誤 / 404 舊後端 / 5xx）→ caller fallback 到 webhook 老路；
 * 回物件（含 success:false 業務失敗）= 明確結果，不再 fallback（避免失敗單被 webhook 重複派出）。 */
async function tryApiDispatch(payload, isSystemNoti) {
  try {
    return await httpSendJson("POST", `${API_BASE}/line-dispatch`, {
      text: payload,
      dispatcher: getDispatcher(),
      isSystemNoti: !!isSystemNoti,
    });
  } catch (e) {
    return null;
  }
}
async function sendForward(payload) {
  const url = getWebhook();
  if (url) {
    await postToDiscord(url, payload);
    return "discord";
  }
  await copyText(payload);
  return "clipboard";
}
function addForwardButton(bubble, textNode) {
  if (bubble.querySelector(`.${FORWARD_BUTTON_CLASS}`)) return;
  // 不論是否地址類型，所有文字訊息都加上「轉發」
  textNode.classList.add("loe-has-forward");
  const fwd = document.createElement("button");
  fwd.type = "button";
  fwd.className = FORWARD_BUTTON_CLASS;
  fwd.innerHTML = FORWARD_ICON;
  fwd.setAttribute("aria-label", "帶入派單");
  fwd.setAttribute("data-loe-tip", "派單");
  fwd.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 轉發＝開啟「派單」視窗，把這則訊息內容帶入「上車地址」；送出派單才會呼叫 Discord
    openDispatchPopover(textNode.innerText.trim());
  });
  bubble.appendChild(fwd);
}

export { addForwardButton, sendForward, tryApiDispatch };
