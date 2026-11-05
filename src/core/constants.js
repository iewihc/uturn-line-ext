// 共用常數：版本、顏色、class 名稱、本機儲存 key。
// 版本單一來源＝標頭 @version（Tampermonkey 自動更新必讀此行）。
// 這裡不再各寫一份，改從 GM_info.script.version 衍生，杜絕漂移。
const UTURN_BUILD =
  (typeof GM_info !== "undefined" &&
    GM_info.script &&
    GM_info.script.version) ||
  "dev";
/* ---------------------------------------------------------------------- *
 * Constants
 * ---------------------------------------------------------------------- */
const BLUE = "#1c6cf3"; // 主要藍色
const BLUE_HOVER = "#0b57d0";
const BLUE_SOFT = "#eef4ff";
const BUBBLE_CLASS = "loe-copy-bubble";
const BUTTON_CLASS = "loe-copy-button";
const TEXT_PAD_CLASS = "loe-copy-text-pad";
const ICON_CLASS = "loe-copy-icon";
const COPIED_CLASS = "loe-copy-copied";
const QUICK_BUTTON_CLASS = "loe-quick-reply-button";
const QUICK_MENU_CLASS = "loe-quick-reply-menu";
const QUICK_MENU_OPEN_CLASS = "loe-quick-reply-open";
const STORE_KEY = "loe_quick_replies_v1";
const FLEET_STORE_KEY = "loe_fleet_quick_replies_v1"; // 車隊統一模板（匯入後常駐）
const QR_MODE_KEY = "loe_qr_display_mode_v1"; // 氣泡列顯示模式：personal | fleet | both
const QR_BAR_CLASS = "loe-qr-bar"; // 輸入框上方的快捷氣泡列
const QR_CHIP_CLASS = "loe-qr-chip";
const FORWARD_BUTTON_CLASS = "loe-forward-button";
const PREFIX_CHIP_CLASS = "loe-prefix-chip";
const PREFIX_KEY = "loe_prefix_v1"; // 前綴設定（一組，對應目前 OA 帳號）
const WEBHOOK_KEY = "loe_discord_webhook_v1"; // Discord 頻道 webhook 網址
const DISPATCHER_KEY = "loe_dispatcher_v1"; // 派單人員名稱／後台帳號（顯示為 Discord 訊息發送者；驅動遠端設定的 key）
const FLEET_KEY = "loe_fleet_v1"; // 目前要拉哪個車隊的遠端設定（如 HELLO）
const DISPATCH_BUTTON_CLASS = "loe-dispatch-button"; // 派單按鈕
const DISPATCH_POP_CLASS = "loe-dispatch-pop";
const DRIVER_CHAT_BUTTON_CLASS = "loe-dchat-button"; // 原生聊天頁「司機對話」按鈕（派單左邊）
const DRIVER_CHAT_FLOAT_CLASS = "loe-dchat-float"; // 原生聊天頁的司機對話浮動面板
const NATIVE_ORDERS_BUTTON_CLASS = "loe-orders-button"; // 原生聊天頁「訂單」按鈕（這位客人的進行中訂單）
const NATIVE_ORDERS_PANEL_CLASS = "loe-orders-panel"; // 原生聊天頁的訂單浮動面板
const ESTIMATE_BUTTON_CLASS = "loe-estimate-button"; // 估價按鈕
const AUTOREPLY_KEY = "loe_dispatch_autoreply_v1"; // 派單後是否自動回覆客人
const MEMO_INCLUDE_KEY = "loe_dispatch_memo_include_v1"; // 派單是否帶入筆記(note:)
const DISPATCH_TEMPLATE_KEY = "loe_dispatch_template_v1"; // 自動回覆要送的範本名稱
const MARK_FOLLOWUP_KEY = "loe_dispatch_mark_followup_v1"; // 派單後是否標記待處理
const SYSTEM_NOTI_KEY = "loe_dispatch_system_noti_v1"; // 派單是否開「系統自動通知」（司機承接／抵達由後端自動送給客人）
const CHAT_OVERRIDE_KEY = "loe_chat_overrides_v1"; // 對話層級覆寫（群編＋固定上車地址）
const SEND_KEY_STORE_PREFIX = "loe_line_send_key_v1::"; // 身份授權通過的發送 KEY（依後台帳號存；傳送／恢復自動帶入）
const LINE_HOURLY_LIMIT_KEY = "loe_line_hourly_limit_v1"; // 群發每小時上限（依官方帳號記住）
const SKIP_GROUP_CHATS_KEY = "loe_line_skip_group_chats_v1"; // 群發「群組不發送」：過濾 chatId C 開頭的群組聊天（預設開）
const OA_BOT_NAMES_KEY = "loe_oa_bot_names_v1"; // 官方帳號名稱快取 { botId: 名稱 }（後台「開官方聊天室」依名稱找 botId）
/* ---------------------------------------------------------------------- *
 * 後台一鍵分享 → 自動送出
 *   後台按「分享」會開啟  https://chat.line.biz/{gid}/chat/{chatId}?send={token}
 *   本腳本偵測到 ?send={token} 後：
 *     GET  {API_BASE}/line-dispatch/{token}      -> { text, gid, chatId }（一次性，410=已用/過期）
 *     填入對話框 → 點送出 → POST .../ack（回報結果）→ 清掉網址 ?send
 *   ※ 腳本不含任何訊息模板：要送的文字一律由後台 getCopyText() 組好、存在後端，這裡只搬運。
 * ---------------------------------------------------------------------- */
const API_BASE = "https://right.mr-chi-tech.com"; // 後端網域（@connect mr-chi-tech.com 已涵蓋子網域）

export { API_BASE, AUTOREPLY_KEY, BLUE, BLUE_HOVER, BLUE_SOFT, BUBBLE_CLASS, BUTTON_CLASS, CHAT_OVERRIDE_KEY, COPIED_CLASS, DISPATCHER_KEY, DISPATCH_BUTTON_CLASS, DISPATCH_POP_CLASS, DISPATCH_TEMPLATE_KEY, DRIVER_CHAT_BUTTON_CLASS, DRIVER_CHAT_FLOAT_CLASS, ESTIMATE_BUTTON_CLASS, FLEET_KEY, FLEET_STORE_KEY, FORWARD_BUTTON_CLASS, ICON_CLASS, LINE_HOURLY_LIMIT_KEY, MARK_FOLLOWUP_KEY, MEMO_INCLUDE_KEY, NATIVE_ORDERS_BUTTON_CLASS, NATIVE_ORDERS_PANEL_CLASS, OA_BOT_NAMES_KEY, PREFIX_CHIP_CLASS, PREFIX_KEY, QR_BAR_CLASS, QR_CHIP_CLASS, QR_MODE_KEY, QUICK_BUTTON_CLASS, QUICK_MENU_CLASS, QUICK_MENU_OPEN_CLASS, SEND_KEY_STORE_PREFIX, SKIP_GROUP_CHATS_KEY, STORE_KEY, SYSTEM_NOTI_KEY, TEXT_PAD_CLASS, UTURN_BUILD, WEBHOOK_KEY };
