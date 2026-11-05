// 目前的官方帳號／對話／客人：一般聊天頁從網址與標題列推得，收件匣以 pageContext 覆蓋。
/* ---- 每個官方帳號(OA)獨立：前綴 + webhook 以 OA id 分開儲存 ---- */
// 收件匣沒有 /{oa}/chat/{chat} 網址也沒有 LINE 的標題列：選中對話時設定這份情境，
// 派單視窗、前綴、店配覆寫、AI 切換等既有功能就能原封不動地用在收件匣。
let pageContext = null; // { botId, chatId, customerName, oaName } | null
function setPageContext(next) { pageContext = next; }
function getOaId() {
  if (pageContext) return pageContext.botId;
  const parts = location.pathname.split("/").filter(Boolean);
  // chat.line.biz/{oaId}/chat/...  ；找出符合 OA id 樣式的片段
  const m = parts.find((p) => /^U[0-9a-fA-F]{20,}$/.test(p) || /^@/.test(p));
  if (m) return m;
  // manager.line.biz：/.../account/{oaId}/...
  const ai = parts.indexOf("account");
  if (ai >= 0 && parts[ai + 1]) return parts[ai + 1];
  return parts[0] || "default";
}
function getOaName() {
  if (pageContext) return pageContext.oaName;
  const dd = document.querySelector("header .dropdown.btn-group");
  return dd ? dd.textContent.trim() : "";
}
// 目前對話的客戶名稱（頂部標題），完整帶入。
// LINE 把 emoji 以 <img alt="🍿"> 呈現，這裡用 alt 還原，得到「🍿Z3721/版主 允🐱」這種完整名稱。
function getCustomerName() {
  if (pageContext) return pageContext.customerName;
  const h = document.querySelector(".sub-header h4");
  if (!h) return "";
  let name = "";
  (function walk(node) {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) name += n.nodeValue;
      else if (n.tagName === "IMG") name += n.getAttribute("alt") || "";
      else if (n.childNodes && n.childNodes.length) walk(n);
      else name += n.textContent || "";
    });
  })(h);
  return name.trim();
}
function getChatId() {
  if (pageContext) return pageContext.chatId;
  const parts = location.pathname.split("/").filter(Boolean);
  const ci = parts.indexOf("chat");
  return ci >= 0 && parts[ci + 1] ? parts[ci + 1] : "";
}

export { getChatId, getCustomerName, getOaId, getOaName, pageContext, setPageContext };
