# uturn-line-ext

優惠券及多頁訊息已依後端完成版契約接上：同源讀清單、提交數字 ID、失效後重新選擇、授權恢復，以及保留原 requestId 重試。**依後端提供的進度，程式與單元測試已完成，但尚未部署及對真實 LINE 驗收。** 本次前端以模擬後端驗證，沒有部署後端或實發群發。原生格式與 Python 參考見[優惠券規格](docs/line-coupon-backend-spec.md)及[多頁訊息規格](docs/line-card-type-backend-spec.md)。

Tampermonkey userscript：`uturn-line-ext.user.js`。版本 **1.45.0** 已對齊發送 KEY 與過濾名單完成版契約：顯示後端實際收件人數及過濾名單人數、依後端紀錄處理舊作業、保留恢復失敗的提示。延續 v1.44.0 的「群發訊息 - 懶惰蟲」視窗、隱藏識別碼、選單圖示及「身份授權」名稱；腳本不輸出 Console 訊息。

必填「過濾名單（不發送）」與「發送 KEY」已串接；依後端提供的進度，**後端已完成、測試通過，但尚未部署**。先部署後端，再發布目前的 v1.45.0；後端部署後，沒有 KEY 的舊版會收到 `401 SEND_KEY_MISSING`。完整契約見 [過濾名單與發送 KEY 串接文件](docs/line-send-access-backend-spec.md)。前端不自行判斷 KEY 是否有效，也不推算到期日。

發送類型仍以一整排單選「文字／圖片／優惠券／多頁訊息」，只顯示目前類型的編輯區，按「傳送」只提交該類型，以簡易 toast 顯示進度及結果，可在同一視窗連續編輯下一則訊息。

後端已提供圖片功能，現行契約見 [OpenAPI](docs/line-messages.openapi.json)。[圖片規格與 Python 範例](docs/line-image-only-spec.md)保留 LINE 兩段式請求與後端 Python 參考；前端只使用後端的 mediaId。

## 進階功能

工具列顯示有齒輪圖示的「進階功能」，點開後有以下三個附圖示的選單項目。可點外面或按 Esc 關閉，也可用方向鍵選取。

| 按鈕 | 行為 | 後端端點 |
| --- | --- | --- |
| 身份授權 | 手動擷取必要 Cookie，更新設定中後台帳號的 extCookie | `PUT /line-ext-cookie?account={account}` |
| 同步客戶 | 完整讀完目前官方帳號所有分頁，再上傳名稱、chatId、頭像網址 | `POST /line-oa/{groupId}/customers` |
| 群發訊息 | 搜尋、單選、多選、全選所有人、直接傳送、toast 進度通知 | `GET /line-oa/{groupId}/customers` |

基底：`https://right.mr-chi-tech.com`。`account` 來自轉發設定的「UTurn 後台帳號」；`groupId` 是目前 LINE 官方帳號網址中的第一個 U ID，須與配置中的官方帳號 GroupId 一致。

Cookie 僅由手動點「身份授權」擷取，不在載入或切換對話時讀取，不寫入 GM 設定或 localStorage、不列印至 Console。必要欄位為 `ses`、`__Host-chat-ses`、`XSRF-TOKEN`；缺少時不覆寫後端。Tampermonkey 須設定 Advanced → Security → Allow scripts to access cookies: All。

名單初始化維持讀取，但不輸出 Console。上傳後端需手動點「同步客戶」。視窗內的同名按鈕放在客戶列表上方，會完整讀取 LINE、同步後端，再刷新列表；進行中禁止重複同步與傳送，保留草稿、勾選及過濾設定。分頁失敗、官方帳號切換、完整名單超過 8,000,000 bytes 時不傳部分名單。空清單依後端規則保留舊資料；同步或刷新失敗會在畫面提示，不要求使用者查看 Console。

## 客戶選取與傳送

- 一次只針對同一官方帳號，選一位或多位客戶。
- 過濾名單至少一位；從客戶旁點「過濾」或貼上後台提供的名單。貼上欄位以密碼遮罩顯示，支援多行貼上；重複對象合併，格式錯誤時整批不加入。無名稱時顯示「未命名客戶」，不以 ID 當名稱或滑鼠提示。已貼上但尚未加入的內容也會阻擋傳送。
- 全選、搜尋、翻頁都保留過濾設定，顯示「已選 − 過濾 = 實際發送」；全被過濾時不能送。文字、圖片、優惠券、多頁訊息均使用扣除後的同一套收件人規則。
- 發送 KEY 使用遮罩輸入，可切換顯示；只放在本次視窗，關閉、重整或切換帳號後重填，不存 GM／localStorage／sessionStorage 或 Console。KEY 以 `X-Line-Send-Key` header 隨建立及恢復請求傳送；後端需驗證效期、撤銷與帳號範圍。
- 重試固定沿用原本收件人及 `excludedChatIds`，KEY header 可更換，不改原 requestId/body。缺 KEY 時不能重試或恢復，但仍能查看進度和取消。
- KEY 由後台發放，固定一個月到期。建立及進度回應的 `recipientCount` 是實際收件人數；`excludedCount` 是過濾名單去重筆數，不是這次實際扣除人數。後端回 0 表示舊作業，不可恢復；若後端已有非空快照，恢復不要求本機保有 ID 名單。
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

每次按「傳送」產生 UUID `requestId`；提交前保存原始內容與 ID，連點只提交一次。逾時、網路錯誤、5xx 或無法解析成功回應時，提供「重試同一次傳送」，完整沿用原始內容與 requestId。傳送中或提交結果未確認時，暫時鎖定編輯；首次提交若明確被拒絕，可直接修改再送，不需要返回編輯的額外步驟。已接受後保存目前作業參考、進度及過濾快照，不保留待提交的文字及收件陣列。這些狀態依 account/groupId 存在本機設定，沒有 Cookie 或發送 KEY。升級前缺少過濾快照的舊作業不可直接重試或恢復，需先確認舊作業結果。

## 後端契約（優惠券、多頁訊息已完成開發，待部署驗收）

- [OpenAPI 3.1](docs/line-messages.openapi.json)
- [多人文字請求範例](docs/line-message-job.example.json)
- [多頁訊息後端規格與 Python 範例](docs/line-card-type-backend-spec.md)
- [多頁訊息群發 JSON](docs/line-card-type-message-job.example.json)
- [多頁訊息列表／發送格式紀錄](docs/line-card-type-browser-evidence.json)
- [Python 文字、圖片、優惠券及多頁訊息發送參考](scripts/line_chat_send.py)

以下為已完成、待部署的契約；[OpenAPI](docs/line-messages.openapi.json) 已同步。只有建立與恢復帶 `X-Line-Send-Key`，建立 body 必填 `excludedChatIds`；上傳原圖、進度、逐則結果和取消不帶 KEY。前端不附 Bearer Authorization，不額外傳 Cookie。

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
  "excludedChatIds": ["U00000000000000000000000000000001"],
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
  "excludedCount": 1,
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

## 驗證方式

```sh
npm install
npm run check
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

測試使用隔離的 headless 瀏覽器與模擬後端，不讀真實 Cookie、不建立正式群發作業。有安裝 macOS Chrome 時使用其可執行檔；其他環境先執行 `npx playwright install chromium`。

涵蓋 Cookie 手動同步、全選所有分頁、multipart 圖片上傳、換圖與取消上傳、四種發送類型單選與隱藏草稿隔離、優惠券直式並排、多頁訊息游標分頁及內容摘要、連點防重複、同一視窗連續傳送、toast 收起、上傳錯誤與過期、提交逾時保留 mediaId 及 requestId、進度輪詢、恢復、取消、逐則圖片／優惠券／多頁訊息結果、內容失效重選、LINE_UNAVAILABLE 保留完整請求重試、帳號隔離與安全文字顯示。
