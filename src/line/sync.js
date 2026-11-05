// 同步客戶與記事本到後端：翻對話清單、平行讀記事本、分塊上傳、commit。
import { lineBackendRequest, lineSyncHeaders } from "../core/backend.js";
import { getOaId } from "../core/page-context.js";
import { LINE_RATE_PER_MINUTE, fetchLineDirectoryPage, fetchLineJson, lineChatsPageUrl, makeLineRateLimiter } from "./fetch.js";
import { LINE_BOT_ID_RE, progressToast } from "../uturn-open.js";

/* ---------------------------------------------------------------------- *\
 * 同步客戶與記事本（同一條流程，不需後台帳號；同一分頁只防重複執行）
 *
 * 2026-10-26 在 chat.line.biz 實測（約 44,000 位客人的官方帳號）：
 * - 對話清單 GET /api/v2/bots/{botId}/chats 每頁最多 25 位（超過回 400 exceeded_limit），
 *   游標分頁只能一頁接一頁翻，約 2 頁／秒，幾萬位要十幾分鐘，開再多路也快不了。
 * - 記事本 GET /api/v1/bots/{botId}/chats/{chatId}/notes?limit=20&withTotal=true
 *   → { list: [{ noteId, body, createdAt, updatedAt, userBizId }], total }，
 *   25 個同時打約 0.2 秒、沒有 429，可以平行讀。
 * - LINE API 每分鐘 1,000 個請求的限流（見 makeLineRateLimiter），所以全域限速每分鐘 900 個，
 *   4.4 萬位約 50 分鐘；名單翻頁（每秒 2 頁）與記事本共用同一份額度。
 * - 記事本只有作者的 userBizId，名字在 GET /api/v1/bots/{botId}/owners → { list: [{ bizId, name }] }。
 * - 對話物件 profile.name 是客人 LINE 原名、profile.nickname 是客服改的暱稱；沒有「有無記事本」欄位。
 * - 整份名單約 12.7 MB，單一請求上傳不可行。
 *
 * 所以：翻到一頁就把那 25 位的記事本交給工作池平行讀；每湊滿 LINE_SYNC_CHUNK 位（客戶列＋記事本列）
 * 就 PUT 一個 chunk 到後端的同步工作暫存；名單翻完、記事本讀完、chunk 都傳完才 commit，
 * 後端對過筆數再整份換掉舊的客戶清單與記事本。任何一步失敗就 DELETE 同步工作，後端資料維持原樣。
 * ---------------------------------------------------------------------- */
const LINE_SYNC_CHUNK = 500; // 每 chunk 幾位客人
const LINE_NOTE_CONCURRENCY = 12; // 同時讀幾位客人的記事本
const LINE_NOTE_PAGE_LIMIT = 20; // 每位客人最多翻 20 頁記事本
const LINE_NOTE_RETRIES = 3; // LINE 5xx 退避重試次數（429 由限速器處理，不算失敗）
const LINE_CHUNK_RETRIES = 3; // chunk 上傳（同 index 重送＝覆蓋，可重試）退避次數
const LINE_NOTE_URLS = [
  (botId, chatId) => new URL(`/api/v1/bots/${botId}/chats/${encodeURIComponent(chatId)}/notes?limit=20&withTotal=true`, location.origin),
  (botId, chatId) => new URL(`/api/v1/bots/${botId}/chats/${encodeURIComponent(chatId)}/notes`, location.origin),
  (botId, chatId) => new URL(`/api/v2/bots/${botId}/chats/${encodeURIComponent(chatId)}/notes`, location.origin),
];
// 毫秒、秒（< 1e12）、數字字串或 ISO 字串 → 毫秒；看不懂回 0
function toEpochMs(v) {
  const t = typeof v === "number" ? v : typeof v === "string" ? (/^\d+$/.test(v) ? Number(v) : Date.parse(v)) : NaN;
  return Number.isFinite(t) && t > 0 ? Math.round(t < 1e12 ? t * 1000 : t) : 0;
}
const firstText = (values) => values.find((v) => typeof v === "string" && v.trim())?.trim() || "";
// 可重複等待／喚醒的訊號：讀名單、讀記事本、上傳三方有新進度就喚醒對方
function makeWakeup() {
  let resolve;
  let promise = new Promise((r) => { resolve = r; });
  return {
    wait: () => promise,
    fire: () => { const done = resolve; promise = new Promise((r) => { resolve = r; }); done(); },
  };
}
// 暫時性錯誤退避重試（1s、2s、3s…）；已取消或不可重試就直接丟
async function withBackoff(task, retries, isRetryable, signal) {
  for (let attempt = 0; ; attempt++) {
    try { return await task(); } catch (error) {
      if (signal?.aborted || attempt >= retries || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
const lineHttpRetryable = (error) => /^HTTP 5\d\d$/.test(error?.message || "");
const backendRetryable = (error) => error?.name !== "AbortError" &&
  (error?.uncertain === true || error?.status === 429 || error?.status >= 500);
async function fetchLineOwnerNames(botId, run) {
  const data = await fetchLineJson(new URL(`/api/v1/bots/${botId}/owners`, location.origin), run);
  const list = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
  return new Map(list.filter((o) => o && typeof o.bizId === "string").map((o) => [o.bizId, firstText([o.name])]));
}
function parseLineNote(note, ownerNames) {
  if (!note || typeof note !== "object") return null;
  const text = firstText([note.body, note.text, note.content, note.note]);
  if (!text) return null;
  return {
    text,
    authorName: firstText([ownerNames.get(note.userBizId), note.createdBy?.name, note.author?.name, note.operator?.name]),
    createdAt: [note.createdAt, note.created, note.createdTime, note.updatedAt].map(toEpochMs).find(Boolean) || 0,
  };
}
// 讀一位客人的全部記事本；回應看不懂、筆數對不上 total、游標重複或超過頁數上限都丟錯（不接受只讀一部分）
async function fetchLineChatNotes(makeUrl, botId, chatId, run, ownerNames) {
  const notes = [];
  const cursors = new Set();
  let cursorKey = "", cursor = "", seen = 0;
  for (let page = 0; page < LINE_NOTE_PAGE_LIMIT; page++) {
    const url = makeUrl(botId, chatId);
    if (cursor) url.searchParams.set(cursorKey, cursor);
    const data = await fetchLineJson(url, run);
    const list = Array.isArray(data) ? data : [data?.list, data?.notes, data?.items].find(Array.isArray);
    if (!list) throw new Error("記事本回應缺少清單");
    seen += list.length;
    for (const note of list) {
      const parsed = parseLineNote(note, ownerNames);
      if (parsed) notes.push(parsed);
    }
    [cursorKey, cursor] = typeof data?.next === "string" && data.next ? ["next", data.next]
      : typeof data?.nextCursor === "string" && data.nextCursor ? ["cursor", data.nextCursor] : ["", ""];
    if (!cursor) {
      if (Number.isInteger(data?.total) && data.total !== seen)
        throw new Error(`記事本筆數不符（LINE 說 ${data.total} 則，只讀到 ${seen} 則）`);
      return notes;
    }
    if (cursors.has(cursor)) throw new Error("記事本下一頁游標重複");
    cursors.add(cursor);
  }
  throw new Error(`有客人的記事本超過 ${LINE_NOTE_PAGE_LIMIT} 頁`);
}
// 用第一位客人依序試候選網址，回傳 { makeUrl, notes }；全部失敗就停（不猜）
async function probeLineNoteUrl(botId, chatId, run, ownerNames) {
  for (const makeUrl of LINE_NOTE_URLS) {
    try {
      return { makeUrl, notes: await fetchLineChatNotes(makeUrl, botId, chatId, run, ownerNames) };
    } catch (error) {
      if (run.controller.signal.aborted) throw error;
    }
  }
  throw new Error("讀不到 LINE 記事本（LINE 介面可能改版），請截圖 F12 Network 裡打開記事本時的請求給工程師");
}
function lineCustomerRow(chat) {
  const profile = chat.profile || {};
  return {
    lineName: profile.name || profile.nickname || "（未提供名稱）", // LINE 原名（沒有才用暱稱）
    nickname: firstText([profile.nickname, chat.nickname]), // 客服改的暱稱（沒有就空字串）
    chatId: chat.chatId,
    // 與 LINE 前端 ProfileIcon 使用相同的頭像預覽網址。
    avatarUrl: profile.iconHash && profile.iconHash !== "biz-app"
      ? `https://profile.line-scdn.net/${encodeURIComponent(profile.iconHash)}/preview` : "",
  };
}
function lineNoteRow(chat, notes) {
  const profile = chat.profile || {};
  return {
    chatId: chat.chatId,
    lineName: firstText([profile.name]), // LINE 原本的名稱
    nickname: firstText([profile.nickname, chat.nickname]), // 客服改的暱稱（沒有就空字串）
    notes,
  };
}
// 同步完成的提示文字（進階選單與群發視窗共用）
function lineSyncResultText(result) {
  return result.replaced
    ? `已同步 ${result.customers.toLocaleString()} 位客戶、記事本 ${result.chatsWithNotes.toLocaleString()} 位 ${result.notes.toLocaleString()} 則`
    : "LINE 清單為空，未更動後端資料";
}
// 各官方帳號最後同步時間（後端名單的 updatedAt；同步成功即更新），顯示在同步按鈕後面
const lineLastSyncAt = new Map();
function lineLastSyncLabel(groupId) {
  const at = lineLastSyncAt.get(groupId);
  if (at === undefined) return "";
  if (!at) return "（尚未同步）";
  const d = new Date(at), pad = (n) => String(n).padStart(2, "0");
  return `（最後同步 ${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}）`;
}
function rememberLineLastSync(groupId, updatedAt) {
  const ms = updatedAt ? Date.parse(updatedAt) : 0;
  lineLastSyncAt.set(groupId, Number.isFinite(ms) ? ms : 0);
}
// 向後端讀最後同步時間（只取 1 筆名單）；讀不到就不顯示
async function refreshLineLastSync(groupId) {
  if (!LINE_BOT_ID_RE.test(groupId)) return;
  try {
    const data = await lineBackendRequest("GET", `/line-oa/${encodeURIComponent(groupId)}/customers?pageNum=1&pageSize=1`);
    if (data?.groupId === groupId) rememberLineLastSync(groupId, data.updatedAt);
  } catch (_) {}
}
let lineSync = null;
function syncLineData() {
  const groupId = getOaId();
  if (lineSync?.groupId === groupId) return lineSync.promise;
  const promise = runLineSync(groupId).then((result) => {
    if (result?.replaced) lineLastSyncAt.set(groupId, Date.now());
    return result;
  }).finally(() => {
    if (lineSync?.promise === promise) lineSync = null;
  });
  lineSync = { groupId, promise };
  return promise;
}
async function runLineSync(botId) {
  if (!LINE_BOT_ID_RE.test(botId)) throw new Error("請先選擇 LINE 官方帳號");
  const base = `/line-oa/${encodeURIComponent(botId)}/syncs`;
  const run = { controller: new AbortController(), limiter: makeLineRateLimiter() };
  const { signal } = run.controller;
  const isCurrent = () => getOaId() === botId;
  const fail = (message) => { run.controller.abort(); throw new Error(message); };
  const ensureCurrent = () => { if (!isCurrent()) fail("官方帳號已變更，未更動後端資料"); };
  const wake = makeWakeup();
  signal.addEventListener("abort", wake.fire, { once: true });

  const stats = { read: 0, notesRead: 0, inFlight: 0, readingDone: false, uploaded: 0, chunks: 0, chatsWithNotes: 0, notes: 0 };
  const startedAt = Date.now();
  const progress = progressToast("同步客戶與記事本：建立後端同步工作…");
  const report = () => {
    const minutes = Math.floor((Date.now() - startedAt) / 60000);
    const pausedFor = Math.ceil((run.limiter.pausedUntil - Date.now()) / 1000);
    progress.set(`同步中…名單已讀 ${stats.read.toLocaleString()} 位${stats.readingDone ? "（讀完）" : ""}、` +
      `記事本已讀 ${stats.notesRead.toLocaleString()} 位、已上傳 ${stats.uploaded.toLocaleString()} 位` +
      `（LINE 每分鐘最多 ${LINE_RATE_PER_MINUTE} 位，已 ${minutes} 分鐘` +
      (pausedFor > 0 ? `，LINE 限流中，等 ${pausedFor} 秒再續讀` : "") + "）");
  };
  const ticker = setInterval(report, 1000); // 限流暫停時沒有事件也要更新倒數

  let syncId = "";
  try {
    const session = await lineBackendRequest("POST", base, {}, signal, lineSyncHeaders());
    if (!session || session.groupId !== botId || typeof session.syncId !== "string" || !session.syncId)
      throw new Error("後端未建立同步工作，未更動後端資料");
    syncId = session.syncId;
    ensureCurrent();
    const ownerNames = await fetchLineOwnerNames(botId, run);
    ensureCurrent();

    const chats = new Map(); // chatId → 對話物件（去重）
    const pending = []; // 等讀記事本
    const ready = []; // { chat, notes }：讀完記事本，等上傳
    let makeUrl = null, probing = null;

    const reader = async () => {
      let next = "";
      const cursors = new Set();
      try {
        do {
          ensureCurrent();
          const page = await fetchLineDirectoryPage(lineChatsPageUrl(botId, next), run);
          for (const chat of page.list) {
            if (!chat || typeof chat.chatId !== "string" || !chat.chatId)
              throw new Error("對話資料缺少 chatId");
            if (chats.has(chat.chatId)) continue;
            chats.set(chat.chatId, chat);
            pending.push(chat);
          }
          stats.read = chats.size;
          next = page.next || "";
          if (next && cursors.has(next)) throw new Error("下一頁游標重複");
          if (next) cursors.add(next);
          report(); wake.fire();
        } while (next);
      } catch (error) {
        if (signal.aborted || !isCurrent()) throw error;
        fail(`LINE 名單未讀取完整，未更動後端資料：${run.timedOut ? "讀取逾時" : error.message || error}`);
      }
      stats.readingDone = true;
      report(); wake.fire();
    };

    const readNotes = async (chat) => {
      if (!makeUrl) {
        // 第一位客人先找出可用的記事本網址，其他路等它
        if (!probing) probing = probeLineNoteUrl(botId, chat.chatId, run, ownerNames)
          .then((probed) => { makeUrl = probed.makeUrl; return { chatId: chat.chatId, notes: probed.notes }; });
        const probed = await probing;
        if (probed.chatId === chat.chatId) return probed.notes;
      }
      return withBackoff(() => fetchLineChatNotes(makeUrl, botId, chat.chatId, run, ownerNames),
        LINE_NOTE_RETRIES, lineHttpRetryable, signal);
    };
    const noteWorker = async () => {
      for (;;) {
        if (signal.aborted) return;
        const chat = pending.shift();
        if (chat) {
          stats.inFlight++;
          try {
            ready.push({ chat, notes: await readNotes(chat) });
          } catch (error) {
            if (signal.aborted || !isCurrent()) throw error;
            fail(`讀取記事本失敗，未更動後端資料：${run.timedOut ? "讀取逾時" : error.message || error}`);
          } finally { stats.inFlight--; }
          stats.notesRead++;
          report(); wake.fire();
        } else if (stats.readingDone) return;
        else await wake.wait();
      }
    };

    const uploadChunk = async (index, batch) => {
      ensureCurrent();
      const body = {
        customers: batch.map(({ chat }) => lineCustomerRow(chat)),
        notes: batch.filter(({ notes }) => notes.length).map(({ chat, notes }) => lineNoteRow(chat, notes)),
      };
      const result = await withBackoff(() => lineBackendRequest("PUT", `${base}/${encodeURIComponent(syncId)}/chunks/${index}`,
        body, signal, lineSyncHeaders()), LINE_CHUNK_RETRIES, backendRetryable, signal);
      if (!result || result.syncId !== syncId || result.index !== index ||
          result.customers !== body.customers.length || result.notes !== body.notes.length)
        throw new Error("後端回傳的分批結果不符，未更動後端資料");
      stats.chatsWithNotes += body.notes.length;
      stats.notes += body.notes.reduce((n, row) => n + row.notes.length, 0);
    };
    const uploader = async () => {
      for (;;) {
        if (signal.aborted) return;
        const allRead = stats.readingDone && !pending.length && !stats.inFlight;
        if (ready.length >= LINE_SYNC_CHUNK || (allRead && ready.length)) {
          const batch = ready.splice(0, LINE_SYNC_CHUNK);
          await uploadChunk(stats.chunks, batch);
          stats.chunks++;
          stats.uploaded += batch.length;
          report();
        } else if (allRead) return;
        else await wake.wait();
      }
    };

    await Promise.all([reader(), uploader(), ...Array.from({ length: LINE_NOTE_CONCURRENCY }, noteWorker)]);
    ensureCurrent();
    if (!chats.size) return { groupId: botId, replaced: false, customers: 0, chatsWithNotes: 0, notes: 0 };

    progress.set(`全部讀完，請後端換上 ${chats.size.toLocaleString()} 位客人的新資料…`);
    const expected = { chunks: stats.chunks, customers: chats.size, chatsWithNotes: stats.chatsWithNotes, notes: stats.notes };
    const result = await lineBackendRequest("POST", `${base}/${encodeURIComponent(syncId)}/commit`, expected, signal, lineSyncHeaders());
    if (!result || result.groupId !== botId || result.replaced !== true || result.customers !== expected.customers ||
        result.chatsWithNotes !== expected.chatsWithNotes || result.notes !== expected.notes)
      throw new Error("後端回傳的同步結果不符，請重新同步確認");
    syncId = ""; // 已 commit，不再撤銷
    return result;
  } catch (error) {
    if (!isCurrent()) throw new Error("官方帳號已變更，未更動後端資料");
    throw error;
  } finally {
    clearInterval(ticker);
    run.controller.abort(); // 停掉還在跑的讀取
    // 沒 commit 的同步工作撤銷掉，後端資料維持原樣（盡力而為，不等結果）
    if (syncId) lineBackendRequest("DELETE", `${base}/${encodeURIComponent(syncId)}`).catch(() => {});
    progress.done();
  }
}
async function fetchSavedLineCustomers(groupId, pageNum, pageSize, search, signal) {
  const query = new URLSearchParams({ pageNum: String(pageNum), pageSize: String(pageSize) });
  if (search) query.set("search", search);
  const data = await lineBackendRequest("GET",
    `/line-oa/${encodeURIComponent(groupId)}/customers?${query}`, undefined, signal);
  const p = data?.pagination;
  if (data?.groupId !== groupId || !Array.isArray(data.customers) || !p ||
      p.currentPage !== pageNum || !Number.isInteger(p.pageSize) || p.pageSize < 1 || p.pageSize > 500 ||
      !Number.isInteger(p.totalItems) || p.totalItems < 0 ||
      !Number.isInteger(p.totalPages) || p.totalPages < 0 ||
      (p.totalItems > 0 && p.totalPages !== Math.ceil(p.totalItems / p.pageSize)) ||
      (p.totalItems === 0 && p.totalPages > 1) ||
      data.customers.length > p.pageSize)
    throw new Error("客戶清單或分頁資料格式不符");
  const seen = new Set();
  const customers = data.customers.map((row) => {
    if (!row || typeof row.chatId !== "string" || !row.chatId.trim() || seen.has(row.chatId))
      throw new Error("客戶清單缺少 chatId 或包含重複資料");
    seen.add(row.chatId);
    return { chatId: row.chatId, lineName: String(row.lineName || "（未提供名稱）"),
      avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : "" };
  });
  rememberLineLastSync(groupId, data.updatedAt);
  return { ...data, customers };
}

export { fetchSavedLineCustomers, firstText, lineLastSyncLabel, lineSyncResultText, refreshLineLastSync, syncLineData, toEpochMs };
