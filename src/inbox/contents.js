// 收件匣「選擇內容」：貼圖／表情貼清單、預設訊息、多頁訊息、優惠券。
import { inbox, inboxApi, inboxBotName } from "./core.js";
import { inboxSendPayload, inboxSendSticker, inboxTextWithTokens } from "./send.js";
import { inboxInsertText, renderInboxContents, renderInboxPicker } from "./thread.js";
import { toast } from "../ui/toast.js";

/* ---- 貼圖／表情貼清單（每個官方帳號各自擁有，抓一次快取） ---- */
const INBOX_PACK_API = {
  sticker: { path: (b) => `/api/v1/bots/${b}/stickers/owned`, id: "packageId", items: "stickerIds" },
  emoji: { path: (b) => `/api/v1/bots/${b}/emojis/owned`, id: "productId", items: "emojiIds" },
};
async function inboxLoadPacks(botId, kind) {
  const key = `${botId}/${kind}`;
  if (inbox.packs.has(key)) return inbox.packs.get(key);
  const st = { list: [], loading: true, error: "" };
  inbox.packs.set(key, st);
  const api = INBOX_PACK_API[kind];
  try {
    let next = "", guard = 0;
    do {
      const r = await inboxApi("GET", api.path(botId) + (next ? `?nextToken=${encodeURIComponent(next)}` : ""));
      for (const p of r?.list || []) {
        const items = Array.isArray(p[api.items]) ? p[api.items].map(String) : [];
        if (p.available !== false && items.length) st.list.push({ id: String(p[api.id]), items });
      }
      next = r?.next || "";
    } while (next && ++guard < 20);
  } catch (e) { st.error = e.message; }
  st.loading = false;
  renderInboxPicker();
  return st;
}
/* ---- 選擇內容（預設訊息／多頁訊息／優惠券）：清單＋動作用一張表描述 ---- */
const inboxDate = (ms) => new Date(ms).toLocaleDateString("zh-TW");
const INBOX_CONTENT_PAGE = 25;
const INBOX_CONTENT_TABS = {
  saved: {
    label: "預設訊息", action: "帶入輸入框",
    url: (b, st) => `/api/v2/bots/${b}/savedReplies?page=${st.page}&pageSize=${INBOX_CONTENT_PAGE}`,
    id: (x) => x.savedReplyId, title: (x) => x.title, img: () => "",
    desc: (x) => (x.message && typeof x.message.text === "string") ? x.message.text : `[${x.message?.type || "訊息"}]`,
  },
  card: {
    label: "多頁訊息", action: "傳送",
    url: (b, st) => `/api/v1/bots/${b}/cardTypeMessages?limit=${INBOX_CONTENT_PAGE}${st.next ? `&next=${encodeURIComponent(st.next)}` : ""}`,
    id: (x) => x.id, title: (x) => x.title, img: () => "",
    desc: (x) => x.messageObject?.altText || x.type || "",
  },
  coupon: {
    label: "優惠券", action: "傳送優惠券",
    url: (b, st) => `/api/v1/bots/${b}/coupons?page=${st.page}&pageSize=${INBOX_CONTENT_PAGE}`,
    id: (x) => x.couponId, title: (x) => x.title, img: (x) => x.imageUrl || "",
    desc: (x) => [x.startTime, x.endTime].filter(Boolean).map(inboxDate).join(" ~ "),
  },
};
async function inboxLoadContents(botId, tab, more = false) {
  const key = `${botId}/${tab}`;
  let st = inbox.contentLists.get(key);
  if (!st) { st = { list: [], page: 0, next: "", done: false, loading: false, error: "" }; inbox.contentLists.set(key, st); }
  if (st.loading || (more ? st.done : st.page > 0)) return st;
  st.loading = true; st.error = ""; st.page += 1;
  try {
    const r = await inboxApi("GET", INBOX_CONTENT_TABS[tab].url(botId, st));
    const list = Array.isArray(r?.list) ? r.list : [];
    st.list.push(...list);
    st.next = r?.next || "";
    st.done = list.length < INBOX_CONTENT_PAGE || (tab === "card" && !st.next) || (typeof r?.total === "number" && st.list.length >= r.total);
  } catch (e) { st.error = e.message; st.page -= 1; }
  st.loading = false;
  renderInboxContents();
  return st;
}
const closeInboxContents = () => { inbox.contents = null; renderInboxContents(); };
// 預設訊息裡 LINE 的佔位字：{Nickname}＝客人顯示名、{AccountName}＝官方帳號名（LINE 聊天室也是帶入時就換掉）
const inboxFillPlaceholders = (text, chat) => text.replaceAll("{Nickname}", chat.name || "").replaceAll("{AccountName}", inboxBotName(chat.botId));
async function inboxUseContent(chat, tab, item) {
  if (!item) return;
  closeInboxContents();
  if (tab === "card") return inboxSendPayload({ type: "cardType", cardTypeMessageId: item.id }, { type: "cardType", altText: item.title || "" });
  if (tab === "coupon") return inboxSendPayload({ type: "coupon", couponId: item.couponId }, { type: "coupon", altText: item.title || "" });
  // 預設訊息：跟 LINE 一樣帶進輸入框（可再改再送）；貼圖型的直接送；順便記一次使用次數
  const msg = item.message || {};
  if (msg.type === "sticker" && msg.packageId && msg.stickerId) inboxSendSticker(msg.packageId, msg.stickerId);
  else if (typeof msg.text === "string") inboxInsertText(inboxTextWithTokens(inboxFillPlaceholders(msg.text, chat), msg.emojis));
  else { toast(`這則預設訊息是「${msg.type || "非文字"}」，收件匣還不支援`, "warn", 3000); return; }
  inboxApi("POST", `/api/v1/bots/${chat.botId}/savedReplies/${encodeURIComponent(item.savedReplyId)}/use`).catch(() => {});
}

export { INBOX_CONTENT_TABS, closeInboxContents, inboxLoadContents, inboxLoadPacks, inboxUseContent };
