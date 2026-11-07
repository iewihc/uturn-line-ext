// 收件匣通知：右上卡片、提示音、背景時的桌面通知。
import { inboxPreview } from "./chats.js";
import { INBOX_TOAST_MAX_KEPT, INBOX_TOAST_MS, inbox, inboxBotName } from "./core.js";
import { inboxOpenChat } from "./send.js";
import { renderInboxHeader } from "./shell.js";
import { renderInboxToasts } from "./thread.js";

/* ---- 通知：卡片（同一位客人合併計數）＋提示音＋背景時的桌面通知 ---- */
function inboxDismissToast(key) {
  const t = inbox.toasts.get(key);
  if (!t) return;
  clearTimeout(t.timer);
  inbox.toasts.delete(key);
}
function inboxDismissAllToasts() {
  for (const t of inbox.toasts.values()) clearTimeout(t.timer);
  inbox.toasts.clear();
  inbox.notifOpen = false;
}
// 新通知／同一則又來：重新露出、重新計時；到時縮回鈴鐺（留在清單裡，按處理或 × 才消失）；清單太長丟最舊的
function inboxToastTouch(t) {
  t.at = Date.now(); t.folded = false;
  clearTimeout(t.timer);
  t.timer = setTimeout(() => { t.folded = true; renderInboxToasts(); }, INBOX_TOAST_MS);
  inbox.toasts.delete(t.key); inbox.toasts.set(t.key, t); // 重新插到最後＝最新
  while (inbox.toasts.size > INBOX_TOAST_MAX_KEPT) { const oldest = inbox.toasts.keys().next().value; clearTimeout(inbox.toasts.get(oldest)?.timer); inbox.toasts.delete(oldest); }
}
// 通知卡加一則：同一個 key 合併計數、只留最近 3 則；init 只在第一次建立時用，fields 每次覆寫（空值不蓋掉舊的）
function inboxPushToast(key, init, fields, line) {
  const t = inbox.toasts.get(key) || { key, count: 0, lines: [], timer: 0, ...init };
  for (const [k, v] of Object.entries(fields || {})) if (v) t[k] = v;
  t.count += 1;
  t.lines.push(line || "[訊息]");
  if (t.lines.length > 3) t.lines.shift();
  inboxToastTouch(t);
  return t;
}
// 提示音＋背景時的桌面通知（點了回到收件匣）
function inboxAlert(title, t, onOpen) {
  if (inbox.sound) inboxBeep();
  if (document.hidden && typeof Notification === "function" && Notification.permission === "granted") {
    try {
      const n = new Notification(title, { body: t.lines.join("\n"), tag: t.key });
      n.onclick = () => { window.focus(); onOpen?.(); n.close(); };
    } catch (_) {}
  }
}
// 客人來訊（同一位客人合併計數）；extra.handoff＝轉人工原因（卡片標「轉人工」）
function inboxNotify(chat, payload, extra) {
  const t = inboxPushToast(chat.key, {}, extra, inboxPreview(payload));
  inboxAlert(`${inboxBotName(chat.botId)}・${chat.name}`, t, () => inboxOpenChat(chat.key));
}
// 司機對話新訊息（只有自己的單）：同一張單合併計數。chatKey＝這張單派自哪個收件匣對話（有才能「在收件匣開」）
function inboxNotifyDriver({ orderId, shortId, oriText, driverNo, text, chatKey }) {
  const t = inboxPushToast(`dchat:${orderId}`, { kind: "driver", orderId }, { shortId, oriText, driverNo, chatKey }, text);
  renderInboxToasts();
  inboxAlert(`司機 ${String(t.driverNo || "").replace(/^[^|]*\|/, "")}・${t.shortId}`, t);
}
// AI 客服轉人工／轉人工中客人來訊（選項「只通知轉人工」）：對得到收件匣的對話就併進那位客人的卡片，
// 對不到（帳號沒開、還沒對應）另開一張轉人工卡，同一位客人合併。
function inboxNotifyHandoff({ chatKey, conversationId, chatUrl, customerName, officialName, shortId, reason, text }) {
  const chat = chatKey && inbox.chats.get(chatKey);
  if (chat) inboxNotify(chat, { type: "message", message: { type: "text", text } }, { handoff: reason });
  else {
    const t = inboxPushToast(`handoff:${conversationId || chatUrl}`, { kind: "handoff" }, { customerName, officialName, shortId, chatUrl, handoff: reason }, text);
    inboxAlert(`轉人工・${[officialName, customerName].filter(Boolean).join(" ")}`, t);
  }
  renderInboxToasts();
}
// 不載外部音檔（CSP／離線都不受影響）：Web Audio 兩個短音
function inboxAudio() {
  if (!inbox.audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    inbox.audio = new Ctx();
    inbox.audio.addEventListener("statechange", renderInboxHeader);
  }
  return inbox.audio;
}
// 第一個使用者手勢：只建立／喚醒 AudioContext，不播音（之前 Chrome 已允許自動播放時會白響一聲）
function inboxUnlockAudio() {
  try { const ctx = inboxAudio(); if (ctx && ctx.state !== "running") ctx.resume().catch(() => {}); } catch (_) {}
}
function inboxBeep() {
  try {
    const ctx = inboxAudio();
    if (!ctx) return;
    if (ctx.state !== "running") { ctx.resume().catch(() => {}); return; }
    playTwoTone(ctx);
  } catch (_) {}
}
// 兩個短音（收件匣新訊息、司機對話共用）。有人反應太小聲，一路加大：
//   方波（同振幅下比三角波響一倍）＋高八度疊一層、每個音再拉長，最後過一個壓縮器當限幅：
//   壓縮器門檻壓低、比例拉高，Chrome 會自動補償增益把整體音量推上去，又不會削波破音
const TONE_PEAK = 0.9;
const TONE_SECONDS = 0.3;
const TONE_STEPS = [[880, 0], [1175, 0.18]]; // [頻率, 起始延遲]
function toneBus(ctx) { // 每個 AudioContext 一條：壓縮器 → 喇叭
  if (!ctx._loeBus) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -30; comp.knee.value = 10; comp.ratio.value = 16; comp.attack.value = 0.002; comp.release.value = 0.12;
    comp.connect(ctx.destination);
    ctx._loeBus = comp;
  }
  return ctx._loeBus;
}
function playTwoTone(ctx) {
  try {
    const t0 = ctx.currentTime, bus = toneBus(ctx);
    for (const [freq, delay] of TONE_STEPS) {
      for (const [mul, level] of [[1, TONE_PEAK], [2, TONE_PEAK * 0.35]]) { // 基音＋高八度
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "square"; osc.frequency.value = freq * mul;
        gain.gain.setValueAtTime(0.0001, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(level, t0 + delay + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + TONE_SECONDS);
        osc.connect(gain).connect(bus);
        osc.start(t0 + delay); osc.stop(t0 + delay + TONE_SECONDS + 0.02);
      }
    }
  } catch (_) {}
}
const inboxSoundReady = () => !inbox.sound || (inbox.audio && inbox.audio.state === "running");

export { inboxBeep, inboxDismissAllToasts, inboxDismissToast, inboxUnlockAudio, inboxNotify, inboxNotifyDriver, inboxNotifyHandoff, inboxSoundReady, playTwoTone };
