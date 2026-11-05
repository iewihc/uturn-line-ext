// 後台「開官方聊天室」→ 依 ?uturnOpen={payload} 找到乘客對話並開啟。
import { OA_BOT_NAMES_KEY } from "./core/constants.js";
import { getOaId, getOaName } from "./core/page-context.js";
import { storeGet, storeSet } from "./core/store.js";
import { fleetLabelKey } from "./fleet.js";
import { fetchLineDirectoryPage, fetchLineJson, lineChatsPageUrl } from "./line/fetch.js";
import { toEpochMs } from "./line/sync.js";
import { toast } from "./ui/toast.js";

/* ---------------------------------------------------------------------- *
 * 後台「開官方聊天室」→ 自動打開乘客對話
 *   後台開啟 https://chat.line.biz/{botId}?uturnOpen={payload}（不知道 botId 時為 https://chat.line.biz/?uturnOpen=…）
 *   payload＝base64url(UTF-8 JSON)：{ v: 1, oa: 官方帳號名稱, n: 乘客 LINE 名稱, k?: 大頭貼比對鍵, at?: 乘客最後訊息時間(ms) }
 *   1) botId：網址上的為準；沒有就依官方帳號名稱查（本機快取 → LINE 官方帳號清單）
 *   2) 翻對話清單找 chatId 並開啟：大頭貼比對鍵相同就是他（名稱被改過也一樣）；否則依乘客名稱；找不到就填入左側搜尋
 *   ※ 後台已知道 chatId 時直接開 /{botId}/chat/{chatId}，不經這裡。
 * ---------------------------------------------------------------------- */
const LINE_BOT_ID_RE = /^U[0-9a-f]{32}$/i;
const UTURN_OPEN_PAGE_LIMIT = 200; // 最多翻 200 頁（5,000 位）
const UTURN_OPEN_EXTRA_PAGES = 2; // 找到第一位後再多看 2 頁，抓近似時間的同名者
const UTURN_OPEN_NOTICE_KEY = "loe_uturn_open_notice_v1"; // 換頁後才顯示的提示（sessionStorage）
let lastUturnOpenPayload = null; // 冪等：同一 payload 只處理一次
let uturnOpenRun = null; // 自己的 run，與同步流程互不影響
let learnedOaBotName = "";
let chatKeysLogged = false;
function cleanupUturnOpenParam() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has("uturnOpen")) return;
    u.searchParams.delete("uturnOpen");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  } catch (_) {}
}
// 解不開或欄位不符回 null（直接忽略）
function decodeUturnOpenPayload(raw) {
  try {
    if (raw.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (raw.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const n = typeof data?.n === "string" ? data.n.trim() : "";
    const k = typeof data?.k === "string" ? data.k.trim() : "";
    if (data?.v !== 1 || (!n && !k)) return null;
    return {
      oa: typeof data.oa === "string" ? data.oa.trim() : "",
      n,
      k,
      at: Number.isFinite(data.at) && data.at > 0 ? data.at : null,
    };
  } catch (_) {
    return null;
  }
}
// 官方帳號名稱比對：與車隊同口徑（去空白、變體符號、大小寫）；退一步再忽略 emoji
//（標頭的 emoji 可能是圖片，讀到的名稱會少掉 emoji）
const oaLooseKey = (s) => fleetLabelKey(s).replace(/[\p{Extended_Pictographic}‍]/gu, "");
function readOaBotNames() {
  const v = storeGet(OA_BOT_NAMES_KEY, null);
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function rememberOaBotNames(entries) {
  const map = readOaBotNames();
  let changed = false;
  for (const [botId, name] of entries) {
    if (LINE_BOT_ID_RE.test(botId) && name && map[botId] !== name) { map[botId] = name; changed = true; }
  }
  if (changed) storeSet(OA_BOT_NAMES_KEY, map);
}
// 在官方帳號頁順手記下「botId → 名稱」（維護迴圈呼叫，同一組只寫一次）
function learnOaBotName() {
  if (location.hostname !== "chat.line.biz") return;
  const botId = getOaId();
  if (!LINE_BOT_ID_RE.test(botId)) return;
  const name = getOaName();
  if (!name || learnedOaBotName === botId + name) return;
  learnedOaBotName = botId + name;
  rememberOaBotNames([[botId, name]]);
}
// { botId: 名稱 } 中找名稱相符且唯一的 botId；沒有或不唯一回空字串
function findBotIdByName(map, oa) {
  const pairs = Object.entries(map);
  for (const key of [fleetLabelKey, oaLooseKey]) {
    const want = key(oa);
    if (!want) continue;
    const ids = pairs.filter(([, name]) => key(name) === want).map(([botId]) => botId);
    if (ids.length) return ids.length === 1 ? ids[0] : "";
  }
  return "";
}
// LINE 內部官方帳號清單（格式未公開，盡力解析；看不懂就當查不到）
async function fetchLineBotNames(run) {
  const found = [];
  const cursors = new Set();
  let next = "";
  for (let page = 0; page < 10; page++) {
    const url = new URL("/api/v1/bots", location.origin);
    url.searchParams.set("noFilter", "true");
    url.searchParams.set("limit", "1000");
    if (next) url.searchParams.set("next", next);
    const data = await fetchLineJson(url, run);
    const list = Array.isArray(data) ? data : [data?.list, data?.bots, data?.items].find(Array.isArray) || [];
    for (const item of list) {
      const botId = [item?.botId, item?.mid, item?.id, item?.bot?.botId]
        .find((v) => typeof v === "string" && LINE_BOT_ID_RE.test(v));
      const name = [item?.name, item?.displayName, item?.botName, item?.profile?.name, item?.bot?.name]
        .find((v) => typeof v === "string" && v.trim());
      if (botId && name) found.push([botId, name.trim()]);
    }
    next = typeof data?.next === "string" ? data.next : "";
    if (!next || cursors.has(next)) break;
    cursors.add(next);
  }
  return found;
}
async function resolveUturnOpenBotId(oa, run) {
  const here = getOaId();
  const map = readOaBotNames();
  const cached = oa ? findBotIdByName(map, oa) : "";
  if (LINE_BOT_ID_RE.test(here)) {
    // 網址上的 botId 為準；只有快取明確記得「這裡是別的官方帳號」且名稱對到另一個時才改用
    //（從根網址進來時 LINE 可能先跳到上次用的官方帳號）
    return cached && cached !== here && map[here] ? cached : here;
  }
  if (!oa) return "";
  if (cached) return cached;
  // 官方帳號清單另開 run：清單逾時不影響後續翻對話；整個 run 被取代時一併中止
  const listRun = { controller: new AbortController() };
  run.controller.signal.addEventListener("abort", () => listRun.controller.abort(), { once: true });
  let listed = [];
  try { listed = await fetchLineBotNames(listRun); } catch (_) {}
  rememberOaBotNames(listed);
  return findBotIdByName(Object.fromEntries(listed), oa);
}
// 對話的時間欄位尚未確認：依常見欄位找毫秒、秒或 ISO 時間
function chatTimestamp(chat) {
  for (const v of [chat.lastEventAt, chat.latestEventAt, chat.lastMessageAt, chat.updatedAt,
      chat.lastMessage?.createdAt, chat.latestMessage?.createdAt, chat.lastMessage?.timestamp, chat.timestamp]) {
    const t = toEpochMs(v);
    if (t) return t;
  }
  return null;
}
// 大頭貼比對鍵（與後端 lineAvatarKey 一致）：0h 開頭去掉第 7–10 字與最後 13 字（每次網址都會變的簽章），0m 開頭整段
function lineAvatarKey(iconHash) {
  const t = typeof iconHash === "string" ? iconHash : "";
  if (t.startsWith("0m")) return t;
  if (!t.startsWith("0h") || t.length <= 40) return "";
  return t.slice(0, 6) + t.slice(10, t.length - 13);
}
// 翻對話清單找乘客：大頭貼比對鍵相同就是他（立刻停）；否則依名稱（LINE 原名或客服改的暱稱），找到第一位後再多看幾頁就停。被取代時回 null。
async function findUturnOpenChats(botId, { n: name, k: avatarKey }, run, onProgress) {
  const want = fleetLabelKey(name);
  if (!want && !avatarKey) return [];
  const matches = new Map();
  const cursors = new Set();
  let next = "", seen = 0, firstMatchPage = -1;
  for (let page = 0; page < UTURN_OPEN_PAGE_LIMIT; page++) {
    const data = await fetchLineDirectoryPage(lineChatsPageUrl(botId, next), run);
    if (uturnOpenRun !== run) return null;
    for (const chat of data.list) {
      if (!chat || typeof chat.chatId !== "string" || !chat.chatId) continue;
      if (!chatKeysLogged) {
        // 只記欄位名稱（不含內容），日後調整時間欄位用
        chatKeysLogged = true;
        console.debug("[uturn] LINE 對話欄位", Object.fromEntries(Object.entries(chat)
          .map(([k, v]) => [k, v && typeof v === "object" ? Object.keys(v) : typeof v])));
      }
      seen++;
      const profile = chat.profile || {};
      if (avatarKey && lineAvatarKey(profile.iconHash) === avatarKey) {
        onProgress(seen);
        return [{ chatId: chat.chatId, at: chatTimestamp(chat) }];
      }
      if (want && (fleetLabelKey(profile.name) === want || fleetLabelKey(profile.nickname) === want) && !matches.has(chat.chatId))
        matches.set(chat.chatId, { chatId: chat.chatId, at: chatTimestamp(chat) });
    }
    onProgress(seen);
    if (matches.size && firstMatchPage < 0) firstMatchPage = page;
    if (firstMatchPage >= 0 && page - firstMatchPage >= UTURN_OPEN_EXTRA_PAGES) break;
    next = data.next || "";
    if (!next || cursors.has(next)) break;
    cursors.add(next);
  }
  return [...matches.values()];
}
// 可改文字的常駐 toast（翻頁進度用）
function progressToast(message) {
  const t = document.createElement("div");
  t.className = "loe-toast show";
  t.textContent = message;
  document.body.appendChild(t);
  return { set: (text) => { t.textContent = text; }, done: () => t.remove() };
}
// 盡力把名字填進左側對話清單的搜尋框（清單可能晚點才出現，最多等 10 秒）
function fillChatListSearch(text, deadline = Date.now() + 10000) {
  try {
    const visible = (el) => !el.disabled && el.getClientRects().length && !el.closest('[class*="loe-"], .sub-header');
    const input = [document.querySelector("input.chatlist-search"),
      ...document.querySelectorAll('input[type="search"], input[placeholder*="搜尋"], input[placeholder*="search" i]')]
      .find((el) => el && visible(el) && el.getBoundingClientRect().left < window.innerWidth / 2);
    if (!input) {
      if (Date.now() < deadline) setTimeout(() => fillChatListSearch(text, deadline), 500);
      return;
    }
    // 走原生 setter，框架（Vue/React）才會收到 input 事件後的新值
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  } catch (_) {}
}
function showUturnOpenNotice(notice) {
  if (!notice || typeof notice.message !== "string") return;
  toast(notice.message, notice.kind || "", 6000);
  if (typeof notice.search === "string" && notice.search) fillChatListSearch(notice.search);
}
// location.assign 會整頁重載，提示先放 sessionStorage，載入後再顯示
function finishUturnOpen(path, notice, stay) {
  if (stay) return showUturnOpenNotice(notice);
  try {
    if (notice) sessionStorage.setItem(UTURN_OPEN_NOTICE_KEY, JSON.stringify(notice));
  } catch (_) {}
  location.assign(path);
}
function resumeUturnOpenNotice() {
  let notice = null;
  try {
    notice = JSON.parse(sessionStorage.getItem(UTURN_OPEN_NOTICE_KEY) || "null");
    sessionStorage.removeItem(UTURN_OPEN_NOTICE_KEY);
  } catch (_) {}
  showUturnOpenNotice(notice);
}
async function openChatFromUturn(payload) {
  const { oa, n, at } = payload;
  const who = n || "這位客人"; // 沒有名稱時只靠大頭貼找
  if (uturnOpenRun) uturnOpenRun.controller.abort();
  const run = (uturnOpenRun = { controller: new AbortController() });
  const progress = progressToast(`正在找「${who}」…`);
  try {
    const botId = await resolveUturnOpenBotId(oa, run);
    if (uturnOpenRun !== run) return;
    if (!botId) {
      toast(`找不到官方帳號「${oa}」，請請管理員到「客戶端OA設定」填寫官方後台網址`, "err", 8000);
      return;
    }
    const matches = await findUturnOpenChats(botId, payload, run,
      (seen) => progress.set(`正在找「${who}」…（已看 ${seen.toLocaleString()} 位）`));
    if (!matches || uturnOpenRun !== run) return;
    if (!matches.length) {
      finishUturnOpen(`/${botId}`, { message: `沒找到「${who}」，請在左側搜尋`, kind: "warn", search: n },
        getOaId() === botId);
      return;
    }
    // 同名多位：有 at 就挑對話時間最接近的；沒有時間欄位就取第一位（最近有對話）
    const timed = at ? matches.filter((m) => m.at) : [];
    const pick = timed.length
      ? timed.reduce((a, b) => (Math.abs(b.at - at) < Math.abs(a.at - at) ? b : a))
      : matches[0];
    const path = `/${botId}/chat/${encodeURIComponent(pick.chatId)}`;
    finishUturnOpen(path, matches.length > 1
      ? { message: `有 ${matches.length} 位同名「${n}」，已開啟最近有對話的那位`, kind: "warn" } : null,
      location.pathname === path);
  } catch (error) {
    if (uturnOpenRun === run)
      toast(run.timedOut ? `找「${who}」逾時，請在左側搜尋` : `找「${who}」失敗：${error.message || error}`, "err", 6000);
  } finally {
    progress.done();
    if (uturnOpenRun === run) uturnOpenRun = null;
  }
}
function checkUturnOpen() {
  if (location.hostname !== "chat.line.biz" || window.top !== window.self) return;
  if (!location.search) return; // 每幀都會跑：沒有 query 就不解析 URL
  let raw = null;
  try { raw = new URL(location.href).searchParams.get("uturnOpen"); } catch (_) {}
  if (raw === null) return;
  cleanupUturnOpenParam();
  if (raw === lastUturnOpenPayload) return;
  lastUturnOpenPayload = raw; // 先標記再處理，避免 observer 重入重複觸發
  const payload = decodeUturnOpenPayload(raw);
  if (payload) openChatFromUturn(payload).catch(() => {});
}

export { LINE_BOT_ID_RE, checkUturnOpen, learnOaBotName, progressToast, resumeUturnOpenNotice };
