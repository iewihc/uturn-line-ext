// UTurn 後端請求（GM_xmlhttpRequest）、身份授權的發送 KEY、line-ext API。
import { API_BASE, SEND_KEY_STORE_PREFIX } from "./constants.js";
import { getOaId, getOaName } from "./page-context.js";
import { storeGet, storeSet } from "./store.js";
import { captureLineApiParams } from "../line/api-capture.js";
import { lineDisplayMessage, lineRequestError } from "../line/content.js";
import { getDispatcher } from "../settings.js";

function lineBackendRequest(method, path, body, signal, extraHeaders = {}) {
  const multipart = body instanceof FormData;
  return new Promise((resolve, reject) => {
    let request;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener("abort", abort);
      callback(value);
    };
    const abort = () => {
      finish(reject, new DOMException("已取消", "AbortError"));
      if (request) request.abort();
    };
    if (signal?.aborted) return abort();
    if (typeof GM_xmlhttpRequest !== "function")
      return finish(reject, new Error("Tampermonkey 網路請求功能不可用"));
    if (signal) signal.addEventListener("abort", abort, { once: true });
    try {
      request = GM_xmlhttpRequest({
        method,
        url: API_BASE + path,
        headers: {
          Accept: "application/json, application/problem+json",
          ...(body === undefined || multipart ? {} : { "Content-Type": "application/json" }),
          ...extraHeaders,
        },
        // GM_xmlhttpRequest 支援 FormData，由 Tampermonkey 產生 multipart boundary。
        data: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
        timeout: multipart ? 120000 : 30000,
        onload: (response) => {
          if (response.status < 200 || response.status >= 300) {
            let problem;
            try { problem = JSON.parse(response.responseText); } catch (_) {}
            const fallback = response.status === 404
              ? (path.startsWith("/line-ext-cookie")
                ? "後台帳號不存在，請檢查轉發設定裡的後台帳號"
                : "此官方帳號尚未列入懶惰蟲配置，請聯絡後台確認")
              : response.status === 413 ? (multipart ? "圖片超過後端可接收的大小，請縮小後重新選圖" : "請求超過後端可接收的大小")
              : response.status === 422 ? "資料格式不符，後端未接受這次請求"
              : `後端回應 HTTP ${response.status}`;
            const message = lineDisplayMessage(typeof problem?.detail === "string" && problem.detail ? problem.detail : fallback);
            return finish(reject, lineRequestError(message, response.status,
              typeof problem?.code === "string" ? problem.code : "", response.status >= 500 || !response.status));
          }
          try {
            finish(resolve, response.status === 204 && !response.responseText ? null : JSON.parse(response.responseText));
          } catch (_) {
            finish(reject, lineRequestError("後端回應不是有效 JSON，尚未確認是否完成", response.status, "", true));
          }
        },
        onerror: () => finish(reject, lineRequestError("無法連線到後端，尚未確認是否完成", 0, "", true)),
        ontimeout: () => finish(reject, lineRequestError("請求逾時，尚未確認後端是否完成", 0, "", true)),
        onabort: () => finish(reject, new DOMException("已取消", "AbortError")),
      });
    } catch (_) {
      // 不將含 Cookie 的請求物件或例外細節寫入 Console。
      finish(reject, new Error("無法建立後端請求"));
    }
  });
}
const SEND_KEY_PATTERN = /^[\x21-\x7e]{1,512}$/;
const sendKeyStoreKey = (account) => SEND_KEY_STORE_PREFIX + encodeURIComponent(account);
// 身份授權通過後存的發送 KEY；沒有或格式不符回空字串。
function storedSendKey(account) {
  const key = account ? storeGet(sendKeyStoreKey(account), "") : "";
  return typeof key === "string" && SEND_KEY_PATTERN.test(key) ? key : "";
}
// 身份授權時輸入發送 KEY（預填此帳號已存的 KEY，可直接確認）；取消回 null。
function askSendKey(account) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "loe-customers-dialog loe-key-dialog";
    dialog.setAttribute("aria-labelledby", "loe-auth-title");
    dialog.innerHTML = `
        <div class="loe-modal-head"><span id="loe-auth-title">身份授權</span><button type="button" class="loe-modal-close" aria-label="取消身份授權">×</button></div>
        <form class="loe-modal-body">
          <label for="loe-auth-key">後台帳號 <strong data-role="account"></strong> 的發送 KEY</label>
          <div class="loe-send-key-row"><input id="loe-auth-key" class="loe-input" type="password" autocomplete="off" spellcheck="false" autocapitalize="none" placeholder="貼上後台發放的 KEY"><button class="loe-mini" type="button" data-role="toggle" aria-label="顯示發送 KEY" aria-pressed="false">顯示</button></div>
          <div class="loe-customers-muted">KEY 由後台發放，有效期一個月。授權後會記在此瀏覽器，傳送時自動帶入，不必再輸入。</div>
          <div class="loe-customers-muted" data-role="error" role="alert"></div>
          <button class="loe-btn-primary" type="submit">授權</button>
        </form>`;
    const input = dialog.querySelector("#loe-auth-key");
    const toggle = dialog.querySelector('[data-role="toggle"]');
    dialog.querySelector('[data-role="account"]').textContent = account;
    input.value = storedSendKey(account);
    let result = null;
    toggle.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      toggle.textContent = show ? "隱藏" : "顯示";
      toggle.setAttribute("aria-label", `${show ? "隱藏" : "顯示"}發送 KEY`);
      toggle.setAttribute("aria-pressed", String(show));
    });
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const key = input.value.trim();
      if (!SEND_KEY_PATTERN.test(key)) {
        dialog.querySelector('[data-role="error"]').textContent = key ? "KEY 格式不符，請重新貼上後台發放的 KEY。" : "請輸入後台發放的發送 KEY。";
        return;
      }
      result = key;
      dialog.close();
    });
    dialog.querySelector(".loe-modal-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { input.value = ""; dialog.remove(); resolve(result); }, { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
    input.focus();
  });
}
// 身份授權：輸入發送 KEY → 擷取 LINE cookie → 後端驗 KEY 通過才存 cookie → KEY 記在本機。取消回 { cancelled: true }。
// botId：收件匣指定用哪個官方帳號讀 Cookie（同一個 LINE 登入，哪個帳號都一樣）；沒給就用目前頁面的帳號。
async function saveLineCookie(botId) {
  const account = getDispatcher();
  const groupId = botId || getOaId();
  if (!account) throw new Error("請先在轉發設定填寫後台帳號");
  const changed = () => getDispatcher() !== account || (!botId && getOaId() !== groupId);
  const key = await askSendKey(account);
  if (key === null) return { cancelled: true };
  if (changed()) throw new Error("帳號已變更，請在目前帳號重新操作");
  const snapshot = await captureLineApiParams(groupId);
  if (!snapshot) throw new Error("Cookie 未擷取完成，請重試");
  if (changed()) throw new Error("帳號已變更，請在目前帳號重新操作");
  if (snapshot.missingCookies.length)
    throw new Error("缺少 " + snapshot.missingCookies.join(", ") +
      "；請在 Tampermonkey 進階設定將 Allow scripts to access cookies 設為 All，儲存後重新整理");
  const result = await lineBackendRequest("PUT",
    `/line-ext-cookie?account=${encodeURIComponent(account)}`,
    { extCookie: snapshot.params.Cookie }, undefined, { "X-Line-Send-Key": key });
  if (!result || result.account !== account || result.updated !== true)
    throw new Error("後端尚未確認 Cookie 儲存成功");
  storeSet(sendKeyStoreKey(account), key);
  window.dispatchEvent(new Event("loe-line-auth-saved")); // 授權失效提示馬上重查（auth-health.js）
  return result;
}
const lineAuthDoneText = (result) =>
  `已授權至 ${result.account}` + (result.keyExpiresAt ? `（KEY 到期 ${new Date(result.keyExpiresAt).toLocaleDateString("zh-TW")}）` : "");
// 誰同步的：帶後台帳號（沒設就不帶）；官方帳號名稱讓後端對到 AI 官方帳號、自動記下官方後台編號
// （之後後台「開官方聊天室」就能直接開）。同步客戶與同步記事本共用。
function lineSyncHeaders() {
  const syncedBy = getDispatcher();
  const oaName = getOaName();
  const headers = {};
  if (syncedBy) headers["X-Synced-By"] = encodeURIComponent(syncedBy);
  if (oaName) headers["X-Oa-Name"] = encodeURIComponent(oaName);
  return headers;
}
// GM_xmlhttpRequest 的 JSON 包裝（15 秒逾時）：2xx 解析 JSON；410 丟 { gone: true }（一次性 token 已用／過期）。
function gmJsonRequest(method, url, bodyObj) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== "function")
      return reject(new Error("no GM_xmlhttpRequest"));
    const headers = { Accept: "application/json" };
    if (method !== "GET") headers["Content-Type"] = "application/json";
    GM_xmlhttpRequest({
      method,
      url,
      headers,
      data: bodyObj == null ? undefined : JSON.stringify(bodyObj),
      timeout: 15000,
      onload: (res) => {
        if (res.status >= 200 && res.status < 300) {
          try {
            resolve(JSON.parse(res.responseText));
          } catch (e) {
            reject(e);
          }
        } else if (res.status === 410)
          reject(Object.assign(new Error("gone"), { gone: true }));
        else reject(new Error("HTTP " + res.status));
      },
      onerror: () => reject(new Error("network")),
      ontimeout: () => reject(new Error("timeout")),
    });
  });
}
const httpGetJson = (url) => gmJsonRequest("GET", url);
const httpSendJson = (method, url, bodyObj) => gmJsonRequest(method, url, bodyObj);
/* 懶惰蟲訂單端點（發送 KEY＋這個後台帳號看得到這張單才放行）：
 *   …/driver-chat…（司機對話）；PUT …/system-noti {enabled}；POST …/cancel */
function lineExtApi(method, path, body, query = "") {
  const account = getDispatcher();
  const key = storedSendKey(account);
  if (!account || !key)
    return Promise.reject(new Error("請先在懶惰蟲完成「身份授權」"));
  return lineBackendRequest(method, `${path}?account=${encodeURIComponent(account)}${query}`, body, undefined, { "X-Line-Send-Key": key });
}
const hasLineExtAuth = () => { const account = getDispatcher(); return !!(account && storedSendKey(account)); };
const lineExtOrderApi = (method, orderId, sub, body, query = "") =>
  lineExtApi(method, `/line-ext/orders/${encodeURIComponent(orderId)}${sub}`, body, query);

export { hasLineExtAuth, httpGetJson, httpSendJson, lineAuthDoneText, lineBackendRequest, lineExtApi, lineExtOrderApi, lineSyncHeaders, saveLineCookie, storedSendKey };
