// 收件匣通知：右上卡片、提示音、背景時的桌面通知。
import { inboxPreview } from "./chats.js";
import { INBOX_TOAST_MS, inbox, inboxBotName } from "./core.js";
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
function inboxNotify(chat, payload) {
  const key = chat.key;
  const t = inbox.toasts.get(key) || { key, count: 0, lines: [], timer: 0 };
  t.count += 1;
  t.lines.push(inboxPreview(payload) || "[訊息]");
  if (t.lines.length > 3) t.lines.shift();
  clearTimeout(t.timer);
  t.timer = setTimeout(() => { inbox.toasts.delete(key); renderInboxToasts(); }, INBOX_TOAST_MS);
  inbox.toasts.set(key, t);
  if (inbox.sound) inboxBeep();
  if (document.hidden && typeof Notification === "function" && Notification.permission === "granted") {
    try {
      const n = new Notification(`${inboxBotName(chat.botId)}・${chat.name}`, { body: t.lines.join("\n"), tag: key });
      n.onclick = () => { window.focus(); inboxOpenChat(key); n.close(); };
    } catch (_) {}
  }
}
// 司機對話新訊息（只有自己的單）：右上卡片（同一張單合併計數）＋提示音＋背景時的桌面通知。
// chatKey＝這張單派自哪個收件匣對話（有才能「在收件匣開」）
function inboxNotifyDriver({ orderId, shortId, oriText, driverNo, text, chatKey }) {
  const key = `dchat:${orderId}`;
  const t = inbox.toasts.get(key) || { key, kind: "driver", orderId, count: 0, lines: [], timer: 0 };
  Object.assign(t, { shortId: shortId || t.shortId || "", oriText: oriText || t.oriText || "", driverNo: driverNo || t.driverNo || "", chatKey: chatKey || t.chatKey || "" });
  t.count += 1;
  t.lines.push(text || "[訊息]");
  if (t.lines.length > 3) t.lines.shift();
  clearTimeout(t.timer);
  t.timer = setTimeout(() => { inbox.toasts.delete(key); renderInboxToasts(); }, INBOX_TOAST_MS);
  inbox.toasts.set(key, t);
  renderInboxToasts();
  if (inbox.sound) inboxBeep();
  if (document.hidden && typeof Notification === "function" && Notification.permission === "granted") {
    try {
      const n = new Notification(`司機 ${t.driverNo}・${t.shortId}`, { body: t.lines.join("\n"), tag: key });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (_) {}
  }
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
// 兩個短音（收件匣新訊息、司機對話共用）。有人反應太小聲：三角波（泛音多、聽起來比正弦波響）、音量加大、每個音拉長一點
const TONE_PEAK = 0.85; // 兩個音不重疊，接近 1 也不會破音
const TONE_SECONDS = 0.26;
function playTwoTone(ctx) {
  try {
    const t0 = ctx.currentTime;
    [[880, 0], [1175, 0.16]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "triangle"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(TONE_PEAK, t0 + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + TONE_SECONDS);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + delay); osc.stop(t0 + delay + TONE_SECONDS + 0.02);
    });
  } catch (_) {}
}
const inboxSoundReady = () => !inbox.sound || (inbox.audio && inbox.audio.state === "running");

export { inboxBeep, inboxDismissToast, inboxUnlockAudio, inboxNotify, inboxNotifyDriver, inboxSoundReady, playTwoTone };
