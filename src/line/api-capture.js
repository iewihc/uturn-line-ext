// 身份授權：手動擷取 LINE 後台的 Cookie（ses、__Host-chat-ses、XSRF-TOKEN）送後端。
import { getChatId, getOaId } from "../core/page-context.js";

/* ---------------------------------------------------------------------- *\
 * Python 發送參數：只在按鈕／選單點擊時擷取，列印 url 與三個必要 Cookie。
 * 手動擷取；身份授權按鈕送到指定後端帳號，不列印憑證。
 * 不將 Cookie 寫入 GM 設定儲存或其他同步管道。
 * document.cookie 看不到 HttpOnly；GM_cookie 是否支援取決於擴充版本與權限。
 * https://www.tampermonkey.net/documentation.php?q=GM_cookie
 * ---------------------------------------------------------------------- */
const LINE_API_COOKIE_NAMES = ["ses", "__Host-chat-ses", "XSRF-TOKEN"];
let lineApiDebugRun = 0;
function invalidateLineApiCapture() { ++lineApiDebugRun; } // 換對話只讓進行中的擷取失效
async function readLineApiCookies(url) {
  let cookies = [];
  let cookieReadError = "";
  try {
    if (
      typeof GM_cookie === "undefined" ||
      typeof GM_cookie.list !== "function"
    )
      throw new Error("GM_cookie.list 不可用");
    const items = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("讀取 Cookie 逾時")), 3000);
      try {
        // 不指定 partitionKey 時會漏掉分區 Cookie。
        // HttpOnly 仍須使用者在 Tampermonkey 的 Cookie 存取設定中允許。
        GM_cookie.list({ url, partitionKey: {} }, (items, error) => {
          clearTimeout(timer);
          if (error) reject(new Error(String(error)));
          else if (!Array.isArray(items))
            reject(new Error("Cookie 回傳格式不符"));
          else resolve(items);
        });
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
    // 空 partitionKey 會包含其他頂層網站的分區；只保留 LINE 本頁適用的。
    cookies = items.filter((cookie) => {
      const key = cookie.partitionKey;
      return (
        LINE_API_COOKIE_NAMES.includes(cookie.name) &&
        (!key ||
          (["https://line.biz", "https://chat.line.biz"].includes(key.topLevelSite) &&
            key.hasCrossSiteAncestor !== true))
      );
    });
  } catch (error) {
    cookieReadError = String(error.message || error);
  }
  try {
    const readableCookies = document.cookie.split(";").flatMap((part) => {
      const pair = part.trim();
      const eq = pair.indexOf("=");
      return eq > 0
        ? [{ name: pair.slice(0, eq), value: pair.slice(eq + 1) }]
        : [];
    });
    // GM 回傳部分結果時也補讀可見的登入欄位，不覆蓋 API URL 的 Cookie。
    const missingReadable = readableCookies.filter(
      ({ name }) =>
        LINE_API_COOKIE_NAMES.includes(name) &&
        !cookies.some((cookie) => cookie.name === name),
    );
    cookies.push(...missingReadable);
  } catch (error) {
    cookieReadError = [cookieReadError, "document.cookie：" + String(error.message || error)]
      .filter(Boolean)
      .join("；");
  }
  return { cookies, cookieReadError };
}
// botIdOverride：收件匣網址沒有官方帳號，由呼叫端指定一個（只用來組讀 Cookie 的網址）
async function captureLineApiParams(botIdOverride) {
  if (location.hostname !== "chat.line.biz" || window.top !== window.self) return;
  const pathname = location.pathname;
  const botId = botIdOverride || getOaId();
  const chatId = getChatId();
  if (!/^U[0-9a-f]{32}$/i.test(botId)) return;
  const run = ++lineApiDebugRun;
  try {
    const requestUrl = chatId
      ? `${location.origin}/api/v1/bots/${botId}/chats/${encodeURIComponent(chatId)}/messages/send`
      : `${location.origin}/api/v2/bots/${botId}/chats`;
    const { cookies, cookieReadError } = await readLineApiCookies(requestUrl);
    // 讀 Cookie 是非同步的，期間換人或重新擷取就丟棄舊結果。
    if (run !== lineApiDebugRun || pathname !== location.pathname) return;
    const cookieValue = (name) => {
      const cookie = cookies.find((item) => item.name === name);
      return cookie ? cookie.value : "";
    };
    const missingCookies = LINE_API_COOKIE_NAMES.filter(
      (name) => !cookieValue(name),
    );
    const snapshot = {
      params: {
        url: chatId
          ? `${location.origin}/${botId}/chat/${encodeURIComponent(chatId)}`
          : null,
        Cookie: LINE_API_COOKIE_NAMES.filter((name) => cookieValue(name))
          .map((name) => `${name}=${cookieValue(name)}`)
          .join("; "),
      },
      cookieReadError,
      missingCookies,
    };
    return snapshot;
  } catch (_) { return; }
}

export { captureLineApiParams, invalidateLineApiCapture };
