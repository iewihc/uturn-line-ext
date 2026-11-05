// 收件匣訊息內容：圖片／影片／檔案網址、連結化、表情貼替換。
import { ih } from "./core.js";
import { firstText } from "../line/sync.js";

// 圖片／影片／語音／檔案的實際網址：LINE 自己存的走 chat-content.line.biz（縮圖加 /preview），外部來源用它給的網址
function inboxMedia(botId, message) {
  const p = message && message.contentProvider;
  if (!p) return null;
  if (p.type === "line" && p.contentHash) {
    const url = `https://chat-content.line.biz/bot/${botId}/${p.contentHash}`;
    return { url, preview: url + "/preview", expired: !!p.expired || (p.expiredAt && p.expiredAt <= Date.now()) };
  }
  if (p.type === "external") return { url: p.originalContentUrl || "", preview: p.previewImageUrl || p.originalContentUrl || "", expired: false };
  return null;
}
const inboxStickerUrl = (id) => `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(id)}/android/sticker.png`;
// 表情貼（LINE 叫 sticon）：_key 是鍵盤用的小圖，泡泡裡用原圖
const inboxEmojiUrl = (productId, emojiId, key) =>
  `https://stickershop.line-scdn.net/sticonshop/v1/sticon/${encodeURIComponent(productId)}/ANDROID/${encodeURIComponent(emojiId)}${key ? "_key" : ""}.png`;
const inboxPackTabUrl = (kind, id) => kind === "sticker"
  ? `https://stickershop.line-scdn.net/stickershop/v1/product/${encodeURIComponent(id)}/ANDROID/tab_on.png`
  : `https://stickershop.line-scdn.net/sticonshop/v1/sticon/${encodeURIComponent(id)}/ANDROID/tab_on.png`;
const inboxFileSize = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
// 文字裡的 http(s) 連結做成可點的 <a>（新分頁開）；其餘維持純文字節點，不組 HTML
const INBOX_URL_RE = /https?:\/\/[^\s<>"'）)\]】，。、]+/g;
function inboxLinkify(text) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(INBOX_URL_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(ih("a", { class: "loe-inbox-link", href: m[0], target: "_blank", rel: "noopener", text: m[0] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
// 文字泡泡：訊息帶 emojis[]（LINE 表情貼，文字裡該位置是佔位字元）就換成圖，其餘段落走 inboxLinkify
function inboxTextNodes(msg, text) {
  const emojis = Array.isArray(msg?.emojis)
    ? msg.emojis.filter((e) => e && e.productId && e.emojiId && Number.isInteger(e.index)).sort((a, b) => a.index - b.index)
    : [];
  if (!emojis.length) return inboxLinkify(text);
  const out = [];
  let last = 0;
  for (const e of emojis) {
    if (e.index < last || e.index > text.length) continue;
    if (e.index > last) out.push(...inboxLinkify(text.slice(last, e.index)));
    out.push(ih("img", { class: "loe-inbox-emoji", src: inboxEmojiUrl(e.productId, e.emojiId, false), alt: "表情貼" }));
    last = e.index + (e.length || 1);
  }
  if (last < text.length) out.push(...inboxLinkify(text.slice(last)));
  return out;
}
// 非文字訊息的泡泡內容；回 null 表示用文字顯示
function inboxMediaNode(botId, m) {
  const msg = m.message;
  if (!msg) return null;
  const media = inboxMedia(botId, msg);
  const expiredNode = (label) => ih("span", { class: "loe-inbox-media-expired", text: `[${label}已過期，LINE 不再提供]` });
  const fileLabel = (icon, fallback) => [
    ih("span", { text: `${icon} ${msg.fileName || fallback}` }),
    msg.fileSize ? ih("span", { class: "loe-inbox-muted", text: ` ${inboxFileSize(msg.fileSize)}` }) : null,
  ];
  // 自己上傳中／剛送出的檔案 LINE 還沒回 contentProvider：圖片顯示本機預覽，其他顯示檔名
  const localNode = (icon, fallback) => m.sendId ? ih("span", { class: "loe-inbox-media-file" }, ...fileLabel(icon, fallback)) : null;
  switch (msg.type) {
    case "image":
      if (!media) return m.localUrl ? ih("img", { class: "loe-inbox-media-img", src: m.localUrl, alt: "圖片" }) : localNode("🖼", "圖片");
      if (media.expired) return expiredNode("圖片");
      return ih("a", { class: "loe-inbox-media-link", href: media.url, target: "_blank", rel: "noopener", title: "點擊看原圖" },
        ih("img", { class: "loe-inbox-media-img", src: media.preview, alt: "圖片", loading: "lazy" }));
    case "video":
      if (!media) return localNode("🎬", "影片");
      if (media.expired) return expiredNode("影片");
      return ih("video", { class: "loe-inbox-media-video", src: media.url, poster: media.preview, controls: true, preload: "metadata" });
    case "audio":
      if (!media) return localNode("🎵", "語音");
      if (media.expired) return expiredNode("語音");
      return ih("audio", { class: "loe-inbox-media-audio", src: media.url, controls: true, preload: "metadata" });
    case "file":
      if (!media) return localNode("📎", "檔案");
      if (media.expired) return expiredNode("檔案");
      return ih("a", { class: "loe-inbox-media-file", href: media.url, target: "_blank", rel: "noopener" }, ...fileLabel("📎", "檔案"));
    case "sticker":
      return msg.stickerId ? ih("img", { class: "loe-inbox-media-sticker", src: inboxStickerUrl(msg.stickerId), alt: "貼圖", loading: "lazy" }) : null;
    case "location": {
      const q = encodeURIComponent(msg.address || `${msg.latitude},${msg.longitude}`);
      return ih("a", { class: "loe-inbox-media-file", href: `https://www.google.com/maps/search/?api=1&query=${q}`, target: "_blank", rel: "noopener", title: "在 Google 地圖開啟" },
        ih("span", { text: "📍 " + firstText([msg.title, msg.address]) || "位置" }),
        msg.title && msg.address ? ih("span", { class: "loe-inbox-muted", text: " " + msg.address }) : null);
    }
    default: return null;
  }
}

export { inboxEmojiUrl, inboxLinkify, inboxMediaNode, inboxPackTabUrl, inboxStickerUrl, inboxTextNodes };
