// 群發視窗（客戶選取、傳送設定、進度與結果）與訊息作業的建立／暫停／恢復／重送。
import { lineBackendRequest, saveLineCookie, storedSendKey } from "../core/backend.js";
import { API_BASE, LINE_HOURLY_LIMIT_KEY, SKIP_GROUP_CHATS_KEY } from "../core/constants.js";
import { ic } from "../core/icons.js";
import { getOaId, getOaName } from "../core/page-context.js";
import { storeGet, storeSet } from "../core/store.js";
import { LINE_CUSTOMER_PAGE_SIZE, LINE_RECIPIENT_LIMIT, fetchLineCardMessages, fetchLineCoupons, lineCardPageSummary, lineCardPages, lineCouponAvailable, lineDisplayMessage, lineRequestError } from "./content.js";
import { fetchSavedLineCustomers, lineLastSyncLabel, lineSyncResultText, syncLineData } from "./sync.js";
import { getDispatcher } from "../settings.js";
import { toast } from "../ui/toast.js";

let lineCustomerDialog = null;
const LINE_JOB_TERMINAL = new Set(["completed", "completed_with_errors", "failed", "needs_review", "cancelled"]);
const LINE_JOB_LABELS = {
  queued: "已入隊，等待傳送", running: "傳送中", scheduled: "分批傳送中，等下一批", paused: "已暫停",
  cancelling: "正在取消", waiting_credentials: "等待身份授權",
  completed: "全部傳送成功", completed_with_errors: "傳送完成，部分失敗", failed: "傳送失敗",
  needs_review: "有結果不明的訊息，請人工確認", cancelled: "已取消",
};
const LINE_DELIVERY_LABELS = { pending: "待處理", sending: "傳送中", sent: "成功", failed: "失敗", unknown: "結果不明", cancelled: "已取消" };
const LINE_DELIVERY_ERRORS = {
  LINE_COOKIE_INVALID: "Cookie 失效", LINE_RATE_LIMITED: "LINE 暫時限制發送，這則未送出", LINE_NETWORK_ERROR: "連線失敗，這則未送出",
  LINE_REJECTED: "LINE 拒絕發送", LINE_RESULT_UNKNOWN: "無法確認是否已送出", WORKER_INTERRUPTED: "發送途中服務重新啟動",
  PRECEDING_MESSAGE_NOT_SENT: "前一則未送出，這則未發送",
  IMAGE_ASSET_UNAVAILABLE: "後端讀不到原圖", LINE_IMAGE_UPLOAD_FAILED: "圖片上傳失敗，這則未發送",
  COUPON_NOT_FOUND: "優惠券不存在或不屬於此官方帳號", COUPON_EXPIRED: "優惠券已到期",
  COUPON_UNAVAILABLE: "優惠券目前不可發送",
  CARD_TYPE_MESSAGE_NOT_FOUND: "多頁訊息已刪除或不屬於此官方帳號",
};
const LINE_INVALID_IMAGE_CODES = new Set(["IMAGE_ASSET_EXPIRED", "IMAGE_ASSET_NOT_FOUND"]);
// LINE：官方帳號 1 小時內傳給超過 200 位不同客戶會暫時鎖住一對一聊天（客服也無法回覆），後端最高只開 190 位
const LINE_HOURLY_LIMIT_MAX = 190;
const LINE_HOURLY_LIMIT_DEFAULT = 180;
const LINE_SEND_INTERVAL_SECONDS = 3; // 後端每則間隔（LINE 每分鐘約 20 則），只用於預估時間
const LINE_JOB_SENDING = new Set(["queued", "running", "scheduled"]);
const LINE_JOB_RESUMABLE = new Set(["paused", "waiting_credentials"]);
const lineTimeText = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
};
const lineDurationText = seconds => {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.round(minutes / 6) / 10;
  return hours < 24 ? `${hours} 小時` : `${Math.floor(hours / 24)} 天 ${Math.round(hours % 24)} 小時`;
};
// 分批預估：每小時最多 limit 位，每位 messages 則、每則間隔 3 秒；與後端 estimatedFinishAt 同口徑
function lineBatchPlan(recipients, limit, messages = 1) {
  const perRecipient = messages * LINE_SEND_INTERVAL_SECONDS;
  const batches = Math.max(1, Math.ceil(recipients / limit));
  const last = recipients - (batches - 1) * limit;
  const seconds = (batches - 1) * 3600 + last * perRecipient;
  return { batches, seconds, finishAt: Date.now() + seconds * 1000 };
}
const LINE_SELECTION_ERROR_TYPES = {
  __proto__: null,
  INVALID_COUPON: "coupon", COUPON_NOT_FOUND: "coupon", COUPON_EXPIRED: "coupon", COUPON_UNAVAILABLE: "coupon",
  INVALID_CARD_TYPE_MESSAGE: "cardType", CARD_TYPE_MESSAGE_NOT_FOUND: "cardType",
};
// 這些素材驗證在 requestId 冪等查找後（發送 KEY 在查找前），明確表示原作業尚未建立。
const LINE_INVALID_CONTENT_CODES = new Set(["COUPON_NOT_FOUND", "COUPON_EXPIRED", "COUPON_UNAVAILABLE", "CARD_TYPE_MESSAGE_NOT_FOUND"]);
const lineMessageJobEntries = new Map();
function createLineMessageJobView(container, groupId, account, isCurrent, onChange, sendAccess) {
  const key = `loe_message_job_v1::${encodeURIComponent(account)}::${groupId}`;
  if (!lineMessageJobEntries.has(key)) {
    const saved = storeGet(key, null);
    lineMessageJobEntries.set(key, { value: saved?.account === account && saved?.groupId === groupId ? saved : null,
      busy: false, notice: "", listeners: new Set() });
  }
  const entry = lineMessageJobEntries.get(key);
  // 已結束的作業保留結果供查看，不再鎖住下一次訊息的編輯區。
  const finished = value => !!value?.jobId && LINE_JOB_TERMINAL.has(value.status);
  const editable = value => !value || finished(value) || (value.rejected && !value.uncertain && !value.retrySameRequest);
  const locked = () => entry.busy || !editable(entry.value);
  const rootPath = `/line-oa/${encodeURIComponent(groupId)}/message-jobs`;
  let closed = false, timer = null, hideTimer = null, pollController = null, resultController = null;
  let toastVisible = !!entry.value && !finished(entry.value);
  let resultPage = 1, resultPages = 0, resultFilter = "failed", autoResultsJobId = "";
  const active = () => !closed && isCurrent();
  const persist = (value) => {
    storeSet(key, value);
    if (JSON.stringify(storeGet(key, null)) !== JSON.stringify(value)) throw new Error("無法保存傳送紀錄，尚未送出，請檢查瀏覽器儲存空間");
  };
  const notify = () => { for (const listener of entry.listeners) listener(); };
  const update = (value) => {
    entry.value = value;
    try { persist(value); } catch (_) { entry.notice = "無法保存目前進度，請保持此視窗開啟並聯絡後台協助"; }
    notify();
  };
  const jobPath = (value = entry.value) => `${rootPath}/${encodeURIComponent(value.jobId)}`;
  const statusPath = (value) => {
    const fallback = `${jobPath(value)}?account=${encodeURIComponent(account)}`;
    try {
      const url = new URL(value.statusUrl || fallback, API_BASE);
      if (url.origin === new URL(API_BASE).origin && url.pathname === jobPath(value) && url.searchParams.get("account") === account)
        return url.pathname + url.search;
    } catch (_) {}
    return fallback;
  };
  const validJob = (data, value) => {
    const names = ["total", "pending", "sending", "sent", "failed", "unknown", "cancelled"];
    if (!data || data.jobId !== value.jobId || data.groupId !== groupId ||
        data.requestId !== value.requestId || !Object.hasOwn(LINE_JOB_LABELS, data.status) ||
        !Number.isInteger(data.recipientCount) || data.recipientCount < 1 ||
        !Number.isInteger(data.excludedCount) || data.excludedCount < 0 || data.excludedCount > LINE_RECIPIENT_LIMIT ||
        !names.every(name => Number.isInteger(data.counts?.[name]) && data.counts[name] >= 0) ||
        names.slice(1).reduce((sum, name) => sum + data.counts[name], 0) !== data.counts.total)
      throw new Error("傳送進度格式不符，請重新整理進度");
    return data;
  };
  container.className = "loe-message-toast";
  container.setAttribute("aria-label", "訊息傳送通知");
  container.innerHTML = `
      <div class="loe-message-toast-head"><strong data-job="title" role="status" aria-live="polite"></strong><button class="loe-mini" type="button" data-job="dismiss" aria-label="關閉傳送通知">×</button></div>
      <progress data-job="progress" aria-label="傳送處理進度" max="1" value="0" hidden></progress>
      <div data-job="recipients" aria-live="polite" hidden></div>
      <div data-job="counts" aria-live="polite"></div>
      <div class="loe-customers-muted" data-job="schedule" aria-live="polite" hidden></div>
      <div class="loe-customers-notice" data-job="notice" role="status" aria-live="polite" hidden></div>
      <div class="loe-customers-muted" data-job="send-gate" role="status" aria-live="polite" hidden></div>
      <div class="loe-customers-toolbar">
        <button type="button" class="loe-mini" data-job="retry">重試同一次傳送</button>
        <button type="button" class="loe-mini" data-job="refresh">重新整理進度</button>
        <button type="button" class="loe-mini" data-job="save-cookie">身份授權</button>
        <button type="button" class="loe-mini" data-job="pause">暫停傳送</button>
        <button type="button" class="loe-mini" data-job="resume">恢復傳送</button>
        <button type="button" class="loe-mini" data-job="retry-failed">重送失敗客戶</button>
        <button type="button" class="loe-mini" data-job="cancel">取消整批（尚未傳送的）</button>
      </div>
      <details data-job="details"><summary>查看詳情</summary>
      <div class="loe-customers-muted" data-job="id"></div>
      <p class="loe-customers-preview-text" data-job="pending-text" hidden></p>
      <div data-job="results" hidden>
        <div class="loe-customers-toolbar"><label>收件結果 <select data-job="filter" aria-label="收件結果篩選"><option value="failed">失敗</option><option value="unknown">結果不明</option><option value="sent">成功</option><option value="cancelled">已取消</option><option value="pending">待處理</option><option value="sending">傳送中</option></select></label><button class="loe-mini" type="button" data-job="results-reload">重新讀取結果</button></div>
        <div data-job="results-status" class="loe-customers-muted" role="status"></div>
        <div class="loe-message-results" data-job="results-list"></div>
        <div class="loe-customers-toolbar"><button class="loe-mini" type="button" data-job="results-prev">結果上一頁</button><span data-job="results-pages"></span><button class="loe-mini" type="button" data-job="results-next">結果下一頁</button></div>
      </div></details>`;
  const find = name => container.querySelector(`[data-job="${name}"]`);
  const refreshSendGate = () => {
    const value = entry.value;
    const needed = !!value?.payload || LINE_JOB_RESUMABLE.has(value?.status) || value?.retryableCount > 0;
    const error = needed ? sendAccess.error(value) : "";
    find("send-gate").textContent = error;
    find("send-gate").hidden = !error;
    for (const name of ["retry", "resume", "retry-failed"]) find(name).disabled = entry.busy || !!pollController || !!error;
  };
  const schedule = () => {
    clearTimeout(timer); timer = null;
    const value = entry.value;
    if (active() && value?.jobId && !entry.busy && !pollController &&
        !LINE_JOB_TERMINAL.has(value.status) && !LINE_JOB_RESUMABLE.has(value.status))
      // 等下一批／排在別批後面時放慢輪詢
      timer = setTimeout(() => { timer = null; void refresh(); }, value.status === "scheduled" || value.jobsAhead > 0 ? 30000 : 2500);
  };
  const render = () => {
    if (!active()) return;
    const value = entry.value;
    container.hidden = !toastVisible || (!value && !entry.notice);
    find("title").textContent = value?.jobId ? LINE_JOB_LABELS[value.status] || "正在讀取進度" :
      value ? (entry.busy ? "正在提交傳送" : value.retrySameRequest ? "暫時無法建立作業" : value.rejected ? "傳送未受理" : "尚未確認是否已入隊") : "傳送提示";
    find("id").textContent = value ? `收件人：${(value.recipientCount || value.payload?.chatIds.length || 0).toLocaleString()} 位` : "";
    find("recipients").hidden = !value?.jobId;
    find("recipients").textContent = value?.jobId && Number.isInteger(value.recipientCount) ? `實際收件 ${value.recipientCount.toLocaleString()} 位` +
      (Number.isInteger(value.excludedCount) ? ` · 不發送 ${value.excludedCount.toLocaleString()} 位` : "") : "";
    const errorCode = value?.actionErrorCode || value?.errorCode;
    const help = errorCode === "SEND_KEY_TOO_MANY_ATTEMPTS" ? "KEY 驗證失敗次數過多，請確認 KEY 正確後稍候一分鐘再試。" :
      errorCode?.startsWith("SEND_KEY_") ? (value.uncertain ? "請點「身份授權」輸入有效的發送 KEY，再重試同一次傳送以確認原作業結果。" :
        ["SEND_KEY_EXPIRED", "SEND_KEY_REVOKED"].includes(errorCode) ? "請向後台申請新的 KEY，點「身份授權」輸入後再傳送或恢復。" :
        "請點「身份授權」重新輸入屬於目前後台帳號的 KEY，再傳送或恢復。") :
      errorCode === "MESSAGE_JOB_SUBMIT_TOO_OFTEN" ? "請稍候一分鐘再手動重試；先前結果不明時，仍須沿用原本那次傳送。" :
      value?.jobsAhead > 0 ? `此官方帳號前面還有 ${value.jobsAhead} 批傳送尚未結束，這批會排隊，等前一批送完或取消後才開始（前一批暫停時也不會插隊）。` :
      value?.status === "scheduled" && errorCode === "LINE_RATE_LIMITED" ? "LINE 暫時限制發送，被擋的客戶已退回待傳送（不算失敗），時間到會自動接著送。" :
      value?.status === "scheduled" ? "本小時已送滿上限，時間到會自動接著送，不需要保持視窗開啟。要停下來請按「暫停傳送」或「取消整批」。" :
      value?.status === "paused" ? "已暫停，尚未傳送的客戶都保留著；按「恢復傳送」會從中斷處接著送，已送出的不會重送。" :
      value?.status === "waiting_credentials" ? "請重新點「身份授權」，再按「恢復傳送」。只會繼續尚未傳送的訊息。" :
      value?.status === "needs_review" ? "請檢查結果不明的客戶，確認對方是否已收到；系統不會自動重送。" :
      value?.retryableCount > 0 && LINE_JOB_TERMINAL.has(value.status) ? `有 ${value.retryableCount.toLocaleString()} 位確定沒送出，可按「重送失敗客戶」補送（已送出、結果不明、LINE 拒收的不會重送）。` :
      value?.retrySameRequest ? "作業尚未建立。請稍後按「重試同一次傳送」，會沿用原本的內容與收件人。" :
      !value?.jobId && ["LINE_COOKIE_MISSING", "LINE_COOKIE_INVALID"].includes(value?.errorCode) ?
        (value.uncertain ? "請重新點「身份授權」，再重試同一次傳送以確認結果。" : "請重新點「身份授權」，再按「傳送」。") :
      value?.rejected && LINE_SELECTION_ERROR_TYPES[value.errorCode] ?
        `請重新讀取${LINE_SELECTION_ERROR_TYPES[value.errorCode] === "coupon" ? "優惠券" : "多頁訊息"}清單並重新選擇，再按「傳送」。` :
      value?.rejected && LINE_INVALID_IMAGE_CODES.has(value.errorCode) ? "請重新選圖或重新上傳，再按「傳送」。" :
      value?.rejected ? "可直接修改內容後，再按「傳送」。" :
      value?.payload && !entry.busy && !value.rejected ? "重試會沿用同一筆傳送與收件人，不會重複建立作業。" : "";
    find("notice").textContent = lineDisplayMessage([entry.notice || value?.actionErrorDetail || value?.errorDetail, help].filter(Boolean).join("\n"));
    find("notice").hidden = !find("notice").textContent;
    find("pending-text").hidden = !value?.payload;
    find("pending-text").textContent = value?.payload ? value.payload.messages.map(message =>
      message.type === "image" ? "圖片 1 張（已上傳，重試會使用同一張圖片）" :
      message.type === "coupon" ? "優惠券 1 張（重試會使用原優惠券）" :
      message.type === "cardType" ? "多頁訊息 1 組（重試會使用原多頁訊息）" : message.text).join("\n") : "";
    const counts = value?.counts;
    find("progress").hidden = !counts;
    find("counts").textContent = counts ? `共 ${counts.total.toLocaleString()} 則 · 成功 ${counts.sent}` +
      (counts.failed ? ` · 失敗 ${counts.failed}` : "") + (counts.unknown ? ` · 結果不明 ${counts.unknown}` : "") +
      (counts.cancelled ? ` · 已取消 ${counts.cancelled}` : "") +
      (counts.pending + counts.sending ? ` · 待完成 ${counts.pending + counts.sending}` : "") : "";
    if (counts) { find("progress").max = counts.total || 1; find("progress").value = counts.sent + counts.failed + counts.unknown + counts.cancelled; }
    const scheduleParts = !value?.jobId || !Number.isInteger(value.hourlyLimit) || LINE_JOB_TERMINAL.has(value.status) ? [] : [
      `每小時上限 ${value.hourlyLimit} 位`,
      Number.isInteger(value.sentLastHour) ? `此官方帳號過去 1 小時已送 ${value.sentLastHour} 位` : "",
      value.status === "scheduled" && value.nextRunAt ? `下一批 ${lineTimeText(value.nextRunAt)} 開始` : "",
      value.estimatedFinishAt ? `預計 ${lineTimeText(value.estimatedFinishAt)} 送完` : "",
    ].filter(Boolean);
    find("schedule").textContent = scheduleParts.join(" · ");
    find("schedule").hidden = !scheduleParts.length;
    const ended = LINE_JOB_TERMINAL.has(value?.status);
    find("retry").hidden = !value?.payload || (!!value.rejected && !value.retrySameRequest);
    find("refresh").hidden = !value?.jobId || (!entry.notice && Number.isInteger(value.excludedCount));
    const keyRejected = !!errorCode?.startsWith("SEND_KEY_") && errorCode !== "SEND_KEY_TOO_MANY_ATTEMPTS";
    find("save-cookie").hidden = !(value?.status === "waiting_credentials" || keyRejected || ["LINE_COOKIE_MISSING", "LINE_COOKIE_INVALID"].includes(value?.errorCode));
    find("resume").hidden = !LINE_JOB_RESUMABLE.has(value?.status);
    find("pause").hidden = !LINE_JOB_SENDING.has(value?.status);
    find("retry-failed").hidden = !(value?.retryableCount > 0) || ["cancelled", "cancelling"].includes(value?.status);
    find("cancel").hidden = !value?.jobId || ended || value.status === "cancelling";
    find("dismiss").hidden = locked();
    for (const name of ["retry", "save-cookie", "pause", "resume", "retry-failed", "cancel"]) find(name).disabled = entry.busy || !!pollController;
    refreshSendGate();
    find("refresh").disabled = entry.busy || !!pollController;
    find("results").hidden = !value?.jobId;
    if (value?.jobId && ended && counts && autoResultsJobId !== value.jobId) {
      resultFilter = counts?.unknown ? "unknown" : counts?.failed ? "failed" : counts?.sent ? "sent" : "cancelled";
      find("filter").value = resultFilter;
      if (find("details").open) void loadResults(1);
    }
    clearTimeout(hideTimer);
    if (toastVisible && ["completed", "cancelled"].includes(value?.status) && !entry.notice && !find("details").open)
      hideTimer = setTimeout(() => { toastVisible = false; container.hidden = true; }, 6000);
    onChange();
    schedule();
  };
  async function refresh() {
    const value = entry.value;
    if (!active() || !value?.jobId || entry.busy || pollController) return;
    clearTimeout(timer); timer = null;
    const controller = pollController = new AbortController();
    render();
    try {
      const data = await lineBackendRequest("GET", statusPath(value), undefined, controller.signal);
      if (!active() || entry.value?.jobId !== value.jobId) return;
      const job = validJob(data, value);
      entry.notice = "";
      update({ ...value, ...job, ...(finished(job) ? { actionErrorCode: "", actionErrorDetail: "" } : {}) });
    } catch (error) {
      if (active() && error.name !== "AbortError") { entry.notice = error.message; }
    } finally {
      if (pollController === controller) pollController = null;
      render();
    }
  }
  async function submit() {
    const value = entry.value;
    if (!active() || entry.busy || !value?.payload) return;
    const accessError = sendAccess.error(value);
    if (accessError) { entry.notice = accessError; notify(); return; }
    const wasUncertain = value.uncertain;
    try { persist({ ...value, uncertain: true }); }
    catch (error) { entry.notice = error.message; notify(); return; }
    entry.busy = true; entry.notice = ""; notify();
    try {
      const data = await lineBackendRequest("POST", rootPath, value.payload, undefined, { "X-Line-Send-Key": sendAccess.key() });
      if (!data || typeof data.jobId !== "string" || !data.jobId || data.jobId.length > 128 ||
          !Object.hasOwn(LINE_JOB_LABELS, data.status) || !Number.isInteger(data.recipientCount) || data.recipientCount < 1 ||
          !Number.isInteger(data.excludedCount) || data.excludedCount < 0 || data.excludedCount > LINE_RECIPIENT_LIMIT)
        throw lineRequestError("作業回應格式不符，請重試同一次傳送以確認結果", 202, "", true);
      update({ account, groupId, requestId: value.requestId, jobId: data.jobId, statusUrl: data.statusUrl,
        status: data.status, recipientCount: data.recipientCount, messageCount: data.messageCount, reused: data.reused,
        excludedCount: data.excludedCount, excludedChatIds: value.payload.excludedChatIds });
      entry.notice = data.reused ? "已接回原本的傳送作業，沒有重複建立。" : "";
    } catch (error) {
      entry.notice = error.message;
      // 後端順序：提交限流 → 發送 KEY → 依 requestId 找既有作業 → 驗證素材。素材明確失效時可重新選擇並建立新作業；
      // KEY 在冪等查找之前，KEY 失效時無法確認原作業，換有效 KEY 重試同一次即可接回（KEY 不參與內容比對）。
      const invalidImage = (error.status === 404 && error.code === "IMAGE_ASSET_NOT_FOUND") ||
        (error.status === 409 && error.code === "IMAGE_ASSET_EXPIRED");
      const invalidContent = error.status === 422 && LINE_INVALID_CONTENT_CODES.has(error.code);
      // LINE_UNAVAILABLE 明確未建立作業，但契約要求保留原 requestId/body 重試。
      const retrySameRequest = error.status === 503 && error.code === "LINE_UNAVAILABLE";
      const storageRejected = error.status === 503 && error.code === "IMAGE_STORAGE_UNAVAILABLE";
      const uncertain = !invalidImage && !invalidContent && !retrySameRequest &&
        (!!wasUncertain || (!storageRejected && error.uncertain === true));
      update({ ...value, uncertain, rejected: !uncertain, retrySameRequest, errorCode: error.code || "", errorDetail: error.message });
    } finally { entry.busy = false; notify(); if (active() && entry.value?.jobId) void refresh(); }
  }
  // kind：pause／resume／cancel／retry-failed；chatIds 只給 retry-failed（省略＝全部可重送的客戶）
  async function action(kind, chatIds) {
    const value = entry.value;
    if (!active() || entry.busy || !value?.jobId) return;
    const keyed = kind === "resume" || kind === "retry-failed";
    if (kind === "resume" && !LINE_JOB_RESUMABLE.has(value.status)) return;
    if (kind === "pause" && !LINE_JOB_SENDING.has(value.status)) return;
    if (keyed && sendAccess.error(value)) { entry.notice = sendAccess.error(value); notify(); return; }
    if (kind === "cancel" && (LINE_JOB_TERMINAL.has(value.status) || value.status === "cancelling")) return;
    if (kind === "cancel" && !confirm("取消整批：尚未傳送的客戶都不會再送（已送出的無法撤回）。確定取消？")) return;
    clearTimeout(timer); timer = null;
    if (pollController) { pollController.abort(); pollController = null; }
    entry.busy = true; entry.notice = ""; notify();
    try {
      const data = await lineBackendRequest("POST", `${jobPath(value)}/${kind}`, { account, ...(chatIds ? { chatIds } : {}) }, undefined,
        keyed ? { "X-Line-Send-Key": sendAccess.key() } : {});
      const job = kind === "retry-failed" ? data?.job : data;
      if (kind === "retry-failed" && Number.isInteger(data?.requeued)) entry.notice = `已重新排入 ${data.requeued.toLocaleString()} 位，會依每小時上限接著送。`;
      // 恢復端點未承諾回傳完整進度，成功後以 GET 的結果為準。
      if (!job?.counts) {
        update({ ...value, actionErrorCode: "", actionErrorDetail: "" });
        entry.notice ||= "已送出要求，正在更新進度…";
      } else update({ ...value, ...validJob(job, value), actionErrorCode: "", actionErrorDetail: "" });
      if (kind === "retry-failed") autoResultsJobId = "";
    } catch (error) {
      entry.notice = error.message;
      update({ ...value, actionErrorCode: error.code || "", actionErrorDetail: error.message });
    }
    finally { entry.busy = false; notify(); if (active()) void refresh(); }
  }
  async function loadResults(page = 1) {
    const value = entry.value;
    if (!active() || !value?.jobId) return;
    autoResultsJobId = value.jobId;
    if (resultController) resultController.abort();
    const controller = resultController = new AbortController();
    find("results-status").textContent = "正在讀取收件結果…";
    find("results-list").replaceChildren();
    find("results-prev").disabled = find("results-next").disabled = true;
    const query = new URLSearchParams({ account, pageNum: String(page), pageSize: "50", status: resultFilter });
    try {
      const data = await lineBackendRequest("GET", `${jobPath(value)}/deliveries?${query}`, undefined, controller.signal);
      if (!active() || resultController !== controller || entry.value?.jobId !== value.jobId) return;
      const p = data?.pagination;
      if (data?.jobId !== value.jobId || !Array.isArray(data.deliveries) || !p || p.currentPage !== page ||
          !Number.isInteger(p.pageSize) || p.pageSize < 1 || p.pageSize > 500 || !Number.isInteger(p.totalItems) || p.totalItems < 0)
        throw new Error("收件結果格式不符，請重新讀取");
      resultPage = page; resultPages = Math.ceil(p.totalItems / p.pageSize);
      for (const row of data.deliveries) {
        const item = document.createElement("div"); item.className = "loe-message-result";
        const label = document.createElement("span");
        label.textContent = `${row.lineName || "（未提供名稱）"}\n第 ${Number(row.messageIndex) + 1} 則 ${{ image: "圖片", text: "文字", coupon: "優惠券", cardType: "多頁訊息" }[row.messageType] || row.messageType} · ${LINE_DELIVERY_LABELS[row.status] || row.status}` +
          (row.errorCode ? ` · ${Object.hasOwn(LINE_DELIVERY_ERRORS, row.errorCode) ? LINE_DELIVERY_ERRORS[row.errorCode] : "發送失敗"}` : "") +
          (Number.isInteger(row.uploadAttempts) && row.uploadAttempts >= 0 ? ` · 上傳嘗試 ${row.uploadAttempts} 次` : "") +
          (Number.isInteger(row.attempts) && row.attempts >= 0 ? ` · 發送嘗試 ${row.attempts} 次` : "") +
          (typeof row.upstreamCode === "string" && row.upstreamCode ? ` · LINE 回應：${lineDisplayMessage(row.upstreamCode)}` : "");
        item.appendChild(label);
        if (row.retryable === true && typeof row.chatId === "string" && !["cancelled", "cancelling"].includes(entry.value?.status)) {
          const retry = document.createElement("button");
          retry.type = "button"; retry.className = "loe-mini"; retry.textContent = "重送";
          retry.setAttribute("aria-label", `重送給 ${row.lineName || "此客戶"}`);
          retry.addEventListener("click", async () => {
            retry.disabled = true;
            await action("retry-failed", [row.chatId]);
            if (active()) void loadResults(resultPage);
          });
          item.appendChild(retry);
        }
        find("results-list").appendChild(item);
      }
      find("results-status").textContent = p.totalItems ? `共 ${p.totalItems.toLocaleString()} 則` : "沒有這類結果";
      find("results-pages").textContent = `第 ${resultPages ? page : 0} / ${resultPages} 頁`;
    } catch (error) {
      if (active() && resultController === controller && error.name !== "AbortError") {
        resultPages = 0; find("results-status").textContent = error.message; find("results-pages").textContent = "";
      }
    } finally {
      if (resultController === controller) {
        resultController = null;
        if (active()) {
          find("results-prev").disabled = resultPage <= 1 || !resultPages;
          find("results-next").disabled = resultPage >= resultPages;
        }
      }
    }
  }
  find("retry").addEventListener("click", () => void submit());
  find("refresh").addEventListener("click", () => void refresh());
  find("cancel").addEventListener("click", () => void action("cancel"));
  find("resume").addEventListener("click", () => void action("resume"));
  find("pause").addEventListener("click", () => void action("pause"));
  find("retry-failed").addEventListener("click", () => {
    const count = entry.value?.retryableCount || 0;
    if (count && confirm(`重送 ${count.toLocaleString()} 位確定沒送出的客戶？已送出、結果不明、LINE 拒收的不會重送。`)) void action("retry-failed");
  });
  find("save-cookie").addEventListener("click", async () => {
    if (!active() || entry.busy) return;
    entry.busy = true; entry.notice = ""; notify();
    try {
      if ((await saveLineCookie()).cancelled) return;
      entry.notice = entry.value?.rejected && !entry.value.retrySameRequest ? "已授權，可直接按「傳送」。" : "已授權，請按「恢復傳送」；若尚未入隊，請重試同一次傳送。";
    } catch (error) { entry.notice = error.message; }
    finally { entry.busy = false; notify(); }
  });
  function clearPreviousView() {
    if (pollController) { pollController.abort(); pollController = null; }
    if (resultController) { resultController.abort(); resultController = null; }
    clearTimeout(timer); timer = null; clearTimeout(hideTimer);
    entry.notice = ""; autoResultsJobId = "";
    find("results-list").replaceChildren();
    find("details").open = false;
  }
  find("dismiss").addEventListener("click", () => {
    if (locked()) return;
    toastVisible = false; container.hidden = true; clearTimeout(hideTimer);
  });
  find("details").addEventListener("toggle", () => {
    if (!active()) return;
    if (find("details").open && entry.value?.jobId && autoResultsJobId !== entry.value.jobId) void loadResults(1);
    render();
  });
  find("filter").addEventListener("change", () => { resultFilter = find("filter").value; void loadResults(1); });
  find("results-reload").addEventListener("click", () => void loadResults(1));
  find("results-prev").addEventListener("click", () => { if (resultPage > 1) void loadResults(resultPage - 1); });
  find("results-next").addEventListener("click", () => { if (resultPage < resultPages) void loadResults(resultPage + 1); });
  entry.listeners.add(render);
  render();
  if (entry.value?.jobId) void refresh();
  return {
    locked,
    refreshSendGate,
    value: () => entry.value,
    invalidImageId: () => entry.value?.rejected && LINE_INVALID_IMAGE_CODES.has(entry.value.errorCode)
      ? entry.value.payload?.messages.find(message => message.type === "image")?.mediaId : null,
    begin(payload) {
      if (!active() || locked()) return;
      const other = storeGet(key, null);
      // 允許接續已結束的同一筆紀錄；其他分頁若建立新作業，先接回它而不另送。
      if (other && (other.requestId !== entry.value?.requestId || !editable(other))) {
        entry.value = other; toastVisible = true; render(); if (other.jobId) void refresh(); return;
      }
      const requestId = crypto.randomUUID();
      const body = { account, requestId, chatIds: [...payload.chatIds], excludedChatIds: [...payload.excludedChatIds],
        messages: payload.messages.map(message => ({ ...message })), hourlyLimit: payload.hourlyLimit };
      if (new Blob([JSON.stringify(body)]).size > 8000000) { toast("傳送內容超過可接收的大小"); return; }
      const value = { account, groupId, requestId, payload: body, uncertain: false };
      const accessError = sendAccess.error(value);
      if (accessError) { toast(accessError); return; }
      try { persist(value); } catch (error) { toast(error.message); return; }
      clearPreviousView();
      entry.value = value; toastVisible = true;
      void submit();
      return requestId;
    },
    close() {
      closed = true; clearTimeout(timer); clearTimeout(hideTimer);
      if (pollController) pollController.abort();
      if (resultController) resultController.abort();
      entry.listeners.delete(render);
      // 已提交的 POST 繼續等待結果並保存；關閉視窗不代表取消作業。
    },
  };
}
function closeLineCustomers() {
  if (lineCustomerDialog) lineCustomerDialog.close();
}
function openLineCustomers() {
  closeLineCustomers();
  const groupId = getOaId();
  const account = getDispatcher();
  if (!/^U[0-9a-f]{32}$/i.test(groupId)) throw new Error("請先選擇 LINE 官方帳號");
  const opener = document.activeElement;
  const state = { groupId, rows: [], selected: new Map(), files: [], page: 1, search: "",
    total: 0, pages: 0, loading: false, seq: 0, closed: false, pageController: null,
    allController: null, searchTimer: null, updatedAt: null, pendingRequestId: null,
    coupons: [], coupon: null, couponController: null, couponTimer: null, couponsLoaded: false,
    cards: [], card: null, cardController: null, cardsLoaded: false, messageType: "text", pendingType: null,
    handledSelectionError: null, excluded: new Map(), restoredFilterRequestId: null, syncing: false,
    skipGroups: storeGet(SKIP_GROUP_CHATS_KEY, true) !== false,
    hourlyLimit: Number(storeGet(`${LINE_HOURLY_LIMIT_KEY}::${groupId}`, LINE_HOURLY_LIMIT_DEFAULT)) };
  let jobView = null;
  const dialog = document.createElement("dialog");
  dialog.className = "loe-customers-dialog";
  dialog.setAttribute("aria-labelledby", "loe-customers-title");
  dialog.innerHTML = `
      <div class="loe-modal-head"><span id="loe-customers-title">群發訊息 - 懶惰蟲</span><button type="button" class="loe-modal-close" aria-label="關閉群發訊息">×</button></div>
      <div class="loe-customers-layout">
        <section class="loe-customers-panel">
          <div class="loe-customers-account-head"><div class="loe-customers-section-title" data-role="account-name"></div><button class="loe-mini loe-customers-sync" type="button" data-role="reload">${ic("refresh")}<span data-role="sync-label">同步客戶與記事本</span></button></div>
          <form class="loe-customers-search"><input class="loe-input" type="search" aria-label="搜尋客戶名稱" placeholder="搜尋 LINE 名稱"><button class="loe-mini" type="submit">搜尋</button></form>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="all">全選所有人</button>
            <button class="loe-mini" type="button" data-role="clear">清除已選</button>
          </div>
          <div class="loe-customers-muted">全選所有人會選取此官方帳號的全部客戶，包含所有分頁，不受搜尋條件影響。</div>
          <div class="loe-customers-muted">勾選＝要傳送。全選後有人不想傳，點那位右側的「不發送」，之後再按全選也不會傳給他。</div>
          <div class="loe-customers-status" role="status" aria-live="polite"></div>
          <div class="loe-customers-list" aria-label="客戶列表"></div>
          <div class="loe-customers-toolbar"><button class="loe-mini" type="button" data-role="prev">上一頁</button><span data-role="pages" class="loe-customers-muted"></span><button class="loe-mini" type="button" data-role="next">下一頁</button></div>
          <div class="loe-customers-muted" data-role="updated"></div>
        </section>
        <section class="loe-customers-panel loe-customers-compose">
          <div class="loe-customers-section-title">編輯訊息</div>
          <div class="loe-customers-selection" data-role="selected" aria-live="polite">已選 0 位客戶</div>
          <div class="loe-customers-muted">翻頁或搜尋會保留已勾選的客戶。</div>
          <div class="loe-message-types" role="radiogroup" aria-label="發送類型">
            ${[["text", "文字"], ["image", "圖片"], ["coupon", "優惠券"], ["cardType", "多頁訊息"]].map(([value, label]) =>
            `<label><input type="radio" name="loe-message-type" value="${value}" ${value === "text" ? "checked" : ""}><span>${label}</span></label>`).join("")}
          </div>
          <div data-message-panel="text">
          <label for="loe-customers-text">文字訊息</label>
          <textarea id="loe-customers-text" class="loe-textarea" maxlength="5000" placeholder="輸入要傳送的文字"></textarea>
          <div class="loe-customers-muted" data-role="text-count">0 / 5000 字</div>
          </div>
          <div data-message-panel="image" hidden>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="image-pick" aria-describedby="loe-customers-file-name">選擇圖片</button>
            <span id="loe-customers-file-name" class="loe-customers-muted" data-role="image-name">尚未選擇圖片</span>
            <input id="loe-customers-files" type="file" accept="image/jpeg,image/png" aria-label="選擇圖片" hidden>
          </div>
          <div class="loe-customers-muted">每次最多一張 JPG／PNG 圖片，重新選圖會替換原圖。</div>
          <div class="loe-customers-images" data-role="images"></div>
          <div class="loe-customers-notice" data-role="image-status" role="status" aria-live="polite" hidden></div>
          <button class="loe-mini" type="button" data-role="image-retry" hidden>重新上傳圖片</button>
          <div class="loe-customers-muted">選圖後會先上傳，按「傳送」即發送給已勾選的客戶。</div>
          </div>
          <div data-message-panel="coupon" hidden>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="coupon-load">重新讀取優惠券</button>
            <button class="loe-mini" type="button" data-role="coupon-remove" hidden>移除優惠券</button>
          </div>
          <div class="loe-customers-muted" data-role="coupon-status" role="status" aria-live="polite">切換至優惠券時會自動讀取清單。</div>
          <div class="loe-customers-selection" data-role="coupon-selected" aria-live="polite"></div>
          <div class="loe-coupon-list" data-role="coupons" role="radiogroup" aria-label="選擇一張優惠券" hidden></div>
          </div>
          <div data-message-panel="cardType" hidden>
          <div class="loe-customers-toolbar">
            <button class="loe-mini" type="button" data-role="card-load">重新讀取多頁訊息</button>
            <button class="loe-mini" type="button" data-role="card-remove" hidden>移除多頁訊息</button>
          </div>
          <div class="loe-customers-muted" data-role="card-status" role="status" aria-live="polite">切換至多頁訊息時會自動讀取清單。</div>
          <div class="loe-customers-selection" data-role="card-selected" aria-live="polite"></div>
          <div class="loe-coupon-list" data-role="cards" role="radiogroup" aria-label="選擇一組多頁訊息" hidden></div>
          <div class="loe-card-preview" data-role="card-preview" role="region" aria-label="多頁訊息內容預覽" tabindex="0" hidden></div>
          <div class="loe-customers-muted" data-role="card-preview-note" hidden>可左右捲動查看圖片與文字摘要，實際版面以 LINE 顯示為準。</div>
          </div>
          <label class="loe-customers-muted"><input type="checkbox" data-role="skip-groups"> 群組聊天不發送</label>
          <div class="loe-send-requirements" role="group" aria-label="發送設定">
            <div class="loe-send-requirement">
              <div class="loe-send-requirement-head"><strong>1. 不發送名單 <small>（選填）</small></strong><span class="loe-send-badge" data-role="filter-badge">沒有（選填）</span></div>
              <div class="loe-customers-muted">在左側客戶清單點「不發送」加入；點下方姓名旁的 × 或左側「恢復發送」移除。沒有也能傳送。</div>
              <div class="loe-excluded-list" data-role="excluded-list" aria-label="不發送的客戶"></div>
              <button class="loe-mini" type="button" data-role="filter-clear" hidden>清空不發送名單</button>
            </div>
            <div class="loe-send-requirement">
              <div class="loe-send-requirement-head"><strong>2. 發送 KEY</strong><span class="loe-send-badge" data-role="key-badge">尚未授權</span></div>
              <div class="loe-customers-muted">在「身份授權」輸入後台發放的 KEY（有效期一個月），傳送時自動帶入。</div>
              <button class="loe-mini" type="button" data-role="authorize">身份授權</button>
            </div>
            <div class="loe-send-requirement">
              <div class="loe-send-requirement-head"><strong>3. 分批傳送</strong><span class="loe-send-badge" data-role="rate-badge"></span></div>
              <label class="loe-customers-muted">每小時最多傳給<input class="loe-input loe-rate-input" type="number" data-role="hourly-limit" min="1" max="${LINE_HOURLY_LIMIT_MAX}" step="1" inputmode="numeric" aria-label="每小時最多傳給幾位客戶">位客戶（最高 ${LINE_HOURLY_LIMIT_MAX}）</label>
              <div class="loe-customers-muted">LINE 規定官方帳號 1 小時內傳給超過 200 位不同客戶，會暫時鎖住一對一聊天，客服也沒辦法回覆。送滿上限後會自動等下一小時接著送，不用開著視窗。同一個官方帳號一次只跑一批，後送的那批會排隊。</div>
              <div class="loe-send-ready" data-role="rate-plan" aria-live="polite"></div>
            </div>
          </div>
          <div class="loe-send-ready" data-role="send-ready" role="status" aria-live="polite"></div>
          <button class="loe-btn-primary" type="button" data-role="send">傳送</button>
        </section>
      </div>
      <div data-role="job" hidden></div>`;
  const find = (role) => dialog.querySelector(`[data-role="${role}"]`);
  const searchInput = dialog.querySelector('input[type="search"]');
  const textInput = dialog.querySelector("#loe-customers-text");
  const fileInput = dialog.querySelector('input[type="file"]');
  const status = dialog.querySelector(".loe-customers-status");
  const list = dialog.querySelector(".loe-customers-list");
  find("account-name").textContent = getOaName() || "目前官方帳號";
  // 同步客戶只需在同一官方帳號；其餘操作（勾選、傳送）另需同一後台帳號
  const onOa = () => !state.closed && getOaId() === groupId;
  const current = () => onOa() && getDispatcher() === account;
  // LINE chatId：U＝個人、C＝群組聊天、R＝多人聊天室；「群組不發送」開啟時剔除 C 開頭
  const isGroupChat = id => id.startsWith("C");
  const effectiveChatIds = () => [...state.selected.keys()]
    .filter(id => !state.excluded.has(id) && !(state.skipGroups && isGroupChat(id)));
  const sendKey = () => storedSendKey(account);
  const hourlyLimitValid = () => Number.isInteger(state.hourlyLimit) && state.hourlyLimit >= 1 && state.hourlyLimit <= LINE_HOURLY_LIMIT_MAX;
  const sendGateError = (job) => {
    const ids = job ? (job.payload?.excludedChatIds || job.excludedChatIds) : [...state.excluded.keys()];
    if (job?.jobId) {
      if (!Number.isInteger(job.excludedCount) || job.excludedCount < 0 || job.excludedCount > LINE_RECIPIENT_LIMIT)
        return "請先重新整理進度，確認後台已保存不發送名單。";
    } else if (!Array.isArray(ids))
      return "這筆作業缺少原始不發送名單紀錄，請先向後台確認原作業結果，再重新建立作業。";
    if (!job?.jobId && (ids.length > LINE_RECIPIENT_LIMIT || ids.some(id => !/^U[0-9a-f]{32}$/.test(id)))) return "不發送名單格式不符，請重新設定。";
    if (!sendKey()) return "請先點「身份授權」輸入後台發放的發送 KEY。";
    if (!job && !hourlyLimitValid()) return `每小時上限請輸入 1～${LINE_HOURLY_LIMIT_MAX} 位。`;
    return "";
  };
  const renderExcluded = () => {
    const container = find("excluded-list");
    container.replaceChildren();
    // 大量過濾對象仍保持畫面可操作；完整名單都參與過濾。
    for (const [index, [id, customer]] of [...state.excluded].slice(0, 100).entries()) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "loe-mini";
      const name = customer.lineName || `未命名客戶 ${index + 1}`;
      button.textContent = `${name} ×`;
      button.setAttribute("aria-label", `恢復發送給 ${name}`);
      button.addEventListener("click", () => {
        if (!current() || jobView?.locked() || state.allController || state.syncing) return;
        state.excluded.delete(id); renderExcluded(); updateControls();
      });
      container.appendChild(button);
    }
    if (state.excluded.size > 100) {
      const more = document.createElement("span"); more.className = "loe-customers-muted";
      more.textContent = `另有 ${(state.excluded.size - 100).toLocaleString()} 位，全部都不會發送。`;
      container.appendChild(more);
    }
  };
  const setStatus = (message, error = false) => {
    status.textContent = lineDisplayMessage(message);
    status.dataset.error = String(error);
  };
  const imageReady = () => !state.files.length || (state.files[0].status === "ready" &&
    state.files[0].asset?.mediaId && Date.parse(state.files[0].asset.expiresAt) > Date.now());
  const updateControls = () => {
    const job = jobView?.value();
    const rejectedType = job?.rejected && !job.uncertain && LINE_SELECTION_ERROR_TYPES[job.errorCode];
    if (rejectedType && state.handledSelectionError !== job.requestId &&
        job.payload?.messages.some(message => message.type === rejectedType)) {
      state.handledSelectionError = job.requestId;
      if (rejectedType === "coupon") {
        state.couponController?.abort(); state.couponController = null;
        state.coupon = null; state.coupons = []; state.couponsLoaded = false; clearTimeout(state.couponTimer);
        find("coupons").replaceChildren(); find("coupons").hidden = true;
        find("coupon-status").textContent = "優惠券未受理，請重新讀取清單並重新選擇。";
      } else {
        state.cardController?.abort(); state.cardController = null;
        state.card = null; state.cards = []; state.cardsLoaded = false; renderCardPreview();
        find("cards").replaceChildren(); find("cards").hidden = true;
        find("card-status").textContent = "多頁訊息未受理，請重新讀取清單並重新選擇。";
      }
    }
    if (state.pendingRequestId && job?.requestId === state.pendingRequestId && job.status === "completed") {
      state.pendingRequestId = null;
      if (state.pendingType === "text") textInput.value = "";
      if (state.pendingType === "image") {
        for (const item of state.files) releaseImage(item);
        state.files = []; renderImages();
      }
      if (state.pendingType === "coupon") { state.coupon = null; clearTimeout(state.couponTimer); }
      if (state.pendingType === "cardType") { state.card = null; renderCardPreview(); }
      state.pendingType = null;
    }
    const allBusy = !!state.allController || state.syncing;
    const locked = jobView?.locked() || false;
    if (locked && job?.requestId && state.restoredFilterRequestId !== job.requestId) {
      const ids = job.payload?.excludedChatIds || job.excludedChatIds;
      state.excluded = new Map((Array.isArray(ids) ? ids : []).map(id => [id, state.excluded.get(id) || { chatId: id }]));
      state.restoredFilterRequestId = job.requestId;
      renderExcluded();
    }
    if (locked && job?.jobId && job.excludedCount === 0 && state.excluded.size) {
      state.excluded.clear(); renderExcluded();
    }
    const item = state.files[0];
    if (item?.asset && jobView?.invalidImageId() === item.asset.mediaId) {
      item.asset = null; item.status = "error";
      item.error = "圖片已失效，請重新選圖或重新上傳。";
      clearTimeout(item.expiryTimer);
    }
    if (!locked && item?.status === "ready" && !imageReady()) {
      item.status = "expired"; item.error = "圖片已過期，請重新選圖或重新上傳。";
    }
    find("selected").textContent = `已選 ${state.selected.size.toLocaleString()} 位客戶`;
    const effective = effectiveChatIds();
    const filteredCount = state.selected.size - effective.length;
    const skippedGroups = state.skipGroups ? [...state.selected.keys()].filter(id => isGroupChat(id) && !state.excluded.has(id)).length : 0;
    const filterCount = locked && job?.jobId && Number.isInteger(job.excludedCount) ? job.excludedCount : state.excluded.size;
    const filterReady = filterCount > 0;
    find("filter-badge").textContent = filterReady ? `${filterCount.toLocaleString()} 位不發送` : "沒有（選填）";
    find("filter-badge").dataset.ready = filterReady ? "true" : "optional";
    const keyReady = !!sendKey();
    find("key-badge").textContent = keyReady ? "已授權" : "尚未授權";
    find("key-badge").dataset.ready = String(keyReady);
    const rateInput = find("hourly-limit");
    const shownLimit = locked && Number.isInteger(job?.hourlyLimit) ? job.hourlyLimit : state.hourlyLimit;
    if (document.activeElement !== rateInput) rateInput.value = Number.isFinite(shownLimit) ? String(shownLimit) : "";
    rateInput.disabled = locked || allBusy;
    const rateReady = locked || hourlyLimitValid();
    find("rate-badge").textContent = rateReady ? `每小時 ${shownLimit} 位` : "請輸入上限";
    find("rate-badge").dataset.ready = String(rateReady);
    if (locked) find("rate-plan").textContent = "目前作業依提交時的每小時上限分批傳送。";
    else if (!hourlyLimitValid()) find("rate-plan").textContent = `請輸入 1～${LINE_HOURLY_LIMIT_MAX} 的整數。`;
    else if (!effective.length) find("rate-plan").textContent = "";
    else {
      const plan = lineBatchPlan(effective.length, state.hourlyLimit);
      find("rate-plan").textContent = plan.batches === 1 ? `${effective.length.toLocaleString()} 位一批送完，約 ${lineDurationText(plan.seconds)}。` :
        `${effective.length.toLocaleString()} 位分 ${plan.batches} 批，約 ${lineDurationText(plan.seconds)}送完（預計 ${lineTimeText(plan.finishAt)}）。`;
    }
    find("filter-clear").hidden = !state.excluded.size;
    find("skip-groups").checked = state.skipGroups;
    find("skip-groups").disabled = locked || allBusy;
    find("filter-clear").disabled = locked || allBusy;
    find("excluded-list").querySelectorAll("button").forEach(button => { button.disabled = locked || allBusy; });
    find("prev").disabled = state.loading || allBusy || state.page <= 1;
    find("next").disabled = state.loading || allBusy || state.page >= state.pages;
    find("pages").textContent = `第 ${state.pages ? state.page : 0} / ${state.pages} 頁 · 符合 ${state.total.toLocaleString()} 人`;
    find("all").disabled = locked || state.syncing || (!allBusy && state.loading);
    find("all").textContent = state.allController ? "取消全選讀取" : "全選所有人";
    find("clear").disabled = locked || state.syncing || (!state.selected.size && !allBusy);
    // 同步客戶不受群發作業鎖定，只防重複同步
    find("reload").disabled = state.syncing;
    find("sync-label").textContent = state.syncing ? "同步中…" : "同步客戶與記事本" + lineLastSyncLabel(getOaId());
    searchInput.disabled = dialog.querySelector('.loe-customers-search button').disabled = state.syncing;
    const hasContent = state.messageType === "text" ? !!textInput.value.trim() :
      state.messageType === "image" ? !!state.files.length && imageReady() :
      state.messageType === "coupon" ? lineCouponAvailable(state.coupon) : !!state.card;
    const gateError = sendGateError();
    find("send").disabled = locked || allBusy || !effective.length || !hasContent || !!gateError;
    find("send-ready").textContent = locked ? "目前這批使用提交時的收件人與不發送名單，傳完或取消後才能送下一批。" :
      `已勾選 ${state.selected.size.toLocaleString()} 位 − 不發送 ${filteredCount.toLocaleString()} 位` +
      (skippedGroups ? `（含群組 ${skippedGroups.toLocaleString()} 個）` : "") + ` = 實際傳送 ${effective.length.toLocaleString()} 位。` +
      (gateError ? ` ${gateError}` : !effective.length ? " 請勾選至少一位要傳送的客戶。" : !hasContent ? " 請完成訊息內容。" : " 可以傳送。KEY 將交由後台驗證。");
    jobView?.refreshSendGate();
    dialog.querySelectorAll('[name="loe-message-type"]').forEach(input => {
      input.checked = input.value === state.messageType; input.disabled = locked;
    });
    dialog.querySelectorAll('[data-message-panel]').forEach(panel => {
      panel.hidden = panel.dataset.messagePanel !== state.messageType;
    });
    find("card-load").disabled = locked || !!state.cardController;
    find("card-remove").hidden = !state.card;
    find("card-remove").disabled = locked;
    find("card-selected").textContent = state.card ? `已選：${state.card.title}（${lineCardPages(state.card).length} 張卡片）` : "";
    find("cards").querySelectorAll('input[type="radio"]').forEach(input => {
      input.checked = String(state.card?.id) === input.value;
      input.disabled = locked;
    });
    find("coupon-load").disabled = locked || !!state.couponController;
    find("coupon-remove").hidden = !state.coupon;
    find("coupon-remove").disabled = locked;
    find("coupon-selected").textContent = state.coupon ? `已選：${state.coupon.title}` +
      (lineCouponAvailable(state.coupon) ? "" : " — 目前不可發送，請移除或重新選擇") : "";
    find("coupons").querySelectorAll('input[type="radio"]').forEach(input => {
      const coupon = state.coupons.find(item => String(item.couponId) === input.value);
      input.checked = state.coupon?.couponId === coupon?.couponId;
      input.disabled = locked || !lineCouponAvailable(coupon);
    });
    textInput.disabled = fileInput.disabled = find("image-pick").disabled = locked;
    find("image-pick").textContent = item ? "更換圖片" : "選擇圖片";
    find("image-name").textContent = item ? item.file.name : "尚未選擇圖片";
    find("images").querySelectorAll("button").forEach(button => { button.disabled = locked; });
    find("image-status").hidden = !item;
    find("image-status").textContent = !item ? "" : item.status === "uploading" ? "圖片上傳中…" :
      item.status === "ready" ? "圖片已上傳，按「傳送」即可發給客戶。" : item.error;
    find("image-status").dataset.error = String(!!item && ["error", "expired"].includes(item.status));
    find("image-retry").hidden = !item || !["error", "expired"].includes(item.status);
    find("image-retry").disabled = locked;
    find("text-count").textContent = `${textInput.value.length} / 5000 字`;
    list.querySelectorAll('input[type="checkbox"]').forEach((box) => {
      box.checked = state.selected.has(box.value);
      box.disabled = locked || allBusy;
      const excluded = state.excluded.has(box.value);
      const row = box.closest(".loe-customer-row"); row.dataset.excluded = String(excluded);
      const button = row.querySelector("button");
      button.textContent = excluded ? "恢復發送" : "不發送";
      button.setAttribute("aria-pressed", String(excluded));
      button.disabled = locked || allBusy;
    });
  };
  const renderRows = () => {
    list.replaceChildren();
    if (!state.rows.length) {
      const empty = document.createElement("div");
      empty.className = "loe-customers-empty";
      empty.textContent = state.loading ? "讀取客戶清單中…" :
        (state.search ? "沒有符合的客戶" : "尚無客戶清單，請點上方「同步客戶與記事本」");
      list.appendChild(empty);
    }
    for (const customer of state.rows) {
      const row = document.createElement("div");
      row.className = "loe-customer-row";
      const select = document.createElement("label"); select.className = "loe-customer-select";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.value = customer.chatId;
      check.setAttribute("aria-label", `選擇 ${customer.lineName}`);
      check.addEventListener("change", () => {
        if (!current() || jobView?.locked() || state.allController || state.syncing) { updateControls(); return; }
        if (check.checked) state.selected.set(customer.chatId, customer);
        else state.selected.delete(customer.chatId);
        updateControls();
      });
      const avatar = document.createElement("img");
      avatar.className = "loe-customer-avatar";
      avatar.alt = "";
      avatar.loading = "lazy";
      avatar.referrerPolicy = "no-referrer";
      try {
        const url = new URL(customer.avatarUrl);
        if (url.protocol === "https:") avatar.src = url.href;
      } catch (_) {}
      avatar.addEventListener("error", () => avatar.removeAttribute("src"), { once: true });
      const info = document.createElement("span");
      info.className = "loe-customer-info";
      const name = document.createElement("div");
      name.className = "loe-customer-name";
      name.textContent = customer.lineName;
      info.appendChild(name);
      select.append(check, avatar, info);
      const filter = document.createElement("button"); filter.type = "button"; filter.className = "loe-mini";
      filter.setAttribute("aria-label", `不發送給 ${customer.lineName}`);
      filter.addEventListener("click", () => {
        if (!current() || jobView?.locked() || state.allController || state.syncing) return;
        if (state.excluded.has(customer.chatId)) state.excluded.delete(customer.chatId);
        else if (state.excluded.size >= LINE_RECIPIENT_LIMIT) { toast("不發送名單最多 50,000 位"); return; }
        else state.excluded.set(customer.chatId, customer);
        renderExcluded(); updateControls();
      });
      row.append(select, filter);
      list.appendChild(row);
    }
    updateControls();
  };
  const stopAll = () => {
    if (state.allController) state.allController.abort();
    state.allController = null;
  };
  async function loadPage(page = 1) {
    stopAll();
    if (state.pageController) state.pageController.abort();
    const controller = state.pageController = new AbortController();
    const seq = ++state.seq;
    state.loading = true;
    state.rows = [];
    renderRows();
    setStatus("正在讀取後端客戶清單…");
    try {
      const data = await fetchSavedLineCustomers(groupId, page, LINE_CUSTOMER_PAGE_SIZE, state.search, controller.signal);
      if (!current() || seq !== state.seq) return;
      state.rows = data.customers;
      state.page = data.pagination.currentPage;
      state.pages = data.pagination.totalPages;
      state.total = data.pagination.totalItems;
      state.updatedAt = data.updatedAt || null;
      find("updated").textContent = data.updatedAt ? `清單更新時間：${new Date(data.updatedAt).toLocaleString()}` : "尚未同步過客戶清單";
      setStatus(`本頁 ${state.rows.length} 位客戶`);
      return true;
    } catch (error) {
      if (!current() || seq !== state.seq || error.name === "AbortError") return;
      state.total = state.pages = 0;
      setStatus(error.message, true);
      return false;
    } finally {
      if (current() && seq === state.seq) {
        state.loading = false;
        renderRows();
      }
    }
  }
  async function selectAll() {
    if (!current() || jobView?.locked() || state.syncing) return;
    if (state.allController) { stopAll(); updateControls(); setStatus("已取消，保留原本勾選"); return; }
    const controller = state.allController = new AbortController();
    const collected = new Map();
    let total, pages, updatedAt;
    updateControls();
    try {
      for (let page = 1; ; page++) {
        const data = await fetchSavedLineCustomers(groupId, page, 500, "", controller.signal);
        if (!current() || state.allController !== controller) return;
        if (page === 1) {
          total = data.pagination.totalItems;
          pages = data.pagination.totalPages;
          updatedAt = data.updatedAt || null;
          if (total > LINE_RECIPIENT_LIMIT) throw new Error("一次最多選 50,000 位客戶，請改為手動勾選收件人");
        } else if (total !== data.pagination.totalItems || pages !== data.pagination.totalPages || updatedAt !== (data.updatedAt || null)) {
          throw new Error("讀取期間客戶名單已更新，請重新全選");
        }
        for (const row of data.customers) collected.set(row.chatId, row);
        setStatus(`正在全選：已讀 ${collected.size.toLocaleString()} / ${total.toLocaleString()} 人`);
        if (page >= pages) break;
        if (!data.customers.length) throw new Error("分頁資料不完整，未套用全選");
      }
      if (collected.size !== total) throw new Error("客戶總數不符，未套用全選，請重新讀取");
      state.selected = collected;
      setStatus(`已全選所有 ${total.toLocaleString()} 位客戶`);
    } catch (error) {
      if (current() && state.allController === controller && error.name !== "AbortError")
        setStatus(error.message, true);
    } finally {
      if (state.allController === controller) { state.allController = null; updateControls(); }
    }
  }
  const runSearch = () => {
    if (!current() || state.syncing) return;
    clearTimeout(state.searchTimer);
    state.search = searchInput.value.trim();
    void loadPage(1);
  };
  dialog.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); runSearch(); });
  searchInput.addEventListener("input", () => {
    if (!current() || state.syncing) return;
    clearTimeout(state.searchTimer);
    stopAll();
    if (state.pageController) state.pageController.abort();
    ++state.seq;
    state.loading = true;
    state.rows = [];
    renderRows();
    state.searchTimer = setTimeout(runSearch, 300);
  });
  find("prev").addEventListener("click", () => void loadPage(state.page - 1));
  find("next").addEventListener("click", () => void loadPage(state.page + 1));
  find("reload").addEventListener("click", async () => {
    // 作業進行中也可同步：只刷新左側可選清單，作業的收件人固定在提交時的快照、不受影響
    if (!onOa() || state.syncing) return;
    state.syncing = true; clearTimeout(state.searchTimer); stopAll();
    setStatus("正在同步 LINE 客戶清單與記事本…"); updateControls();
    try {
      const result = await syncLineData();
      if (!onOa()) return;
      state.search = searchInput.value.trim();
      const refreshed = await loadPage(1);
      if (onOa() && refreshed) setStatus(lineSyncResultText(result));
    } catch (error) {
      if (onOa()) setStatus(error.message || "同步失敗，請稍後重試", true);
    } finally {
      state.syncing = false;
      if (onOa()) updateControls();
    }
  });
  find("all").addEventListener("click", () => void selectAll());
  find("clear").addEventListener("click", () => {
    if (!current() || jobView?.locked()) return;
    stopAll(); state.selected.clear(); updateControls();
  });
  find("hourly-limit").addEventListener("input", (event) => {
    if (!current() || jobView?.locked()) return;
    const value = event.target.value.trim();
    state.hourlyLimit = /^\d+$/.test(value) ? Number(value) : NaN;
    if (hourlyLimitValid()) storeSet(`${LINE_HOURLY_LIMIT_KEY}::${groupId}`, state.hourlyLimit);
    updateControls();
  });
  find("hourly-limit").addEventListener("blur", updateControls);
  find("skip-groups").addEventListener("change", (event) => {
    state.skipGroups = event.target.checked;
    storeSet(SKIP_GROUP_CHATS_KEY, state.skipGroups);
    updateControls();
  });
  find("filter-clear").addEventListener("click", () => {
    if (!current() || jobView?.locked() || state.allController || state.syncing) return;
    state.excluded.clear(); renderExcluded(); updateControls();
  });
  find("authorize").addEventListener("click", async () => {
    if (!current()) return;
    find("authorize").disabled = true;
    try {
      const result = await saveLineCookie();
      if (!result.cancelled) toast(`已授權至 ${result.account}`);
    } catch (error) { toast(error.message || "身份授權失敗", "error", 6000); }
    finally { find("authorize").disabled = false; updateControls(); }
  });
  textInput.addEventListener("input", updateControls);
  function releaseImage(item) {
    clearTimeout(item.expiryTimer);
    item.controller?.abort(); item.controller = null;
    URL.revokeObjectURL(item.url);
  }
  async function uploadImage(item) {
    if (!current() || jobView?.locked() || state.files[0] !== item) return;
    item.controller?.abort(); clearTimeout(item.expiryTimer);
    const controller = item.controller = new AbortController();
    item.status = "uploading"; item.asset = null; item.error = "";
    updateControls();
    try {
      const form = new FormData();
      form.append("file", item.file);
      const data = await lineBackendRequest("POST",
        `/line-oa/${encodeURIComponent(groupId)}/message-assets?account=${encodeURIComponent(account)}`,
        form, controller.signal);
      if (!current() || state.files[0] !== item || item.controller !== controller) return;
      const expiry = Date.parse(data?.expiresAt);
      if (!data || typeof data.mediaId !== "string" || !data.mediaId.trim() ||
          !["image/png", "image/jpeg"].includes(data.contentType) ||
          !Number.isInteger(data.byteSize) || data.byteSize <= 0 || !Number.isFinite(expiry))
        throw new Error("圖片上傳回應格式不符，請重新上傳");
      if (expiry <= Date.now()) throw new Error("圖片已過期，請重新上傳");
      item.asset = data; item.status = "ready";
      item.expiryTimer = setTimeout(() => {
        if (current() && state.files[0] === item) updateControls();
      }, Math.min(expiry - Date.now() + 1, 2147483647));
    } catch (error) {
      if (!current() || state.files[0] !== item || item.controller !== controller || error.name === "AbortError") return;
      item.status = "error"; item.error = error.message;
    } finally {
      if (item.controller === controller) {
        item.controller = null;
        if (current() && state.files[0] === item) updateControls();
      }
    }
  }
  find("image-retry").addEventListener("click", () => {
    if (state.files[0]) void uploadImage(state.files[0]);
  });
  dialog.querySelectorAll('[name="loe-message-type"]').forEach(input => {
    input.addEventListener("change", () => {
      if (!current() || jobView?.locked()) { updateControls(); return; }
      state.messageType = input.value; updateControls();
      // 同視窗已載入的清單保留選擇；失敗後切回可重試，讀取中不重複請求。
      if (state.messageType === "coupon" && !state.couponsLoaded) void loadCoupons();
      if (state.messageType === "cardType" && !state.cardsLoaded) void loadCards();
    });
  });
  find("coupon-load").addEventListener("click", () => { void loadCoupons(); });
  async function loadCoupons() {
    if (!current() || jobView?.locked() || state.couponController) return;
    const controller = state.couponController = new AbortController();
    state.coupon = null; state.coupons = []; state.couponsLoaded = false;
    clearTimeout(state.couponTimer);
    find("coupons").replaceChildren(); find("coupons").hidden = true;
    find("coupon-status").textContent = "正在讀取此官方帳號的全部優惠券…";
    updateControls();
    try {
      const coupons = await fetchLineCoupons(groupId, controller);
      if (!current() || state.couponController !== controller) return;
      state.coupons = coupons;
      for (const coupon of coupons) {
        const card = document.createElement("label"); card.className = "loe-coupon-card";
        const input = document.createElement("input");
        input.type = "radio"; input.name = "loe-coupon"; input.value = String(coupon.couponId);
        input.setAttribute("aria-label", coupon.title);
        input.addEventListener("change", () => {
          if (!current() || jobView?.locked() || !lineCouponAvailable(coupon)) { updateControls(); return; }
          state.coupon = coupon;
          clearTimeout(state.couponTimer);
          // 計時器分段處理遠期到期時間，按傳送時仍再檢查一次。
          const checkExpiry = () => {
            if (!current() || state.coupon !== coupon) return;
            updateControls();
            if (lineCouponAvailable(coupon)) state.couponTimer = setTimeout(checkExpiry,
              Math.min(coupon.endTime - Date.now() + 1, 2147483647));
          };
          checkExpiry();
        });
        const image = document.createElement("img");
        image.alt = coupon.title; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
        try {
          const url = new URL(coupon.imageUrl);
          if (url.protocol === "https:") image.src = url.href;
        } catch (_) {}
        const missing = document.createElement("span"); missing.className = "loe-customers-muted";
        missing.textContent = "無法顯示預覽圖片"; missing.hidden = !!image.getAttribute("src");
        image.hidden = !image.getAttribute("src");
        image.addEventListener("error", () => { image.hidden = true; missing.hidden = false; }, { once: true });
        const title = document.createElement("strong"); title.textContent = coupon.title;
        const detail = document.createElement("span"); detail.className = "loe-customers-muted";
        detail.textContent = `${lineCouponAvailable(coupon) ? "有效" : "目前不可發送"}\n` +
          `${new Date(coupon.startTime).toLocaleString()} ～ ${new Date(coupon.endTime).toLocaleString()}`;
        card.append(image, missing, input, title, detail); find("coupons").appendChild(card);
      }
      find("coupons").hidden = !coupons.length;
      find("coupon-status").textContent = coupons.length ? `共 ${coupons.length} 張，請選一張優惠券。` : "此官方帳號目前沒有優惠券。";
      state.couponsLoaded = true;
    } catch (error) {
      if (current() && state.couponController === controller)
        find("coupon-status").textContent = `優惠券讀取失敗：${error.name === "AbortError" ? "讀取逾時，請重新讀取" : error.message}`;
    } finally {
      if (state.couponController === controller) state.couponController = null;
      if (current()) updateControls();
    }
  }
  find("coupon-remove").addEventListener("click", () => {
    if (!current() || jobView?.locked()) return;
    state.coupon = null; clearTimeout(state.couponTimer); updateControls();
  });
  function appendCardImage(container, summary, title) {
    if (!summary.image) return;
    const image = document.createElement("img");
    image.src = summary.image; image.alt = title; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => { image.hidden = true; }, { once: true });
    container.appendChild(image);
  }
  function renderCardPreview() {
    const preview = find("card-preview"); preview.replaceChildren();
    preview.hidden = find("card-preview-note").hidden = !state.card;
    if (!state.card) return;
    lineCardPages(state.card).forEach((page, index) => {
      const summary = lineCardPageSummary(page);
      const card = document.createElement("div"); card.className = "loe-card-page";
      const title = document.createElement("strong"); title.textContent = `第 ${index + 1} 張`;
      card.appendChild(title); appendCardImage(card, summary, `${state.card.title} 第 ${index + 1} 張`);
      const text = document.createElement("p"); text.textContent = summary.text || "（此卡片沒有文字摘要）";
      card.appendChild(text); preview.appendChild(card);
    });
    preview.scrollLeft = 0;
  }
  find("card-load").addEventListener("click", () => { void loadCards(); });
  async function loadCards() {
    if (!current() || jobView?.locked() || state.cardController) return;
    const controller = state.cardController = new AbortController();
    state.card = null; state.cards = []; state.cardsLoaded = false; renderCardPreview();
    find("cards").replaceChildren(); find("cards").hidden = true;
    find("card-status").textContent = "正在讀取此官方帳號的全部多頁訊息…";
    updateControls();
    try {
      const cards = await fetchLineCardMessages(groupId, controller);
      if (!current() || state.cardController !== controller) return;
      state.cards = cards;
      for (const card of cards) {
        const label = document.createElement("label"); label.className = "loe-coupon-card loe-card-choice";
        const input = document.createElement("input");
        input.type = "radio"; input.name = "loe-card-type"; input.value = String(card.id);
        input.setAttribute("aria-label", card.title);
        input.addEventListener("change", () => {
          if (!current() || jobView?.locked()) { updateControls(); return; }
          state.card = card; renderCardPreview(); updateControls();
        });
        const pages = lineCardPages(card);
        appendCardImage(label, lineCardPageSummary(pages[0]), card.title);
        const title = document.createElement("strong"); title.textContent = card.title;
        const detail = document.createElement("span"); detail.className = "loe-customers-muted";
        detail.textContent = `${pages.length} 張卡片`;
        label.append(input, title, detail); find("cards").appendChild(label);
      }
      find("cards").hidden = !cards.length;
      find("card-status").textContent = cards.length ? `共 ${cards.length} 組，請選一組多頁訊息。` : "此官方帳號目前沒有多頁訊息。";
      state.cardsLoaded = true;
    } catch (error) {
      if (current() && state.cardController === controller)
        find("card-status").textContent = `多頁訊息讀取失敗：${error.name === "AbortError" ? "讀取逾時，請重新讀取" : error.message}`;
    } finally {
      if (state.cardController === controller) state.cardController = null;
      if (current()) updateControls();
    }
  }
  find("card-remove").addEventListener("click", () => {
    if (!current() || jobView?.locked()) return;
    state.card = null; renderCardPreview(); updateControls();
  });
  function renderImages() {
    find("images").replaceChildren();
    state.files.forEach((item) => {
      const card = document.createElement("div");
      card.className = "loe-customers-image";
      const image = document.createElement("img");
      image.src = item.url;
      image.alt = item.file.name;
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "loe-mini"; remove.textContent = "移除";
      remove.setAttribute("aria-label", `移除 ${item.file.name}`);
      remove.addEventListener("click", () => {
        if (jobView?.locked()) return;
        releaseImage(item);
        state.files = state.files.filter((entry) => entry !== item);
        renderImages(); updateControls();
      });
      card.append(image, remove);
      find("images").appendChild(card);
    });
  }
  find("image-pick").addEventListener("click", () => {
    if (current() && !jobView?.locked()) fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    // 允許再次選取同一檔案；畫面上的檔名與按鈕由 state.files 維護。
    fileInput.value = "";
    if (!current() || jobView?.locked()) return;
    if (!files.length) return;
    if (!account) { toast("請先在轉發設定填寫後台帳號"); return; }
    if (files.length > 1) { toast("每次最多選擇一張圖片"); return; }
    const file = files[0];
    if (!file.size) { toast("請選擇非空白的 JPG／PNG 圖片"); return; }
    // 格式由後端讀取實際內容判定，不以瀏覽器 MIME 或副檔名拒絕有效圖片。
    const replacement = { file, url: URL.createObjectURL(file), status: "uploading", asset: null, controller: null };
    for (const item of state.files) releaseImage(item);
    state.files = [replacement];
    renderImages(); updateControls();
    void uploadImage(replacement);
  });
  find("send").addEventListener("click", (event) => {
    if (!current()) { closeLineCustomers(); return; }
    if (event.detail > 1 || jobView?.locked() || state.allController || state.syncing) return;
    const gateError = sendGateError();
    if (gateError) { updateControls(); toast(gateError); return; }
    if (state.messageType === "image" && (!state.files.length || !imageReady())) { updateControls(); toast("請先完成圖片上傳"); return; }
    if (state.messageType === "coupon" && !lineCouponAvailable(state.coupon)) { updateControls(); toast("請選擇有效的優惠券"); return; }
    if (state.messageType === "cardType" && !state.card) { toast("請選擇多頁訊息"); return; }
    if (!account) { toast("請先在轉發設定填寫後台帳號"); return; }
    const text = textInput.value.trim();
    const chatIds = effectiveChatIds();
    if (!chatIds.length) { toast("請勾選至少一位要傳送的客戶"); return; }
    if (state.messageType === "text" && !text) { toast("請填寫訊息"); return; }
    if (state.selected.size > LINE_RECIPIENT_LIMIT) { toast("一次最多選取 50,000 位客戶"); return; }
    if (state.files.length > 1) { toast("每次最多一張圖片"); return; }
    if (state.messageType === "text" && text.length > 5000) { toast("文字最多 5,000 字"); return; }
    const plan = lineBatchPlan(chatIds.length, state.hourlyLimit);
    if (plan.batches > 1 && !confirm(`共 ${chatIds.length.toLocaleString()} 位，每小時最多 ${state.hourlyLimit} 位，` +
        `會分 ${plan.batches} 批、約 ${lineDurationText(plan.seconds)}送完（預計 ${lineTimeText(plan.finishAt)}）。\n\n` +
        "這段期間此官方帳號只跑這一批，之後送的會排隊。隨時可以「暫停傳送」或「取消整批」。確定傳送？")) return;
    const payload = { chatIds, hourlyLimit: state.hourlyLimit, excludedChatIds: [...state.excluded.keys()], messages: [
      ...(state.messageType === "text" ? [{ type: "text", text }] : []),
      ...(state.messageType === "image" ? [{ type: "image", mediaId: state.files[0].asset.mediaId }] : []),
      ...(state.messageType === "coupon" ? [{ type: "coupon", couponId: state.coupon.couponId }] : []),
      ...(state.messageType === "cardType" ? [{ type: "cardType", cardTypeMessageId: state.card.id }] : []),
    ] };
    const requestId = jobView.begin(payload);
    if (requestId) { state.pendingRequestId = requestId; state.pendingType = state.messageType; }
  });
  const close = () => {
    if (state.closed) return;
    state.closed = true;
    clearTimeout(state.searchTimer);
    clearTimeout(state.couponTimer);
    state.couponController?.abort();
    state.cardController?.abort();
    if (state.pageController) state.pageController.abort();
    stopAll();
    jobView?.close();
    for (const item of state.files) releaseImage(item);
    dialog.close(); dialog.remove();
    if (lineCustomerDialog?.dialog === dialog) lineCustomerDialog = null;
    if (opener?.isConnected) opener.focus();
  };
  dialog.querySelector(".loe-modal-close").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("click", (event) => event.stopPropagation());
  lineCustomerDialog = { groupId, account, dialog, close };
  document.body.appendChild(dialog);
  dialog.showModal(); searchInput.focus();
  jobView = createLineMessageJobView(find("job"), groupId, account, current, updateControls,
    { key: sendKey, error: sendGateError });
  updateControls(); void loadPage();
  return true;
}

export { closeLineCustomers, lineCustomerDialog, openLineCustomers };
