// 本機設定的讀寫：前綴（依官方帳號）、Webhook／後台帳號／車隊（全域）、派單視窗的勾選。
import { AUTOREPLY_KEY, CHAT_OVERRIDE_KEY, DISPATCHER_KEY, DISPATCH_TEMPLATE_KEY, DRIVER_RELAY_KEY, FLEET_KEY, FLEET_SYSTEM_NOTI_KEY, MARK_FOLLOWUP_KEY, MEMO_INCLUDE_KEY, PREFIX_KEY, SYSTEM_NOTI_KEY, WEBHOOK_KEY } from "./core/constants.js";
import { INBOX_MODE } from "./core/env.js";
import { getChatId, getOaId } from "./core/page-context.js";
import { storeGet, storeSet } from "./core/store.js";
import { renderInboxList } from "./inbox/list.js";
import { renderInboxThread } from "./inbox/thread.js";
import { renderPrefixChip } from "./prefix.js";

function scopedKey(base) {
  return `${base}::${getOaId()}`;
}
// 設定指定 OA 帳號(gid)的前綴（給「一鍵匯入」用，可寫入非目前帳號）
function setPrefixForGid(gid, text) {
  storeSet(`${PREFIX_KEY}::${gid}`, text || "");
}
function getPrefixForGid(gid) {
  const v = storeGet(`${PREFIX_KEY}::${gid}`, "");
  return typeof v === "string" ? v : "";
}
// chat 層級覆寫：key = gid/chat -> { group, pickup }
function getChatOverrides() {
  const v = storeGet(CHAT_OVERRIDE_KEY, null);
  return v && typeof v === "object" ? v : {};
}
function setChatOverrides(map) {
  storeSet(CHAT_OVERRIDE_KEY, map || {});
}
function getCurrentOverride() {
  const gid = getOaId();
  const chat = getChatId();
  if (!chat) return null;
  return getChatOverrides()[`${gid}/${chat}`] || null;
}
// 取值：先讀此帳號專屬的 key；若沒有、但有舊的全域設定，搬移過來(一次性)
function getScoped(base) {
  const k = scopedKey(base);
  let v = storeGet(k, null);
  if (v == null) {
    const legacy = storeGet(base, null); // 舊版全域設定
    if (legacy != null && legacy !== "") {
      storeSet(k, legacy);
      v = legacy;
    }
  }
  return typeof v === "string" ? v : "";
}
function getPrefix() {
  return getScoped(PREFIX_KEY);
}
function setPrefix(text) {
  storeSet(scopedKey(PREFIX_KEY), text || "");
  renderPrefixChip();
  if (INBOX_MODE) { renderInboxThread(); renderInboxList(); }
}
// Webhook 與後台帳號為「全域共用」：設定一次，所有帳號／頁面共用。
// 讀取時：先讀全域；若全域空、但舊版有存成「此帳號專屬」，自動搬到全域(一次性)。
function getGlobalWithMigration(base) {
  let v = storeGet(base, "");
  if (!v) {
    const sc = storeGet(scopedKey(base), "");
    if (sc) {
      storeSet(base, sc);
      v = sc;
    }
  }
  return typeof v === "string" ? v : "";
}
function getWebhook() {
  return getGlobalWithMigration(WEBHOOK_KEY);
}
function setWebhook(url) {
  storeSet(WEBHOOK_KEY, (url || "").trim());
}
// 後台帳號常把 gmail 打成 gamil、gmial、gmail.con…：網域像 Gmail 的一律更正成 gmail.com
const GMAIL_TYPO_DOMAIN =
  /^(gmail|gamil|gmial|gmali|gmai|gmaill|gnail|gmal|gmil|gmaul|gemail|gimail|gamail|gmaik|gmsil|gmqil)\.?(com|co|cm|con|om|comm|cim|vom|xom|cpm|ocm|c)?$/i;
function fixEmailTypo(email) {
  const value = (email || "").trim();
  const at = value.lastIndexOf("@");
  if (at <= 0) return value;
  const domain = value.slice(at + 1);
  return GMAIL_TYPO_DOMAIN.test(domain) ? value.slice(0, at) + "@gmail.com" : value;
}
// 舊設定已存成打錯的網域：讀的時候順手更正並存回，不用使用者重設
function getDispatcher() {
  const saved = (getGlobalWithMigration(DISPATCHER_KEY) || "").trim();
  const fixed = fixEmailTypo(saved);
  if (fixed !== saved) storeSet(DISPATCHER_KEY, fixed);
  return fixed;
}
function setDispatcher(name) {
  storeSet(DISPATCHER_KEY, fixEmailTypo(name));
}
// 車隊（全域共用）：決定要向後端拉哪個車隊的懶惰蟲設定（webhook + 官方/店配）
function getFleet() {
  return (getGlobalWithMigration(FLEET_KEY) || "").trim();
}
function setFleet(code) {
  // 存車隊代碼（設定面板下拉選取），車隊改顯示名稱也不受影響
  storeSet(FLEET_KEY, (code || "").trim());
}
// 派單視窗的布林勾選：預設 true 的「沒存成 false 就算開」，預設 false 的「存成 true 才算開」
const boolSetting = (key, def) => ({
  get: () => (def ? storeGet(key, true) !== false : storeGet(key, false) === true),
  set: (on) => storeSet(key, !!on),
});
const autoReply = boolSetting(AUTOREPLY_KEY, false); // 派單後自動回覆客人
const memoInclude = boolSetting(MEMO_INCLUDE_KEY, true); // 帶入乘客姓名（預設帶入）
const markFollowUp = boolSetting(MARK_FOLLOWUP_KEY, true); // 標記待處理（預設標記）
const systemNoti = boolSetting(SYSTEM_NOTI_KEY, false); // 系統自動通知（預設不開）
const driverRelay = boolSetting(DRIVER_RELAY_KEY, false); // 司機↔客人轉傳（預設不開）
const getAutoReply = autoReply.get, setAutoReply = autoReply.set;
const getMemoInclude = memoInclude.get, setMemoInclude = memoInclude.set;
const getMarkFollowUp = markFollowUp.get, setMarkFollowUp = markFollowUp.set;
const getSystemNoti = systemNoti.get, setSystemNoti = systemNoti.set;
const getDriverRelay = driverRelay.get, setDriverRelay = driverRelay.set;
// 車隊的系統自動通知設定（後台複製設定）：{ enabled, defaultOn, nodes }；沒拉過回 null（照舊不鎖）
function getFleetSystemNoti() {
  const v = storeGet(FLEET_SYSTEM_NOTI_KEY, null);
  return v && typeof v === "object" ? v : null;
}
function setFleetSystemNoti(v) {
  storeSet(FLEET_SYSTEM_NOTI_KEY, v && typeof v === "object" ? v : null);
}
function getDispatchTemplate() {
  const v = storeGet(DISPATCH_TEMPLATE_KEY, "");
  return typeof v === "string" ? v : "";
}
function setDispatchTemplate(name) {
  storeSet(DISPATCH_TEMPLATE_KEY, name || "");
}

export { fixEmailTypo, getAutoReply, getChatOverrides, getCurrentOverride, getDispatchTemplate, getDispatcher, getDriverRelay, getFleet, getFleetSystemNoti, getMarkFollowUp, getMemoInclude, getPrefix, getPrefixForGid, getSystemNoti, getWebhook, setAutoReply, setChatOverrides, setDispatchTemplate, setDispatcher, setDriverRelay, setFleet, setFleetSystemNoti, setMarkFollowUp, setMemoInclude, setPrefix, setPrefixForGid, setSystemNoti, setWebhook };
