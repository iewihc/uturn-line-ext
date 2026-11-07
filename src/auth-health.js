// 身份授權失效提示：每分鐘問後端 GET /line-ext/auth-status。後端用這份 LINE 登入送訊息被 LINE 回「沒有登入」時，
// 畫面上方固定一條紅色提示（自動通知、司機↔客人轉傳都送不出去），按「重新身份授權」就地重授；「稍後」10 分鐘內不再跳。
// 任何地方授權成功（saveLineCookie 發 loe-line-auth-saved）馬上重查。
import { hasLineExtAuth, lineAuthDoneText, lineExtApi, saveLineCookie } from "./core/backend.js";
import { ih } from "./inbox/core.js";
import { toast } from "./ui/toast.js";

const AUTH_HEALTH_MS = 60000;
const AUTH_SNOOZE_MS = 10 * 60000;
const authHealth = { invalid: false, since: "", snoozeUntil: 0, el: null, timer: 0, busy: false, authorize: null, onChange: null };

async function checkAuthHealth() {
  if (!hasLineExtAuth()) return setAuthInvalid(false, "");
  try {
    const r = await lineExtApi("GET", "/line-ext/auth-status");
    setAuthInvalid(!!r?.lineLoginInvalid, r?.invalidSince || "");
  } catch (_) { /* 後端暫時連不上：維持上次狀態 */ }
}
function setAuthInvalid(invalid, since) {
  const changed = invalid !== authHealth.invalid;
  authHealth.invalid = invalid;
  authHealth.since = since;
  renderAuthBanner();
  if (changed) authHealth.onChange?.();
}
const authSinceText = () => {
  const d = authHealth.since && new Date(authHealth.since);
  return d && !Number.isNaN(d.getTime()) ? `（${d.toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} 起）` : "";
};
function renderAuthBanner() {
  const show = authHealth.invalid && Date.now() >= authHealth.snoozeUntil;
  if (!show) { authHealth.el?.remove(); authHealth.el = null; return; }
  authHealth.el?.remove();
  authHealth.el = ih("div", { class: "loe-auth-banner", role: "alert" },
    ih("strong", { text: "身份授權失效" + authSinceText() }),
    ih("span", { text: "LINE 登入已失效，自動通知、司機↔客人轉傳都送不出去。請在 chat.line.biz 重新登入官方帳號，再按「重新身份授權」。" }),
    ih("button", { type: "button", class: "primary", text: authHealth.busy ? "授權中…" : "重新身份授權", disabled: authHealth.busy, onclick: reauthorize }),
    ih("button", { type: "button", text: "稍後", title: "10 分鐘內不再顯示", onclick: () => { authHealth.snoozeUntil = Date.now() + AUTH_SNOOZE_MS; renderAuthBanner(); } }));
  document.body.append(authHealth.el);
}
async function reauthorize() {
  if (authHealth.busy) return;
  if (authHealth.authorize) return authHealth.authorize(); // 收件匣：用收件匣的身份授權（指定官方帳號）
  authHealth.busy = true;
  renderAuthBanner();
  try {
    const result = await saveLineCookie();
    if (!result.cancelled) toast(lineAuthDoneText(result), "ok", 4000);
  } catch (e) {
    toast(e.message || "身份授權失敗", "err", 8000);
  } finally {
    authHealth.busy = false;
    renderAuthBanner();
  }
}
// authorize：收件匣自己的授權流程；onChange：失效狀態變了（收件匣重畫標頭）
function initAuthHealth({ authorize, onChange } = {}) {
  authHealth.authorize = authorize || null;
  authHealth.onChange = onChange || null;
  if (authHealth.timer) return;
  window.addEventListener("loe-line-auth-saved", () => { authHealth.snoozeUntil = 0; checkAuthHealth(); });
  checkAuthHealth();
  authHealth.timer = setInterval(checkAuthHealth, AUTH_HEALTH_MS);
}
const authLoginInvalid = () => authHealth.invalid;

export { authLoginInvalid, initAuthHealth };
