// 訂單列共用：聊天室↔乘客對應、訂單狀態／系統自動通知／取消、orderRow() 畫一張訂單。
import { getPickupAddressMismatchSegments, splitAddressPieces } from "./core/address.js";
import { lineExtApi, lineExtOrderApi } from "./core/backend.js";
import { ic } from "./core/icons.js";
import { driverChat, driverChatUnread } from "./driver-chat.js";
import { ih } from "./inbox/core.js";
import { toast } from "./ui/toast.js";

/* ---- 聊天室 ↔ 乘客對應：客叫、AI 叫車的單沒有對話連結，靠後端比對是哪位乘客 ----
 *   POST /line-ext/oa/{bot}/chat-links/resolve { chats: [{ chatId, avatarUrl, messageIds }] }（一次最多 25 個）
 *   後端依聊天室訊息編號 → AI 對話已記的聊天室 → 大頭貼比對，對到就記下，之後以聊天室查得到那位乘客的單。 */
const LINE_CHAT_PROBE_MAX_IDS = 20;
const LINE_CHAT_RESOLVE_BATCH = 25;
const lineMessageIds = (list) => (list || [])
  .map((m) => m && m.message && m.message.id).filter((id) => id != null && id !== "").map(String).slice(0, LINE_CHAT_PROBE_MAX_IDS);
async function resolveLineChats(botId, probes) {
  const data = await lineExtApi("POST", `/line-ext/oa/${encodeURIComponent(botId)}/chat-links/resolve`, { chats: probes });
  return Array.isArray(data && data.linked) ? data.linked : [];
}
const driverChatApi = (method, orderId, sub, body, query = "") =>
  lineExtOrderApi(method, orderId, "/driver-chat" + sub, body, query);
/* ---- 訂單操作：系統自動通知隨時開關、取消訂單（收件匣訂單列、原生頁訂單面板共用） ---- */
const ORDER_NOTI_STATUS = { sent: "✓", sending: "…", failed: "✗", unknown: "?" };
// 自動通知節點一律兩個字（訂單列空間小；過N 例外）；沒列到的用後端給的名稱
const ORDER_NOTI_SHORT = { schedule_accepted: "接單", enroute: "承接", schedule_enroute: "出發", arrived: "抵達", onboard: "客上", completed: "完成", cancelled: "取消" };
// 司機按過N 的節點（由小到大）：訂單列只顯示過到第幾跳
const ORDER_NOTI_WAITS = ["meter_started", "waited_5", "waited_10", "waited_15", "waited_20"];
const orderActionBusy = new Set(); // 動作進行中的 orderId（按鈕暫時停用）
const orderNotiLabel = (l) => ORDER_NOTI_SHORT[l.state] || l.stateLabel;
// 已通知的節點打勾：「承接✓ 抵達✓ 過10✓」；過N 只留最大那一跳；沒送成功的原因不擠在訂單列（授權失效看收件匣右上角，其餘滑過看 orderNotiDetail）
function orderNotiSummary(order) {
  const logs = order.systemNotiLogs || [];
  const waitRank = (l) => ORDER_NOTI_WAITS.indexOf(l.state);
  const lastWait = logs.reduce((best, l) => (waitRank(l) > (best ? waitRank(best) : -1) ? l : best), null);
  return logs.filter((l) => waitRank(l) < 0 || l === lastWait)
    .map((l) => `${orderNotiLabel(l)}${ORDER_NOTI_STATUS[l.status] || ""}`).join(" ");
}
// 滑過提示：每個節點一行，沒送成功的附原因
function orderNotiDetail(order) {
  return (order.systemNotiLogs || [])
    .map((l) => `${orderNotiLabel(l)}${ORDER_NOTI_STATUS[l.status] || ""}${l.error ? `　${l.error}` : ""}`)
    .join("\n");
}
// onChange(done)：開始時 done=false（重畫停用按鈕），結束時 done=true（重抓訂單）
async function runOrderAction(order, label, action, onChange) {
  if (orderActionBusy.has(order.id)) return;
  orderActionBusy.add(order.id);
  onChange(false);
  try { await action(); } catch (e) { toast(`${order.shortId || ""} ${label}失敗：${e.message || e}`, "err", 5000); }
  orderActionBusy.delete(order.id);
  onChange(true);
}
function setOrderSystemNoti(order, enabled, onChange) {
  return runOrderAction(order, enabled ? "開啟自動通知" : "關閉自動通知", async () => {
    const r = await lineExtOrderApi("PUT", order.id, "/system-noti", { enabled });
    order.isSystemNoti = !!r.isSystemNoti;
    if (r.warning) toast(`${order.shortId} 自動通知已開，但${r.warning}`, "warn", 7000);
    else toast(`${order.shortId} 自動通知已${enabled ? "開啟" : "關閉"}`, "ok", 2500);
  }, onChange);
}
// 司機↔客人轉傳（懶惰蟲單）：開著時司機在 App「聯繫客戶」的話加「司機說：」轉到這個對話、客人的話加「客人說：」轉給司機；關掉兩邊都停
function setOrderDriverRelay(order, enabled, onChange) {
  return runOrderAction(order, enabled ? "開啟司機↔客人" : "暫停司機↔客人", async () => {
    const r = await lineExtOrderApi("PUT", order.id, "/driver-relay", { enabled });
    order.driverRelay = !!r.driverRelay;
    if (r.warning) toast(`${order.shortId} 司機↔客人已開啟，但${r.warning}`, "warn", 7000);
    else toast(`${order.shortId} 司機↔客人已${order.driverRelay ? "開啟" : "暫停"}`, "ok", 2500);
  }, onChange);
}
function cancelLineExtOrder(order, onChange) {
  const note = order.hasDriver ? "\n司機已接單：會依車隊規則判定一般／逾時取消，並通知司機。" : "";
  if (!window.confirm(`取消訂單 ${order.shortId || ""}？${note}`)) return;
  return runOrderAction(order, "取消訂單", async () => {
    const r = await lineExtOrderApi("POST", order.id, "/cancel");
    order.cancelled = true;
    toast(`${order.shortId} 已取消（${r.status || "取消"}）`, "ok", 4000);
  }, onChange);
}
const liveOrders = (list) => (list || []).filter((o) => !o.cancelled);
// 一張訂單一列：狀態、單號、派單原文（滑過看解析出的地址）、車輛、追蹤、自動通知開關、司機對話、取消
// 上車地址那一行：📍 地址（行政區底線、門牌不一致紅字）＋「地址可能不正確」＋📝 筆記
function orderAddressLine(o) {
  const mismatch = getPickupAddressMismatchSegments(o.oriText || "", o.pickupAddress || "");
  const pieces = splitAddressPieces(o.pickupAddress, mismatch);
  return ih("span", { class: "loe-ord-addr" + (mismatch.length ? " bad" : ""), title: o.pickupAddress },
    ih("span", { class: "loe-ord-addr-pin", html: ic("map-pin") }),
    ih("span", { class: "loe-ord-addr-text" }, ...pieces.map((p) => ih("span", { class: (p.district ? "loe-ord-district" : "") + (p.mismatch ? " loe-ord-mismatch" : ""), text: p.text }))),
    mismatch.length ? ih("span", { class: "loe-ord-addr-warn", text: "地址可能不正確，請補齊", title: "此地址與派單地址的門牌號碼不一致" }) : null,
    o.note ? ih("span", { class: "loe-ord-note", title: "筆記（司機看不到）" }, ih("span", { html: ic("notebook") }), ih("span", { text: o.note })) : null);
}
function orderRow(o, { onChange, onChat }) {
  const busy = orderActionBusy.has(o.id);
  const car = o.carPlate ? `${o.carPlate}${o.carColor ? `(${o.carColor})` : ""}` : "";
  const eta = o.column === "accepted" && o.estPickupMins > 0 ? `約${o.estPickupMins}分抵達` : "";
  const noti = o.isSystemNoti ? orderNotiSummary(o) || "等待承接" : "";
  const ori = o.oriTextDisplay || o.oriText || "";
  // 同 admin 調度中心：Google 上車地址另起一行，行政區加底線；門牌和派單文字不一致的片段紅字加粗＋提醒；後面接筆記
  const addrLine = o.pickupAddress ? orderAddressLine(o) : null;
  return ih("div", { class: "loe-ord" + (addrLine ? " has-addr" : "") },
    ...[
      ih("span", { class: `loe-ord-col ${o.column || ""}`, text: o.columnLabel || o.status }),
      ih("strong", { text: o.shortId || "" }),
      o.sourceLabel ? ih("span", { class: "loe-ord-src", text: o.sourceLabel }) : null,
      ih("span", { class: "loe-ord-text", text: ori || o.pickupAddress || "", title: ori }),
      car ? ih("span", { text: `🚗 ${car}${eta ? " · " + eta : ""}` }) : null,
      o.trackingUrl ? ih("a", { href: o.trackingUrl, target: "_blank", rel: "noopener", text: "追蹤" }) : null,
      addrLine,
      ih("span", { class: "loe-ord-actions" },
        ...[
          o.systemNotiAvailable === false ? null : ih("button", { type: "button", class: "loe-ord-btn noti" + (o.isSystemNoti ? " on" : ""), html: ic("bell"), disabled: busy,
            title: o.isSystemNoti
              ? `自動通知中${orderNotiDetail(o) ? `\n${orderNotiDetail(o)}` : "：等待承接"}\n點擊關閉`
              : "點擊開啟：之後司機承接／抵達，會用建單人員的懶惰蟲依車隊複製模板自動傳給客人（已過的不補送）",
            onclick: () => setOrderSystemNoti(o, !o.isSystemNoti, onChange) },
            ih("span", { text: o.isSystemNoti ? `自動通知 ${noti}` : "自動通知 關" })),
          o.driverRelayAvailable ? ih("button", { type: "button", class: "loe-ord-btn relay" + (o.driverRelay ? " on" : ""), html: ic("arrow-left-right"), disabled: busy,
            title: `${o.driverRelay ? "轉傳中" : "已暫停"}。開著：司機在 App 傳給客人的話會加「司機說：」轉到這個對話，客人在這裡說的話也會加「客人說：」自動轉給司機（要開著收件匣）；點一下切換`,
            onclick: () => setOrderDriverRelay(o, !o.driverRelay, onChange) },
            ih("span", { text: o.driverRelay ? "司機↔客人" : "司機↔客人 關" })) : null,
          o.hasDriver && onChat
            ? ih("button", { type: "button", class: "loe-ord-btn" + (driverChat.orderId === o.id ? " on" : ""), html: ic("message-square"),
              title: "和這張單的司機對話（同 admin 調度中心的司機對話）", onclick: () => onChat(o.id) },
              ih("span", { text: "司機對話" }), driverChatUnread(o) ? ih("span", { class: "loe-dchat-badge", text: "新" }) : null)
            : null,
          ih("button", { type: "button", class: "loe-ord-btn cancel", text: busy ? "處理中…" : "取消", disabled: busy,
            title: "取消這張單（同 admin 調度中心取消）", onclick: () => cancelLineExtOrder(o, onChange) }),
        ].filter(Boolean)),
    ].filter(Boolean)); // 原生 append 會把 null 印成文字
}

export { LINE_CHAT_PROBE_MAX_IDS, LINE_CHAT_RESOLVE_BATCH, cancelLineExtOrder, driverChatApi, lineMessageIds, liveOrders, orderActionBusy, orderNotiDetail, orderNotiSummary, orderRow, resolveLineChats, setOrderDriverRelay, setOrderSystemNoti };
