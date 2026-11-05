// LINE 的優惠券與多頁訊息清單、錯誤訊息文字。
import { fetchLineDirectoryPage } from "./fetch.js";

/* ---------------------------------------------------------------------- *\
 * 後端 Cookie／名單同步與客戶選取。只有使用者點擊才寫入後端。
 * 選圖先上傳原圖；文字、圖片、優惠券、多頁訊息按傳送後才建立作業。
 * ---------------------------------------------------------------------- */
const LINE_CUSTOMER_PAGE_SIZE = 50;
const LINE_RECIPIENT_LIMIT = 50000;
// LINE 原生選擇器使用 page=1 起算、每頁 25 張，沒有 next 游標。
async function fetchLineCoupons(groupId, controller) {
  const coupons = new Map();
  const run = { controller };
  for (let page = 1; page <= 200; page++) {
    const url = new URL(`/api/v1/bots/${encodeURIComponent(groupId)}/coupons`, location.origin);
    url.search = new URLSearchParams({ page: String(page), pageSize: "25" });
    const data = await fetchLineDirectoryPage(url, run);
    if (data.list.length > 25) throw new Error("優惠券分頁格式不符，請重新讀取");
    for (const coupon of data.list) {
      if (!Number.isSafeInteger(coupon?.couponId) || coupon.couponId <= 0 ||
          typeof coupon.title !== "string" || typeof coupon.status !== "string" ||
          !Number.isFinite(coupon.startTime) || !Number.isFinite(coupon.endTime) ||
          coupons.has(coupon.couponId))
        throw new Error("優惠券清單不完整或有重複資料，請重新讀取");
      coupons.set(coupon.couponId, coupon);
    }
    if (data.list.length < 25) return [...coupons.values()];
  }
  throw new Error("優惠券分頁超過讀取上限，未套用清單");
}
function lineCouponAvailable(coupon) {
  return coupon?.status === "AVAILABLE" && coupon.startTime <= Date.now() && coupon.endTime > Date.now();
}
function lineCardPages(card) {
  const contents = card?.messageObject?.contents;
  if (card?.messageObject?.type !== "flex") return [];
  if (contents?.type === "bubble") return [contents];
  return contents?.type === "carousel" && Array.isArray(contents.contents) &&
    contents.contents.every(page => page?.type === "bubble") ? contents.contents : [];
}
async function fetchLineCardMessages(groupId, controller) {
  const cards = new Map(), cursors = new Set();
  let next = "", total = null;
  for (let page = 0; page < 2000; page++) {
    const url = new URL(`/api/v1/bots/${encodeURIComponent(groupId)}/cardTypeMessages`, location.origin);
    url.searchParams.set("limit", "25");
    if (next) url.searchParams.set("next", next);
    const data = await fetchLineDirectoryPage(url, { controller });
    if (data.list.length > 25 || !Number.isSafeInteger(data.total) || data.total < 0 ||
        (total !== null && total !== data.total) || (data.next != null && typeof data.next !== "string"))
      throw new Error("多頁訊息分頁資料已變動或格式不符，請重新讀取");
    total = data.total;
    for (const card of data.list) {
      if (!Number.isSafeInteger(card?.id) || card.id <= 0 || typeof card.title !== "string" ||
          !lineCardPages(card).length || cards.has(card.id))
        throw new Error("多頁訊息清單不完整或有重複資料，請重新讀取");
      cards.set(card.id, card);
    }
    // 實測最後一筆仍可能帶 next；不能因短頁或已達 total 就停止。
    next = data.next || "";
    if (!next) {
      if (cards.size !== total) throw new Error("多頁訊息總數不符，請重新讀取");
      return [...cards.values()];
    }
    if (!data.list.length || cards.size > total || cursors.has(next))
      throw new Error("多頁訊息分頁未前進，請重新讀取");
    cursors.add(next);
  }
  throw new Error("多頁訊息分頁超過讀取上限，未套用清單");
}
// 僅產生安全的圖片／文字摘要；不執行卡片中的 action 或插入 HTML。
function lineCardPageSummary(page) {
  const texts = [], images = [];
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 30) return;
    if (node.type === "text" && typeof node.text === "string") texts.push(node.text);
    if (node.type === "image" && typeof node.url === "string") {
      try { const url = new URL(node.url); if (url.protocol === "https:") images.push(url.href); } catch (_) {}
    }
    if (Array.isArray(node.contents)) node.contents.forEach(child => visit(child, depth + 1));
    for (const key of ["header", "hero", "body", "footer"]) visit(node[key], depth + 1);
  };
  visit(page);
  return { text: [...new Set(texts)].join("\n"), image: images[0] || "" };
}
function lineRequestError(message, status = 0, code = "", uncertain = false) {
  return Object.assign(new Error(message), { status, code, uncertain });
}
function lineDisplayMessage(value) {
  // 後端錯誤也可能夾帶識別碼；保留可操作的說明，隱藏原始值。
  return String(value || "")
    .replace(/\bU[0-9a-f]{32}\b/gi, "（已隱藏）")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "（已隱藏）")
    .replace(/\b(?:img_)?[0-9a-f]{24}\b/gi, "（已隱藏）")
    .replace(/\b(couponId|cardTypeMessageId|ID)\s*[:：=]?\s*\d+\b/gi, "$1（已隱藏）");
}

export { LINE_CUSTOMER_PAGE_SIZE, LINE_RECIPIENT_LIMIT, fetchLineCardMessages, fetchLineCoupons, lineCardPageSummary, lineCardPages, lineCouponAvailable, lineDisplayMessage, lineRequestError };
