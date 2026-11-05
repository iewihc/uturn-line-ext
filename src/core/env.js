// 多開收件匣：?uturnInbox=1 → document-start 就接管整頁，LINE 的 SPA 不啟動。
// 其他頁面維持舊行為：等 DOMContentLoaded（等同原本的 document-idle）再跑主程式。
const INBOX_MODE = location.hostname === "chat.line.biz" && window.top === window.self &&
  /(?:^\?|&)uturnInbox=1(?:&|$)/.test(location.search);

export { INBOX_MODE };
