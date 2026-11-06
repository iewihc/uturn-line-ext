// LINE API 限流（2026-10-26 實測兩次）：每分鐘恰好 1,000 個請求，第 1,001 個起回 429，下一分鐘恢復。
// run.limiter 有設時：每個請求先排隊取額度（全域限速），碰到 429 就整體暫停到下一分鐘再重送同一請求，
// 429 永遠不算失敗。客服同時操作 LINE 介面也吃同一份額度，所以額度要留餘裕。
const LINE_RATE_PER_MINUTE = 900;
const sleepUntil = (at, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, Math.max(0, at - Date.now()));
  signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});
function makeLineRateLimiter(perMinute = LINE_RATE_PER_MINUTE) {
  const interval = 60000 / perMinute;
  let nextSlot = 0, pausedUntil = 0;
  return {
    get pausedUntil() { return pausedUntil; },
    // priority：使用者操作（點開對話）不排在輪詢／看板後面，只尊重 429 的暫停
    async acquire(signal, priority = false) {
      if (priority) { await sleepUntil(Math.max(Date.now(), pausedUntil), signal); return; }
      for (;;) {
        const at = Math.max(Date.now(), nextSlot, pausedUntil);
        nextSlot = at + interval;
        await sleepUntil(at, signal);
        if (signal?.aborted || Date.now() >= pausedUntil) return; // 等待中又被延後就再排一次
      }
    },
    // 暫停到下一個整分再多 2 秒（LINE 的分鐘窗口以伺服器時鐘為準，留一點誤差）
    pauseUntilNextMinute() {
      const now = Date.now();
      pausedUntil = Math.max(pausedUntil, now - (now % 60000) + 62000);
    },
  };
}
async function fetchLineJson(url, run) {
  for (;;) {
    if (run.limiter) await run.limiter.acquire(run.controller.signal);
    const timer = setTimeout(() => {
      run.timedOut = true;
      run.controller.abort();
    }, 15000);
    try {
      const response = await fetch(url.href, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers: {
          Accept: "application/json",
          "x-oa-chat-client-version": "20240513144702",
        },
        signal: run.controller.signal,
      });
      if (response.status === 401 || response.status === 403)
        throw new Error("登入已失效或沒有此官方帳號的讀取權限");
      if (response.status === 429 && run.limiter && !run.controller.signal.aborted) {
        run.limiter.pauseUntilNextMinute();
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!(response.headers.get("Content-Type") || "").includes("application/json"))
        throw new Error("回應不是 JSON，請確認 LINE 登入狀態");
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
async function fetchLineDirectoryPage(url, run) {
  const page = await fetchLineJson(url, run);
  if (!page || !Array.isArray(page.list))
    throw new Error("回應缺少清單，無法確認是否讀取完整");
  if (page.next != null && typeof page.next !== "string")
    throw new Error("下一頁游標格式不符，無法繼續讀取");
  return page;
}
// 對話清單一頁 25 位，最近有對話的在前（置頂優先）。
function lineChatsPageUrl(botId, next) {
  const url = new URL(`/api/v2/bots/${botId}/chats`, location.origin);
  url.searchParams.set("folderType", "ALL");
  url.searchParams.set("limit", "25");
  url.searchParams.set("prioritizePinnedChat", "true");
  if (next) url.searchParams.set("next", next);
  return url;
}

export { LINE_RATE_PER_MINUTE, fetchLineDirectoryPage, fetchLineJson, lineChatsPageUrl, makeLineRateLimiter };
