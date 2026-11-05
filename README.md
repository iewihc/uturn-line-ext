# uturn-line-ext

版本 **1.68.5**：修正對話打開後最新幾則（尤其圖片）被擠到下面看不到：圖片載入完還停在底部就自動捲到底。

版本 **1.68.4**：修正司機圖片「轉給客人」變成 image.jpg 檔案：轉傳的圖片一律轉成 JPEG 圖片再送。

版本 **1.68.3**：「選項」每一項左邊加圖示（勾選時變藍）；拿掉「試聽」（開啟提示音時會響一聲）。

版本 **1.68.2**：修正客人訊息常常沒有「轉給司機」按鈕（訂單比訊息晚讀完時沒重畫）。

版本 **1.68.1**：「選項」新增「不顯示官方帳號名稱」：官方訊息列表有群編的列只顯示群編（例如 0/），沒設群編的帳號仍顯示名稱；滑過群編會顯示是哪個官方帳號。

版本 **1.68.0**：收件匣右欄與「選項」。右上「選項」（取代原本的提示音按鈕）：固定開啟司機對話（預設開；選到有司機的單自動開，多台開第一台，自動開不搶客人輸入框游標）、固定開啟記事本（可收起不能關）、開啟對話自動標已讀（預設關＝永遠不自動標，回覆後也不標，只手動按）、新訊息提示音＋試聽。司機對話停靠時與記事本同在右欄：上半司機對話、下半記事本，中間可拖拉（記住高度，雙擊回預設），記事本標題列可收起；兩者不再互搶。固定開啟司機對話但這位客人沒有已派到司機的單時，右欄留一條說明。司機對話多台改成「車」分頁（車號、車牌車色、狀態、未讀紅點），結束的那台直接拿掉、換到下一台；輸入框提示「傳給第 N 台 車牌…」；單號・司機・車牌改成一行文字（點哪段複製哪段）。

版本 **1.67.1**：提示音加大（有人反應太小聲）：音量約 3.4 倍、改三角波、每個音拉長到 0.26 秒（收件匣新訊息、司機訊息共用）。

版本 **1.67.0**：收件匣客人 ↔ 司機訊息一鍵轉傳。客人的文字、圖片、位置下方「轉給司機」（走司機對話 `…/driver-chat/messages`｜`/images`，對象＝這位客人進行中、已有司機的單；多台跳選單選哪一台或全部）；司機對話裡司機的文字、圖片、位置下方「轉給客人」（走收件匣送出）。反白一段文字浮出小工具列「轉給司機／轉給客人、複製」，只轉反白那段。文字加前綴「客人說：」「司機說：」，圖片原圖下載後轉傳（`GM_xmlhttpRequest`，新增 `@connect line.biz`、`storage.googleapis.com`）。按一下就送，原訊息下方標「已轉給司機 ✓」，失敗可重試（多台只重送還沒成功的）。

版本 **1.66.0**：收件匣司機訊息改即時。用發送 KEY 換 30 分鐘 token（`POST /line-ext/chat-token`，只能連即時聊天、後台 API 拒收），連 signalr-chat `/hubs/chat`、每個可調度車隊 `JoinFleet(車隊, 自己)`，`ReceiveMessage` 只留司機講的、自己的單（同後台調度中心「自己」模式：自己建的、店家叫車、客叫單當班沒設或含自己），右上角卡片（單號＋司機、最近幾則，「司機對話」開那位客人並打開這一台）。協商與長輪詢走 `GM_xmlhttpRequest`，WebSocket 被頁面擋就退回長輪詢；token 只在連上時檢查，重連前快到期自動換。選到有司機的單會自動打開司機對話（多台開第一台；手動關掉後同一位客人不再自動開）。官方帳號看板每個聊天室多帶 `orderIds`（訂單 → 客人對話）。

版本 **1.65.0**：改為 Vite 打包。原本 9,200 行的單一檔案拆成 `src/` 下 52 個 ES module（見下方「開發與打包」），`uturn-line-ext.user.js` 改為 `npm run build` 的產物，並以 terser 壓縮＋改名（混淆）。功能與行為不變：每段程式只是搬到對應模組，跨模組才改成 `import`／`export`；原本散在各處、載入時就掛上的事件與計時器改集中在各模組的 `init*()`，由 `uturnMain()` 依原順序呼叫；原本在載入期直接寫入別段變數的三處（收件匣選對話時設定 `pageContext`、換對話時重設貼底狀態、換對話讓 Cookie 擷取失效）改為呼叫對應模組的函式（`setPageContext`、`resetScrollerForChat`／`forceStickFor`、`invalidateLineApiCapture`）。`@updateURL` 不變，使用者端照常自動更新。整理重複：`httpGetJson`／`httpSendJson` 合併成 `core/backend.js` 一個 `gmJsonRequest`；開頁與每輪維護共用 `enhanceChatPage()`；複製／轉發鈕的 CSS 共用一條規則；快速回覆管理視窗的列由 `replyRowInfo()` 產生；派單視窗四個布林勾選由 `boolSetting()` 產生（對外函式名不變）。加 ESLint（`npm run lint`：未使用變數、未定義名稱）——全檔掃過沒有未使用的函式或變數，只拿掉兩個多餘的 import；每個模組檔頭一行用途說明。派單視窗的「系統自動通知」勾選由最上方移到「派單後自動回覆客人」正上方。收件匣左欄「官方帳號」標題右邊加「收起」（‹）：往左收成一條直條，監聽與通知照常，點直條展開；記在 `loe_inbox_rail_collapsed_v1`，預設展開。

版本 **1.64.4**：條款的「禁止提供的內容」「違反前條保密或使用授權義務」加上黃底深紅粗體；完整移除「群發操作與結果確認」，後續條款重新編號，合計八條。條款版本更新為 `2026-11-05.5`。

版本 **1.64.3**：刪除條款中急迫風險時先暫停權限、再通知的句子。條款版本更新為 `2026-11-05.4`。

版本 **1.64.2**：條款開頭改為「本服務由懶惰蟲提供」。條款版本更新為 `2026-11-05.3`，已同意舊版者下次開啟須重新同意。

版本 **1.64.1**：條款中的「新臺幣十萬元違約金」改為黃底深紅粗體，移除身份授權 Cookie 說明及未上線功能範圍段落，並於 LINE 平台風險段落補上「也沒有賠償義務」。條款版本更新為 `2026-11-05.2`，已同意舊版者下次開啟收件匣時須重新同意。

版本 **1.64.0**：首次開啟「UTurn 收件匣」先顯示完整九條使用條款，勾選「我同意」並按「繼續使用」後才進入原本的身份授權／收件匣流程。未同意前不讀取官方帳號、對話或訂單，也不啟動連線；Esc、點背景均不能略過。以本機儲存依 UTurn 後台帳號記錄條款版本與同意時間，同帳號重開不重複詢問；更換帳號、清除紀錄或條款版本更新後須重新同意。條款版本獨立於腳本版本，一般更新不會重複要求同意。紀錄僅存於本機，未上傳後端。

優惠券及多頁訊息已依後端完成版契約接上：同源讀清單、提交數字 ID、失效後重新選擇、授權恢復，以及保留原 requestId 重試。**依後端提供的進度，程式與單元測試已完成，但尚未部署及對真實 LINE 驗收。** 本次前端以模擬後端驗證，沒有部署後端或實發群發。原生格式與 Python 參考見[優惠券規格](docs/line-coupon-backend-spec.md)及[多頁訊息規格](docs/line-card-type-backend-spec.md)。

版本 **1.63.0**：收件匣改名「UTurn 收件匣」，而且**沒有身份授權不得進入**：官方帳號清單讀完後先蓋上授權閘門（顯示要授權的後台帳號；沒設後台帳號就提示先到 LINE 聊天室的轉發設定填），按「身份授權」通過才開始連線、讀對話、抓訂單狀態，標頭其他按鈕也在授權後才出現。收件匣的司機對話多一顆停靠／浮動切換（記在 `loe_inbox_dchat_dock_v1`，預設停靠）：停靠＝對話右邊再開第四欄「官方帳號｜官方訊息｜對話｜司機對話」一次看到；浮動＝蓋在對話右側。司機對話面板（收件匣浮動、訂單看板抽屜、LINE 聊天室浮動面板三種）都可以抓標題列拖曳移動，拖過會多一顆「回原位」（雙擊標題列也行），關閉即復位。對話標頭下方的訂單列改顯示派單原文（`oriTextDisplay`／`oriText`，例如 `F9/虎尾高中`），滑過才看解析出的地址；右上角 ^ 可收起成「狀態＋單號」一行，記在 `loe_inbox_orders_collapsed_v1`。「在官方視窗開啟」移到輸入框下方右側，旁邊新增「待處理」「處理完畢」兩顆（同 LINE 聊天室頂端的對話狀態：`PUT`／`DELETE /api/v1/bots/{bot}/chats/{chat}/followUp`、`…/done`，亮綠＝目前狀態，再按一次取消）。「官方訊息」（原「待回覆」）的篩選列（我負責旁邊）加「重新整理」，把已開帳號的預約／未派／承接／抵達／執行數量整份重抓（不等 20 秒輪詢；後端看板快取 5 秒）。訂單看板的「全部／自己」本來就記在 `loe_board_mine_v1`，下次開啟沿用。

版本 **1.61.0**：收件匣輸入框下方加上 LINE 聊天室同樣的三顆：「貼圖、表情貼」「檔案」「選擇內容」。貼圖面板讀該官方帳號擁有的貼圖（`GET /api/v1/bots/{bot}/stickers/owned`，依 `next` 翻頁）與表情貼（`GET …/emojis/owned`），貼圖點了直接 `POST …/messages/send {type:"sticker",packageId,stickerId,sendId}`；表情貼插進輸入框寫成 `[表情貼N]`，送出時照 LINE 自家前端的寫法轉成 `{type:"textV2",text:"…{emoji_0}…",substitution}`（文字裡的 `{` `}` 逃脫成 `{{` `}}`），泡泡與收到的訊息一樣把 `emojis[]` 位置換成表情貼圖。檔案（圖片／影片／語音／其他，上限同 LINE 網頁版：圖片 20MB、其他 100MB；也可直接貼上）走 LINE 網頁版同一條路：`POST /api/v1/bots/{bot}/messages/{chat}/uploadFile`（multipart）拿 `contentMessageToken` 再 `POST …/messages/bulkSendFiles {items:[{sendId,contentMessageToken}]}`，上傳中圖片先顯示本機預覽。「選擇內容」視窗三個頁籤：預設訊息（`GET /api/v2/bots/{bot}/savedReplies`，帶入輸入框並換掉 `{Nickname}`／`{AccountName}`、記一次 `…/use`）、多頁訊息（`GET …/cardTypeMessages` → `{type:"cardType",cardTypeMessageId}`）、優惠券（`GET …/coupons` → `{type:"coupon",couponId}`）。所有送出共用同一段「樂觀泡泡 → 打 API → 認領 SSE」流程，SSE 的 `messageSent` 以 `sendId` 認領自己的泡泡（沒有 sendId 才退回比文字）。

版本 **1.55.0**：多開收件匣。LINE 聊天室標題列新增「收件匣」入口，新分頁開 `https://chat.line.biz/?uturnInbox=1`；腳本改為 `@run-at document-start`（一般頁面等 DOMContentLoaded 才跑主程式，行為同原本的 document-idle），收件匣頁在 document-start 就 `window.stop()` 接管整頁，LINE 的 SPA 不啟動。左欄列出所有有權限的官方帳號（`GET /api/v1/bots`，含 LINE 回報的未讀數），每個開關＝一條 SSE（`POST /api/v1/bots/{bot}/streamingApiToken` → `{streamingApiBaseUrl}/api/{version}/sse`），只監聽打開的帳號，狀態存本機（`loe_inbox_enabled_bots_v1`）；斷線退避重連、`fail/too_many_sse_connections` 顯示「連線數已滿」一分鐘後再試。中欄列啟用帳號的對話（每帳號初掃 2 頁），篩選未讀／全部／未指派／我負責，可依客人名、訊息內容或官方帳號名搜尋；SSE `chat` 事件 `message` 進來即時更新、同一位客人合併計數，右上通知卡片（顯示官方帳號、客人、內容，可「在收件匣回覆」或「開官方視窗」）、Web Audio 提示音（可關，存 `loe_inbox_sound_v1`）、分頁在背景時桌面通知。右欄讀 `GET /api/v3/bots/{bot}/chats/{chat}/messages` 顯示對話，沿用快速回覆氣泡列，Enter 送出 `POST …/messages/send {type:"text",text,sendId}`（帶 `X-XSRF-TOKEN`，403 自動換 token），送出成功即 `PUT …/markAsRead`；「標為已讀」、「在官方視窗開啟」（新分頁開 `/{bot}/chat/{chat}`）。所有 LINE 請求走既有的每分鐘 900 次限速器。 收件匣選中對話時以 `pageContext` 取代網址／標題列來源（`getOaId`／`getChatId`／`getCustomerName`／`getOaName`），所以每則文字訊息旁的「複製」「派單」、對話標題列的「派單」與「AI處理／轉人工」切換都直接沿用 LINE 聊天室的同一套程式；派單後的自動回覆改走收件匣送出、標記待處理改打 `PUT …/followUp`。待回覆清單與對話標題顯示客人頭像（`profile.iconHash` 的 preview 圖，載不到退回名字首字）。 清單每列標上派單預設群編（該對話有店配覆寫就用覆寫的群編，否則用該官方帳號的前綴），對話標題列有該帳號的預設群編 chip（點擊開前綴小視窗修改，存的是同一份 `loe_prefix_v1::{botId}`，與 LINE 聊天室共用）。有 AI 客服的官方帳號在左欄標「AI」（啟用後拿最近一位客人 `client-ai/resolve` 一次得知 `aiAccount`），清單每列顯示 AI處理／轉人工（逐一 resolve，沒對到的再以 LINE 客人資料比對一次，同時最多 2 個），對話標題列的 AI處理／轉人工切換與 LINE 聊天室同一套程式。介面文字不出現「SSE」。

版本 **1.54.0**：(1) **AI處理中的對話一送出訊息就自動轉人工**：客服自己按傳送／Enter，或懶惰蟲代送（快捷回覆、派單自動回覆、後台派單 `?send=`）都算，判定方式是送出手勢前輸入框有字、300ms 後被清空（Enter 設成換行的環境不會誤判），成功後提示「你已回覆客人，已自動轉人工」；沒有 AI 或已是轉人工的對話不理會。(2) 訊息泡泡的「轉發」提示改為「派單」（功能不變：帶入派單視窗的上車地址）。(3) 效能：聊天室維護迴圈只掃還沒處理過的泡泡（處理完的 `.chat-item` 掛 `loe-copy-bubble`、無文字的掛 `loe-nocopy`），不再每次 DOM 變動就對整頁訊息逐一查詢；MutationObserver 不再監看純文字變動（時間戳、未讀數更新不觸發整輪維護），維護跑完用 `takeRecords()` 丟掉自己造成的紀錄；250ms 心跳先比對 pathname 字串才拆 URL，餘額查詢併入同一個計時器；「待處理」按鈕成對找到後快取到它離開 DOM；雲端設定改在瀏覽器空閒時（最多延後 1 秒）拉。功能與行為不變。

版本 **1.53.2**：前綴設定的「UTurn後台帳號」Email 防呆：網域打成 gamil、gmial、gnail、gmail.con、gmailcom… 等常見 Gmail 錯字，離開欄位或按儲存時自動更正成 `gmail.com` 並提示；已存成錯字的舊設定在讀取時自動更正存回，不用重設。其他信箱（yahoo、hotmail、gmail.com.tw…）不動。

版本 **1.53.1**：AI 切換查狀態時 resolve 多帶 `X-Oa-Name`（官方後台頁首名稱，URL 編碼，同同步客戶）：官方後台網址還沒填的 AI 官方帳號，後端依名稱對到客戶端OA設定就自動記下，不用再手動填。頁首名稱還沒出現時回的「沒 AI」不記在本分頁，下次換對話再問。需後端 right-backend dc347a77 以上（舊後端忽略這個 header，行為同 1.53.0）。

版本 **1.53.0**：聊天室頂端「待處理」左邊新增 **[AI處理][轉人工]** 切換，只在 AI 客服開著的官方帳號出現（後端依客群設定「官方後台網址」＋line-dai 的 AI 啟用／自動回覆判斷，後台關掉 AI 最多 1 分鐘後換對話就不再出現；沒填的 AI 官方帳號要先在後台填，或做一次「同步客戶與記事本」自動補）。切成「轉人工」＝AI 不再回這位客人（同調度中心轉人工，轉人工後沒動靜（從轉人工或調度最後回覆起算）超過車隊設定分鐘數、預設 15 分鐘，後端自動交回 AI；right-backend 57b9ed61 起）；切回「AI處理」＝交回 AI。官方帳號後台的聊天室 ID 與 AI 記的 LINE userId 是兩套 ID，LINE 沒提供對應：換對話時先 `POST /line-oa/{groupId}/chats/{chatId}/client-ai/resolve`（body `{}`）問後端有沒有記下對應；沒有才以 LINE 後台 API 依聊天室 ID 讀客人原名＋大頭貼（先試 `GET /api/v1/bots/{botId}/chats/{chatId}`，不行就翻最近 4 頁對話清單；**不讀畫面標題**，避免切換瞬間讀到上一位客人），再 resolve 一次帶 `{name, nickname, avatarUrl}`（`nickname`＝客服改的暱稱 `profile.nickname`），後端比對大頭貼（沒有大頭貼才用唯一同名）並記下聊天室與暱稱（調度中心「客人」分頁顯示暱稱、可用暱稱搜尋）。回 `{aiAccount, matched, handoffActive}`：`aiAccount=false` 不顯示且本次不再查這個官方帳號；`matched=false` 顯示灰色「未對到 AI」。切換 `PUT …/client-ai/handoff` body `{handoff: true|false}`（帶 `Idempotency-Key`）。回到分頁時重讀狀態。同版也讓後台「開官方聊天室」改用大頭貼找人：`uturnOpen` 多帶 `k`（大頭貼比對鍵），翻對話清單時大頭貼相同就直接開（名稱被客服改過、同名多位都不影響），沒有才依名稱（LINE 原名或客服改的暱稱都比）。需後端 right-backend e68bf1db 以上（resolve 多帶的 `nickname` 舊後端不收）。

版本 **1.52.1**（只動同步）：客戶列多帶 `nickname`（客服在官方後台改的暱稱；`lineName` 仍是 LINE 原名，沒有原名才用暱稱），後端兩種都存、後台都會顯示。「進階功能 → 同步客戶與記事本」與群發視窗的同步按鈕後面顯示最後同步時間（例：「同步客戶與記事本（最後同步 10/26 17:12）」，沒同步過顯示「尚未同步」）：打開選單時以 `GET /line-oa/{groupId}/customers?pageNum=1&pageSize=1` 讀後端的 `updatedAt`，同步成功即更新。後端同步工作端點已上線（right-backend da40f3f0）。

版本 **1.52.2**：LINE 讀取加全域限速。2026-10-26 實測兩次：LINE API 每分鐘恰好 1,000 個請求，第 1,001 個起回 429，下一分鐘恢復（v1.52.0 第一次實跑在讀到第 998 位記事本時就被 429 中止）。同步流程所有 LINE 請求（名單翻頁、成員清單、記事本）改為共用一個限速器，每分鐘最多 900 個，留餘裕給客服同時操作 LINE 介面；真的碰到 429 就整體暫停到下一個整分再多 2 秒，重送同一請求，429 永遠不算失敗，進度列顯示「LINE 限流中，等 N 秒再續讀」。4.4 萬位客人預計約 50 分鐘。

版本 **1.52.0**：「同步客戶」與「同步客人記事本」合併為進階功能的「同步客戶與記事本」（群發視窗的同名按鈕也是同一條流程），並改為分批上傳，**需要後端新增同步工作端點，契約見下方「後端需同步：同步工作（syncs）」**；舊的 `POST /line-oa/{groupId}/customers` 與 `POST /line-oa/{groupId}/customer-notes` 前端不再呼叫。2026-10-26 在 chat.line.biz 對約 44,000 位客人的官方帳號實測的依據：
- 對話清單 `GET /api/v2/bots/{botId}/chats` 每頁最多 25 位（`limit` 超過回 400 `exceeded_limit`），游標分頁只能一頁接一頁翻，約 2 頁／秒，4.4 萬位約 16 分鐘，無法平行。
- 記事本是 LINE 介面本身用的 `GET /api/v1/bots/{botId}/chats/{chatId}/notes?limit=20&withTotal=true`，回 `{ list: [{ noteId, body, createdAt, updatedAt, userBizId }], total }`；25 個同時打約 0.2 秒、沒有 429，可以平行。內容取 `body`；`total` 與讀到的筆數不符視為沒讀完。
- 記事本只有作者的 `userBizId`，名字用 `GET /api/v1/bots/{botId}/owners`（`{ list: [{ bizId, name }] }`）換，查不到就空字串。
- 對話物件 `profile.name` 是客人 LINE 原名、`profile.nickname` 是客服改的暱稱；沒有「有無記事本」欄位，所以每位都要讀（抽樣約 17% 有記事本）。
- 整份名單約 12.7 MB，單一請求上傳不可行（原 8 MB 上限直接失敗，而且失敗提示被「同步中切換對話」吃掉，這兩點都已處理）。

流程：先 `POST /line-oa/{groupId}/syncs` 建同步工作拿 `syncId`，讀一次成員清單；翻到一頁對話就把那 25 位的記事本交給 12 路工作池平行讀；每湊滿 500 位就 `PUT …/syncs/{syncId}/chunks/{index}` 上傳一個 chunk（客戶列＋有記事本的客人）；名單翻完、記事本讀完、chunk 都傳完才 `POST …/commit` 帶總數，由後端對過筆數整份換掉舊資料。任何一步失敗（LINE 讀取失敗／逾時、官方帳號切換、後端回應不符）就 `DELETE …/syncs/{syncId}`，後端資料維持原樣。LINE 429／5xx 與後端暫時性錯誤各退避重試 3 次（同 index 的 chunk 重送＝覆蓋）。常駐 toast 顯示「名單已讀／記事本已讀／已上傳」與已花分鐘數；完成提示只要仍在同一官方帳號就會顯示。空清單不 commit、不更動後端。

版本 **1.51.0**：「進階功能」新增「同步客人記事本」（不需後台帳號，只要在官方帳號頁、同一分頁不重複執行）。先讀完目前官方帳號的所有對話（`GET /api/v2/bots/{botId}/chats`，自己的讀取流程，不影響「同步客戶」），再逐位讀 LINE 記事本（同時 4 位，每位最多 20 頁），全部讀完才 `POST /line-oa/{groupId}/customer-notes` 整份上傳：body 為 `[{chatId, lineName, nickname, notes:[{text, authorName, createdAt}]}]`，只放至少有一則非空記事本的客人（`lineName`＝LINE 原本名稱 `profile.name`，`nickname`＝客服改的暱稱 `profile.nickname`，沒有就空字串；`createdAt` 毫秒，不知道為 0），header 與同步客戶相同（`X-Synced-By`、`X-Oa-Name`），超過 8,000,000 bytes 不上傳。後端整份取代（沒送的客人＝沒有記事本），所以任何一位讀取失敗、逾時或官方帳號切換都整次不上傳。記事本 API 未公開：第一位客人依序試 `/api/v1/bots/{botId}/chats/{chatId}/notes`、`/api/v2/…/notes`、`/api/v1/…/notes?limit=100`，第一個回 2xx 且有清單（陣列或 `list`／`notes`／`items`，`next`／`nextCursor` 游標）的整次沿用；都不行就提示截圖 F12 Network 給工程師。對話物件若有名稱含 `note` 的布林／數字欄位且為 false／0 就略過該客人。對話、profile 與第一則記事本的欄位名稱（不含內容）會以 `console.debug` 印出供調整。

版本 **1.50.0**：
- 「同步客戶」不再被群發作業或後台帳號鎖住，只要裝了懶惰蟲、在官方帳號頁就能同步；同一分頁只防重複執行（進階選單與群發視窗同時按會共用同一次同步）。群發作業進行中同步只刷新左側可選清單，作業收件人仍是提交時的快照。上傳名單時多帶 `X-Synced-By`（後台帳號，`encodeURIComponent`；沒設後台帳號就不帶）與 `X-Oa-Name`（官方帳號名稱，`encodeURIComponent`）：後端依名稱對到客戶端OA設定的 AI 官方帳號，自動記下官方後台編號，同步過的客人在後台按「開官方聊天室」就直接開他的聊天室；不在懶惰蟲配置的 AI 官方帳號也能同步。body 格式不變。
- 後台「開官方聊天室」：開啟 `https://chat.line.biz/{botId}?uturnOpen={payload}`（不知道 botId 時為 `https://chat.line.biz/?uturnOpen={payload}`），`payload` 為 UTF-8 JSON `{"v":1,"oa":"官方帳號名稱","n":"乘客 LINE 名稱","k":"大頭貼比對鍵(選填)","at":乘客最後訊息時間(ms，選填)}` 的 base64url（無 padding）；`n`、`k` 至少要有一個。大頭貼比對鍵＝對話物件 `profile.iconHash`：`0h` 開頭去掉第 7–10 字與最後 13 字（每次網址都會變的簽章），`0m` 開頭整段（與後端 `lineAvatarKey` 一致）。腳本讀到後先清掉網址參數（同一 payload 只處理一次），botId 以網址為準，沒有就依官方帳號名稱查（本機記住的「botId → 名稱」，在官方帳號頁時自動記；再查 LINE 官方帳號清單），查不到提示請管理員到「客戶端OA設定」填寫官方後台網址。接著翻對話清單（最近有對話的在前，找到第一位後再看 2 頁、最多 200 頁）：有 `k` 且大頭貼比對鍵相同就立刻開啟；否則比對乘客名稱（`profile.name` 或 `profile.nickname` 相同都算）：一位直接開啟；同名多位時依 `at` 挑對話時間最接近的（沒有時間欄位就開最近的）並提示；找不到則提示並把名字填進左側搜尋。對話時間欄位尚未確認，第一次翻頁會以 `console.debug` 印出對話物件的欄位名稱（不含內容）供調整。

版本 **1.49.4**：「同步群編」成功提示改顯示車隊名稱（後端 `GET /line-ext-config` 一併回 `fleetName`；後端未更新前退回顯示代碼），未選車隊的提示不再舉代碼為例。

版本 **1.49.3**：轉發設定的車隊搜尋清單改為 mousedown 只擋輸入框失焦、click 才選取，點選結果不會再被「點面板外關閉」吃掉。

版本 **1.49.2**：車隊名稱比對與後端同口徑，emoji 的兩種變體符號（FE0E 文字呈現、FE0F emoji 呈現）都忽略，「❤︎」「❤️」「❤」視為同一個字。

版本 **1.49.1**：移除載入與切換官方帳號時對 `GET /api/v2/bots/{botId}/chats` 的全量預先翻頁（每 25 筆一請求直到沒有 `next`）。該結果只有「同步客戶」會用，而同步本來就會重新讀取，預先抓取純屬多餘請求；現在只在按「同步客戶」時讀取，行為不變。

版本 **1.49.0**：轉發設定的「車隊」改為搜尋選取：輸入滿 2 個字才列出代碼或顯示名稱包含該字的車隊（最多 8 筆，完全符合的代碼／名稱不限字數，如單字代碼 W），點選或 Enter 選第一筆，儲存車隊代碼。選項來自公開端點 `GET /fleets`（只列啟用、非懲罰車隊）。舊設定的代碼或顯示名稱開面板時自動對應；對不到（例如車隊已改代碼）時須重新搜尋選擇才能儲存，列表載入失敗則未改動時沿用原設定。

版本 **1.48.1**：轉發設定的「車隊」儲存前先以 `GET /line-ext-config?fleet=` 向後端確認（代碼或顯示名稱、不分大小寫），對得到才存並改存車隊代碼；查無此車隊或無法連線時不儲存並提示。不列出車隊清單。

Tampermonkey userscript：`uturn-line-ext.user.js`。版本 **1.48.0**：群發分批傳送。LINE 規定官方帳號 1 小時內傳給超過 200 位不同客戶會暫時鎖住一對一聊天，傳送設定新增「3. 分批傳送」（每小時上限 1～190，預設 180，依官方帳號記在本機），即時顯示分幾批、約多久、預計幾點送完，超過一批時送出前再確認；建立作業帶 `hourlyLimit`。後端送滿上限會把作業轉 `scheduled`（`nextRunAt` 到了自動接著送），LINE 回 429 也只延後、不判失敗；同一官方帳號一次只跑一批，後送的排隊（`jobsAhead`）。進度通知新增「暫停傳送」（`POST …/pause`，轉 `paused`）、`paused` 也可「恢復傳送」、「重送失敗客戶」（`POST …/retry-failed`，需 KEY；只重送 `retryable` 的確定未送出客戶，收件結果每列也可單獨「重送」）、「取消整批」先確認；顯示每小時上限、過去 1 小時已送、下一批時間、預計送完。過濾對象改稱「不發送」（左側「不發送／恢復發送」、右側「不發送名單」），被排除的客戶姓名加刪除線。移除後端已不回傳的 `EXCLUSION_LIST_REQUIRED`／`MESSAGE_JOB_FILTER_MISSING` 分支。

版本 **1.47.2**：過濾對象只從左側已載入的客戶清單點「過濾」加入，移除手動填寫／貼上名單功能。右側以客戶姓名顯示，可點 ×、左側「取消過濾」或「清空過濾名單」移除。

版本 **1.47.1**：過濾名單改為選填，留空也能傳送；「群組不發送」仍獨立套用。未設定名單時提交 `excludedChatIds: []`，建立、重試及恢復接受 `excludedCount: 0`。後端必須同步允許空名單，具體調整見下方「後端需同步：過濾名單選填」。本次尚未對正式後端實發驗收。

版本 **1.47.0**：發送 KEY 改在「身份授權」輸入一次（`PUT /line-ext-cookie` 帶 `X-Line-Send-Key`，後端驗 KEY 通過才存 Cookie），通過後依後台帳號記在本機（GM 儲存），群發視窗不再輸入 KEY，建立／恢復自動帶入；KEY 失效時提示重新身份授權。

版本 **1.46.0**：發送 KEY 改為只綁後台帳號（不限官方帳號）、新增「群組不發送」（預設開，剔除 C 開頭的群組聊天 chatId，設定存本機）、KEY 驗證失敗過多改用 `429 SEND_KEY_TOO_MANY_ATTEMPTS` 獨立提示。

版本 **1.45.0** 已對齊發送 KEY 與過濾名單完成版契約：顯示後端實際收件人數及過濾名單人數、依後端紀錄處理舊作業、保留恢復失敗的提示。延續 v1.44.0 的「群發訊息 - 懶惰蟲」視窗、隱藏識別碼、選單圖示及「身份授權」名稱；腳本不輸出 Console 訊息。

發送 KEY 仍須完成身份授權，過濾名單自 v1.47.1 起可留空。原先要求至少一位過濾對象的後端需先更新，否則仍會回 `422 EXCLUSION_LIST_REQUIRED`；前端會提示聯絡管理員更新。前端不自行判斷 KEY 是否有效，也不推算到期日。[原始過濾名單與發送 KEY 契約](docs/line-send-access-backend-spec.md)保留供對照，空名單行為以下方新版說明為準。

發送類型仍以一整排單選「文字／圖片／優惠券／多頁訊息」，只顯示目前類型的編輯區，按「傳送」只提交該類型，以簡易 toast 顯示進度及結果，可在同一視窗連續編輯下一則訊息。

後端已提供圖片功能，現行契約見 [OpenAPI](docs/line-messages.openapi.json)。[圖片規格與 Python 範例](docs/line-image-only-spec.md)保留 LINE 兩段式請求與後端 Python 參考；前端只使用後端的 mediaId。

## 後端需同步：同步工作（syncs）

前端 1.52.0 起改用以下端點同步客戶與記事本，請後端實作後再部署前端。所有請求都帶 `X-Synced-By`（後台帳號，`encodeURIComponent`，沒設就不帶）與 `X-Oa-Name`（官方帳號名稱，`encodeURIComponent`），語意同原本的 `POST /customers`；以建立工作那次為準即可。

| 端點 | 用途 | 請求 body | 成功回應 |
| --- | --- | --- | --- |
| `POST /line-oa/{groupId}/syncs` | 建立同步工作（暫存區） | `{}` | `201 { groupId, syncId }` |
| `PUT /line-oa/{groupId}/syncs/{syncId}/chunks/{index}` | 上傳第 `index`（從 0 起）批，最多 500 位 | `{ customers: [{ lineName, nickname, chatId, avatarUrl }], notes: [{ chatId, lineName, nickname, notes: [{ text, authorName, createdAt }] }] }` | `200 { syncId, index, customers: <customers 長度>, notes: <notes 長度> }` |
| `POST /line-oa/{groupId}/syncs/{syncId}/commit` | 全部傳完，整份取代 | `{ chunks, customers, chatsWithNotes, notes }`（chunk 數、客戶總數、有記事本的客人數、記事總則數） | `200 { groupId, replaced: true, customers, chatsWithNotes, notes }`（數字＝實際寫入） |
| `DELETE /line-oa/{groupId}/syncs/{syncId}` | 撤銷未 commit 的工作 | — | `204` |

規則：
- `customers` 列格式同原本 `POST /customers` 的陣列元素；`notes` 列格式同原本 `POST /customer-notes` 的陣列元素（`createdAt` 毫秒，不知道為 0；`authorName` 可能空字串），只放至少有一則記事本的客人。一位客人只會出現在一個 chunk。
- chunk 寫進 `syncId` 的暫存區，**同一個 `index` 重送就覆蓋**（前端網路不穩會重送），不可累加。
- commit 時先核對暫存區：chunk 數、客戶總數、有記事本的客人數、記事總則數四個數字都要和 body 一致，不一致回 `409 { code: "SYNC_COUNT_MISMATCH", detail }` 且不更動正式資料；一致才在同一交易內用暫存區整份取代該官方帳號的客戶清單與記事本（沒出現的客人＝刪除、沒出現的記事本＝刪除），並沿用原本依 `X-Oa-Name` 記下官方後台編號的行為。
- commit 成功後的 `DELETE` 回 `404` 或 `409` 即可，不得動到已 commit 的資料；未 commit 的工作建議 2 小時後自動清掉。同一官方帳號可同時存在多個未 commit 的工作（不同客服各按一次），後 commit 的覆蓋先的。
- 同步中前端不會呼叫舊的 `POST /customers`、`POST /customer-notes`；`GET /line-oa/{groupId}/customers` 分頁讀取不變。

## 進階功能

工具列顯示有齒輪圖示的「進階功能」，點開後有以下三個附圖示的選單項目。可點外面或按 Esc 關閉，也可用方向鍵選取。

| 按鈕 | 行為 | 後端端點 |
| --- | --- | --- |
| 身份授權 | 手動擷取必要 Cookie，更新設定中後台帳號的 extCookie | `PUT /line-ext-cookie?account={account}` |
| 同步客戶與記事本 | 翻完目前官方帳號所有對話並平行讀每位客人的 LINE 記事本，每 500 位上傳一個 chunk 到同步工作，全部完成才 commit 整份取代（失敗就撤銷，後端資料維持原樣；header `X-Synced-By`＝後台帳號、`X-Oa-Name`＝官方帳號名稱，皆選填） | `POST /line-oa/{groupId}/syncs`、`PUT …/syncs/{syncId}/chunks/{index}`、`POST …/syncs/{syncId}/commit`、`DELETE …/syncs/{syncId}` |
| 群發訊息 | 搜尋、單選、多選、全選所有人、直接傳送、toast 進度通知 | `GET /line-oa/{groupId}/customers` |

基底：`https://right.mr-chi-tech.com`。`account` 來自轉發設定的「UTurn 後台帳號」；`groupId` 是目前 LINE 官方帳號網址中的第一個 U ID，須與配置中的官方帳號 GroupId 一致。

Cookie 僅由手動點「身份授權」擷取，不在載入或切換對話時讀取，不寫入 GM 設定或 localStorage、不列印至 Console。必要欄位為 `ses`、`__Host-chat-ses`、`XSRF-TOKEN`；缺少時不覆寫後端。Tampermonkey 須設定 Advanced → Security → Allow scripts to access cookies: All。

名單只在點「同步客戶」時才向 LINE 讀取，載入或切換官方帳號不預先抓取；不輸出 Console。視窗內的同名按鈕放在客戶列表上方，會完整讀取 LINE、同步後端，再刷新列表；不受群發作業或後台帳號限制，只禁止重複同步，同步中暫停勾選與傳送，保留草稿、勾選及過濾設定。分頁失敗、官方帳號切換、完整名單超過 8,000,000 bytes 時不傳部分名單。空清單依後端規則保留舊資料；同步或刷新失敗會在畫面提示，不要求使用者查看 Console。

## 客戶選取與傳送

- 一次只針對同一官方帳號，選一位或多位客戶。
- 過濾名單選填；沒有不發送的對象就留空，需要時只從左側已載入的客戶旁點「過濾」加入。可先搜尋姓名或翻頁找到客戶，已加入的過濾對象會保留。右側顯示姓名，點 ×、左側「取消過濾」或「清空過濾名單」可移除；不提供手動填寫或貼上欄位。無名稱時顯示「未命名客戶」，不以 ID 當名稱或滑鼠提示。
- 全選、搜尋、翻頁都保留過濾設定，顯示「已選 − 過濾 = 實際發送」；全被過濾時不能送。文字、圖片、優惠券、多頁訊息均使用扣除後的同一套收件人規則。
- 發送 KEY 在「身份授權」以遮罩輸入（預填已存的 KEY），驗證通過後依後台帳號存在 GM 儲存，不輸出到 Console。KEY 以 `X-Line-Send-Key` header 隨身份授權、建立及恢復請求傳送；後端驗證效期、撤銷與後台帳號（KEY 只綁後台帳號，不限官方帳號）。
- 重試固定沿用原本收件人及 `excludedChatIds`，KEY header 可更換，不改原 requestId/body。缺 KEY 時不能重試或恢復，但仍能查看進度和取消。
- KEY 由後台發放，固定一個月到期。建立及進度回應的 `recipientCount` 是實際收件人數；`excludedCount` 是過濾名單去重筆數，不是這次實際扣除人數。0 是合法的空名單，不能單憑 0 判定為舊作業或阻擋恢復；恢復不要求本機保有 ID 名單，是否缺少作業快照由後端確認。
- 恢復收到 KEY 或過濾快照錯誤時，提示會保留至使用者處理，不會被隨後的進度查詢清掉。限流提示一分鐘後手動重試，不自動重送；結果不明仍保留原請求。
- 發送類型單選，只顯示選中區域；切換保留草稿，但未選類型不送出。優惠券以直式卡片兩欄並排挑選，多頁訊息可左右查看卡片摘要。首次切換到優惠券或多頁訊息時自動讀完整清單；同視窗切回沿用已讀資料與已選內容。可按「重新讀取」更新，讀取失敗後切回也會重試。
- 顯示每頁 50 筆；「全選所有人」以每頁 500 筆讀完全部客戶，不帶搜尋條件，包含所有分頁。讀取失敗或清單更新時保留原勾選。
- 按「傳送」直接發送，不再顯示預覽或第二次確認。文字最多 5,000 個 UTF-16 code units，一次 1～50,000 位收件人。
- 圖片最多一張，選圖立即上傳原圖，成功後才能傳送。圖片類型只送圖片，文字草稿不會夾帶。換圖會取消舊上傳、改用新圖；格式由後端依內容判定。
- 選圖區只顯示一個「選擇圖片／更換圖片」按鈕，旁邊保留已選檔名。作業結束後自動恢復客戶勾選、文字輸入及圖片上傳，保留上一筆結果供查看；重新整理後也不會被已結束的舊作業鎖住。
- 成功後只清空已送類型的草稿，保留其他類型草稿及已勾選客戶，可直接輸入下一則再傳送。不需要按「建立下一次傳送」或重新開啟視窗；失敗時保留草稿供修改。
- 右下角 toast 顯示進度與結果；成功或取消通知約 6 秒後收起。重試、身份授權及恢復等按鈕只在需要時顯示；詳細收件結果需展開「查看詳情」才讀取。展開詳情時通知不自動收起。
- 上傳中、失敗或圖片過期時停用傳送，可移除、換圖或重新上傳。前端不另加檔案大小限制，後端技術上限為 50MB；413 顯示縮小圖片後重選的提示。
- 後端拒絕優惠券或多頁訊息時，清除該類型的舊清單與選擇，提示重新讀取、選擇，再用新的 requestId 發送；不重新上傳圖片。
- `503 LINE_UNAVAILABLE` 明確沒有建立作業：顯示稍後重試，鎖住原內容，關閉或重整後也沿用同一個 requestId 和完整 body，不自動重試。
- `409 LINE_COOKIE_INVALID` 提示重新「身份授權」；作業已建立並等待憑證時仍使用「恢復傳送」。
- 202 表示已入隊，畫面每 2.5 秒查進度。進入終態停止輪詢；Cookie 失效時顯示身份授權與恢復按鈕。
- 關閉視窗不取消已提交作業，重新開啟會接回目前作業；切換官方帳號或後台帳號會關閉視窗並停止該視窗的查詢。
- 「取消尚未傳送」停止剩餘訊息；「恢復傳送」繼續等待 Cookie 的作業。已成功及結果不明的訊息不會自動重送。
- 可按目前作業的失敗、結果不明、成功等狀態查看分頁收件結果。沒有接管理員發送日誌。

每次按「傳送」產生 UUID `requestId`；提交前保存原始內容與 ID，連點只提交一次。逾時、網路錯誤、5xx 或無法解析成功回應時，提供「重試同一次傳送」，完整沿用原始內容與 requestId。傳送中或提交結果未確認時，暫時鎖定編輯；首次提交若明確被拒絕，可直接修改再送，不需要返回編輯的額外步驟。已接受後保存目前作業參考、進度及過濾快照，不保留待提交的文字及收件陣列。這些狀態依 account/groupId 存在本機設定，沒有 Cookie 或發送 KEY（KEY 另依後台帳號存放）。結果不明的舊請求若缺少原始過濾欄位，不會擅自補值重試；已建立作業若後端明確回 `MESSAGE_JOB_FILTER_MISSING`，則提示先確認結果並取消剩餘訊息，再重新建立。明確保存的空陣列不屬於缺少快照。

## 後端需同步：過濾名單選填

本節是 v1.47.1 需要的後端調整，尚未確認正式後端已支援：

- 建立作業仍帶 `excludedChatIds` 欄位，允許 0～50,000 筆；`[]` 表示沒有手動過濾對象，不再回 `EXCLUSION_LIST_REQUIRED`。非空項目的格式、標準化、去重、上限檢查維持原規則；前端不填入假 ID。
- 空名單也須保存為作業快照 `[]`。建立回應及進度的 `excludedCount` 可以為 0，`recipientCount` 仍為實際收件人數。
- 恢復作業須區別「快照欄位不存在／null」與「快照為空陣列」。空陣列允許恢復；只有缺少快照的舊作業才適用 `MESSAGE_JOB_FILTER_MISSING`，不能以名單是否為空判斷。
- 冪等比較仍包含過濾名單；逾時後使用同一個 requestId、完整 body（含原本的 `[]`）重試。不要在重試時補人或重新計算名單。
- 「群組不發送」由前端先剔除收件人，與手動過濾獨立；空名單不代表取消群組排除。發送 KEY、訊息內容及至少一位實際收件人的檢查不變。

## 後端契約（優惠券、多頁訊息已完成開發，待部署驗收）

- [OpenAPI 3.1](docs/line-messages.openapi.json)
- [多人文字請求範例](docs/line-message-job.example.json)
- [多頁訊息後端規格與 Python 範例](docs/line-card-type-backend-spec.md)
- [多頁訊息群發 JSON](docs/line-card-type-message-job.example.json)
- [多頁訊息列表／發送格式紀錄](docs/line-card-type-browser-evidence.json)
- [Python 文字、圖片、優惠券及多頁訊息發送參考](scripts/line_chat_send.py)

以下端點沿用原有契約；[OpenAPI](docs/line-messages.openapi.json) 保留原契約，空名單調整以上一節為準。只有身份授權（`PUT /line-ext-cookie`）、建立與恢復帶 `X-Line-Send-Key`，建立 body 一律帶 `excludedChatIds`，未設定則為 `[]`；上傳原圖、進度、逐則結果和取消不帶 KEY。前端不附 Bearer Authorization，不額外傳 Cookie。

| 方法及路徑 | 內容 |
| --- | --- |
| `POST /line-oa/{groupId}/message-assets?account=...` | multipart 的單一 file，回 201 與 mediaId、expiresAt |
| `POST /line-oa/{groupId}/message-jobs` | 建立作業，body 見下方，回 202 |
| `GET /line-oa/{groupId}/message-jobs/{jobId}?account=...` | 進度欄位 `counts`；輪詢至終態 |
| `GET /line-oa/{groupId}/message-jobs/{jobId}/deliveries?account=...&pageNum=1&pageSize=50&status=failed` | 逐則結果；型別欄位為 `messageType` |
| `POST /line-oa/{groupId}/message-jobs/{jobId}/cancel` | body `{ "account": "..." }`，回更新後進度 |
| `POST /line-oa/{groupId}/message-jobs/{jobId}/resume` | body `{ "account": "..." }`，成功後重新讀進度 |

```json
{
  "account": "dispatcher@example.com",
  "requestId": "784d5f05-9849-4504-b30c-c4b30ccbc2a9",
  "chatIds": ["U69756d53f2f93d5faa2970ec1579303b", "Ua3fd4f5d9692f4d0acd59fdab3f6f075"],
  "excludedChatIds": [],
  "messages": [{ "type": "text", "text": "您好，這是本次通知。" }]
}
```

單人傳送讓 chatIds 只有一筆。每個 ID 都必須存在於同一官方帳號已同步的客戶清單。JSON 上限 8,000,000 bytes；requestId 最長 128 字，前端採 UUID。每個 account/groupId 每分鐘最多提交 10 次。新前端 messages 只放一筆，類型可選 text、image、coupon、cardType（優惠券及多頁訊息已完成後端開發，待部署驗收），圖片格式為 `{ "type": "image", "mediaId": "上傳回傳的 ID" }`；只送圖片時不加空文字。

圖片使用 [Tampermonkey 的 FormData 請求](https://www.tampermonkey.net/documentation.php?ext=d2&q=GM_xmlhttpRequest)，不手動指定 multipart Content-Type、不轉成 Base64。mediaId 綁定 account/groupId，上傳後 24 小時內可建立作業。上傳回應、換圖、移除、關閉視窗及帳號切換均檢查目前圖片身分，避免舊上傳覆蓋新圖。

尚未提交的圖片過期時，需重新上傳。提交結果不明則保留原 mediaId 與完整 body，關閉或重新整理後仍重試同一次作業，即使圖片已過期也不自動換圖。後端明確回 IMAGE_ASSET_EXPIRED／IMAGE_ASSET_NOT_FOUND 時，可直接重新上傳，再按「傳送」以新的 requestId 提交；不在背景自動重送。

```json
{
  "jobId": "6acff24aa84b208b8d4c6b6a",
  "status": "queued",
  "reused": false,
  "recipientCount": 2,
  "excludedCount": 0,
  "messageCount": 1,
  "totalDeliveries": 2,
  "statusUrl": "/line-oa/U69d7138b619cb66ce1e8b7e892d6dc8b/message-jobs/6acff24aa84b208b8d4c6b6a?account=dispatcher%40example.com"
}
```

jobId 是不透明字串，現為 24 碼 hex，不能按 UUID 驗證。相同 requestId 與內容回原 jobId、reused=true。statusUrl 僅接受相同後端、groupId、jobId、account 的路徑，否則改由已知資料組出查詢路徑。

進行中：queued、running、cancelling。waiting_credentials 需使用者更新 Cookie，再恢復。終態：completed、completed_with_errors、failed、needs_review、cancelled。counts 包含 total、pending、sending、sent、failed、unknown、cancelled，單位為「一位客戶的一則訊息」。

逐則結果 pagination 只有 currentPage、pageSize、totalItems，前端計算總頁數。結果使用 messageType，顯示發送次數 attempts、圖片上傳次數 uploadAttempts，以及有提供的 upstreamCode。支援既有錯誤及 IMAGE_ASSET_UNAVAILABLE、LINE_IMAGE_UPLOAD_FAILED；未知 code 顯示一般失敗提示。結果不明需人工確認，不自動重送。

### 錯誤處理

Content-Type 為 `application/problem+json`，依 code 判斷，顯示 detail：

```json
{ "status": 409, "title": "Conflict", "code": "LINE_COOKIE_MISSING", "detail": "請重新儲存登入 Cookie" }
```

| HTTP | code | 處理 |
| --- | --- | --- |
| 400 | INVALID_MESSAGE_JOB | 返回編輯內容或收件人 |
| 404 | 可沒有 code | 顯示 detail；無 detail 時提供一般帳號／配置提示 |
| 409 | LINE_COOKIE_MISSING | 點「身份授權」，重試同一次提交 |
| 409 | REQUEST_ID_CONFLICT | 顯示衝突，結果不明的原提交不得任意換 ID 重送 |
| 409 | MESSAGE_JOB_ALREADY_ENDED / MESSAGE_JOB_NOT_RESUMABLE | 顯示 detail 並重新讀進度 |
| 400 / 422 | INVALID_IMAGE_UPLOAD / UNSUPPORTED_IMAGE_TYPE | 顯示 detail，重新選擇有效圖片 |
| 413 | 可沒有 code | 縮小圖片後重新選取 |
| 404 / 409 | IMAGE_ASSET_NOT_FOUND / IMAGE_ASSET_EXPIRED | 返回編輯，重新上傳並使用新 requestId |
| 503 | IMAGE_STORAGE_UNAVAILABLE | 顯示 detail，手動重試；建立作業前的明確拒絕不算已入隊 |
| 422 | RECIPIENT_NOT_FOUND | 先同步客戶清單再選取 |
| 429 | MESSAGE_JOB_SUBMIT_TOO_OFTEN | 稍後手動重試，不自動連續提交 |
| 429 | SEND_KEY_TOO_MANY_ATTEMPTS | 同一來源 KEY 驗證失敗過多；確認 KEY 正確後稍候一分鐘再試 |

## 圖片實測：兩段式與 token 重用

2026-10-15 使用 Playwright、使用者登入的 LINE 網頁，完成一張 PNG 的實際傳送。選圖先出現確認視窗；按「傳送」後，依序出現下列兩筆請求，都回 HTTP 200，聊天室顯示圖片。

第一步，上傳圖片：

```http
POST https://chat.line.biz/api/v1/bots/{botId}/messages/{chatId}/uploadFile
Content-Type: multipart/form-data; boundary=...
```

表單只有 `file`，帶檔名及 MIME。本次 PNG 為 26,609 bytes。注意這個已實測的上傳路徑是 `messages/{chatId}/uploadFile`。

```json
{ "contentMessageToken": "<上傳回傳的圖片 token>" }
```

第二步，發送圖片：

```http
POST https://chat.line.biz/api/v1/bots/{botId}/chats/{chatId}/messages/bulkSendFiles
Content-Type: application/json
```

```json
{
  "items": [
    {
      "sendId": "{chatId}_{毫秒時間}_{8位隨機數}",
      "contentMessageToken": "<第一步回傳的同一個 token>"
    }
  ]
}
```

成功回應 `{}`。本次只有一張圖片、items 只有一筆，沒有測試多張。

### 同一個圖片 token 可否發給另一位客戶

本次沿用「已成功發送過」的 token，切換同一官方帳號的另一位客戶，換 chatId 與 sendId，直接做第二步、不重新上傳。透過網頁原本的請求元件送出後，回應 **HTTP 400**：

```json
{ "code": "invalid_content_message_token" }
```

第二位客戶未成功送出圖片。這次已使用網頁的 X-XSRF-TOKEN 及 client-version 標頭，不能把最初缺少相應標頭時的 HTTP 403 當作 token 重用結論。只憑這次實測，尚無法區分 token 是綁定 chatId、一次性，或已過期；已證實這顆使用過的 token 不能直接重用於本次另一位客戶。

目前群發實作應採：同一官方帳號共用登入 Cookie，後端可共用原始圖片檔案，但每位客戶各自上傳取得新 token，再立即發送。不要把一顆 contentMessageToken 當成全體收件人的圖片 ID。

後端圖片流程參考：

1. 接收並保存單張原始圖片，讓作業引用該檔案；圖片內容由後端檔案 ID 找到。
2. 每位收件人使用自己的 chatId 呼叫 uploadFile，取得新的 contentMessageToken。
3. 發送前將 token 與 sendId 存到該筆 delivery，再呼叫 bulkSendFiles。
4. 每筆保存成功、失敗或結果不明；發送逾時不可直接重送，也不可默默重傳新圖再送一次。
5. 前端選圖取得 mediaId，按「傳送」建立作業，以 toast 顯示進度及按需查詢結果。

### Python 文字與圖片發送程式

完整程式在 [`scripts/line_chat_send.py`](scripts/line_chat_send.py)，依賴 `requests`。單人測試指令如下；執行會實際發送一則文字：

```sh
python3 -m pip install requests
python3 scripts/line_chat_send.py \
  --url "https://chat.line.biz/U69d7138b619cb66ce1e8b7e892d6dc8b/chat/U69756d53f2f93d5faa2970ec1579303b" \
  --text "Python API 測試" \
  --cookie-file scripts/cookie.txt
```

後端 worker 使用同一個 `LineChatClient`，以資料庫帳號的 `extCookie` 建立連線；不需要把 Cookie 檔案放進後端部署，也不需要前端另傳 `X-XSRF-TOKEN`。以下函式可放在專案根目錄執行的 worker 中：

```python
from scripts.line_chat_send import LineChatClient


def send_text_delivery(*, group_id, ext_cookie, chat_id, text, send_id):
    client = LineChatClient(bot_id=group_id, cookie_header=ext_cookie)
    try:
        # send_id 必須在發送前保存到這筆 delivery。
        return client.send_text(chat_id, text, send_id=send_id)
    finally:
        client.session.close()
```

worker 的資料對應：

| Python 參數 | 來源 |
| --- | --- |
| `group_id` → `bot_id` | 作業路徑的 `groupId`，只使用同一個官方帳號 |
| `ext_cookie` → `cookie_header` | 以作業 `account` 查資料庫的 `extCookie` |
| `chat_id` | `chatIds` 中目前處理的客戶 |
| `text` | `messages` 中 type 為 text 的內容 |
| `send_id` | 每筆 delivery 發送前產生並保存：`{chatId}_{毫秒}_{8位隨機數}` |

`LineChatClient` 會解析 Cookie，只保留 `ses`、`__Host-chat-ses`、`XSRF-TOKEN`，把最後一項填入 `X-XSRF-TOKEN` 標頭，然後以 `requests.Session.request` 發出 POST 並傳送 JSON；逾時 15 秒、不跟隨重新導向、不自動重試；缺少 Cookie 在發送前即拒絕。`send_text` 未提供 `send_id` 時會自行產生，供單次命令列測試使用。

多人作業由 worker 逐一處理 `chatIds`，同一人依 `messages` 順序處理，每筆保存結果。成功回應 `{}` 也有效。遇到 401／403 先確認憑證狀態；逾時或中斷時標記結果不明，不自動重送。保存相同 `send_id` 方便追蹤，仍需後端唯一鍵與狀態控制來避免重複發送。

圖片也已補進 `LineChatClient`：

```python
# worker：兩步分開，方便在真正發送前保存該筆 delivery 的 token/sendId。
image_token = client.upload_image(chat_id, image_path)
# 此處由 worker 將 image_token 與 send_id 保存到資料庫。
result = client.send_uploaded_image(chat_id, image_token, send_id=send_id)

# 單次測試的便利方法，同樣只發一張：
# result = client.send_image(chat_id, image_path)
```

命令列選擇 `--text`、`--image`、`--coupon` 或 `--card-type` 其中一個；只讀列表可用 `--list-coupons` 或 `--list-card-types`：

```sh
python3 scripts/line_chat_send.py --url "https://chat.line.biz/{botId}/chat/{chatId}" \
  --image ./notice.png --cookie-file scripts/cookie.txt
```

Python 圖片程式依本次瀏覽器請求實作，模擬測試驗證兩步順序、token 傳遞、上傳失敗不發送、逾時不重試。**原始實發驗證來自瀏覽器，沒有另用 Python 再發一次。** 本次前端依後端提供的新契約接上圖片功能，以模擬後端驗證，未透過正式群發服務實際發送。

## 開發與打包

原始碼在 `src/`（ES module，依功能分檔；入口 `src/main.js`），以 Vite + vite-plugin-monkey 打包成單一 Tampermonkey 腳本。根目錄的 `uturn-line-ext.user.js` 是打包產物（`@updateURL` 指的就是它），**改 `src/` 後要 `npm run build` 再 commit 產物**，使用者端才會自動更新；不要直接改產物。

```sh
npm install
npm run dev     # 開發：開一次網址裝「代理腳本」到 Tampermonkey，之後改 src/ 存檔、重新整理 LINE 頁面即生效（不混淆）
npm run build   # 發版：dist/ → 複製成根目錄 uturn-line-ext.user.js（terser 壓縮＋改名）
npm run lint    # ESLint：未使用的變數／函式、未定義的名稱（含 GM_* 全域）
```

- 版本只改 `package.json` 的 `version`，打包時寫進標頭 `@version`，程式內一律用 `GM_info.script.version`。
- `==UserScript==` 標頭（`@match`／`@grant`／`@connect`／`@run-at document-start`…）在 `vite.config.mjs` 的 `userscript` 設定，不在原始碼裡。
- 產物以 terser 壓縮並改名（變數／函式名改成單字母、移除註解），標頭與介面文字維持原樣；要讀得懂的版本請看 `src/` 或 `npm run dev`。
- `npm run dev` 的代理腳本是從本機 dev server 以 ES module 動態載入，比 document-start 晚一點才執行；收件匣頁（`?uturnInbox=1`）整頁接管在 dev 模式下可能來不及攔住 LINE 的 SPA，驗收收件匣接管請用 `npm run build` 的產物。
- `src/` 分層：`core/`（常數、圖示、GM 儲存、pageContext、後端請求與身份授權、INBOX_MODE）、`line/`（LINE 後台 API：Cookie 擷取、限速抓取、同步、群發、優惠券／多頁訊息）、`inbox/`（收件匣：狀態與 API、對話與 SSE、送出、內容選擇、通知、各區塊 render、條款、boot、takeover）、`ui/`（toast、複製、回覆輸入框、訊息列按鈕）、`quick-reply/`（氣泡列與管理視窗），其餘一個功能一檔（`dispatch.js`、`driver-chat.js`、`board.js`、`scroll.js`…）。各模組載入時要掛的事件／計時器集中在該模組的 `init*()`，由 `main.js` 的 `uturnMain()` 依原本順序呼叫。

## 驗證方式

```sh
npm install
npm test        # 先 npm run build，再對產物跑 Playwright
npm run check
python3 -m unittest discover -s tests -p 'test_*.py'
```

測試使用隔離的 headless 瀏覽器與模擬後端，不讀真實 Cookie、不建立正式群發作業。有安裝 macOS Chrome 時使用其可執行檔；其他環境先執行 `npx playwright install chromium`。

涵蓋 Cookie 手動同步、全選所有分頁、multipart 圖片上傳、換圖與取消上傳、四種發送類型單選與隱藏草稿隔離、優惠券直式並排、多頁訊息游標分頁及內容摘要、連點防重複、同一視窗連續傳送、toast 收起、上傳錯誤與過期、提交逾時保留 mediaId 及 requestId、進度輪詢、恢復、取消、逐則圖片／優惠券／多頁訊息結果、內容失效重選、LINE_UNAVAILABLE 保留完整請求重試、帳號隔離與安全文字顯示。
