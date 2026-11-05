// 收件匣使用條款：首次開啟須同意，依後台帳號記錄版本與時間。
import { storeGet, storeSet } from "../core/store.js";
import { bootInbox } from "./boot.js";
import { INBOX_TERMS_KEY_PREFIX, INBOX_TERMS_VERSION, ih } from "./core.js";
import { getDispatcher } from "../settings.js";

function inboxTermsKey(account) {
  return INBOX_TERMS_KEY_PREFIX + encodeURIComponent(account);
}
function hasAcceptedInboxTerms(account = getDispatcher()) {
  const consent = storeGet(inboxTermsKey(account), null);
  return consent?.version === INBOX_TERMS_VERSION && consent.account === account &&
    Number.isFinite(consent.acceptedAt) && consent.acceptedAt > 0;
}
function showInboxTerms(root) {
  if (document.querySelector(".loe-inbox-terms")) return;
  // 啟動前就擋住：未同意不綁操作、不讀取帳號／對話、不啟動輪詢或身份授權。
  root.inert = true;
  const account = getDispatcher();
  const dialog = ih("dialog", { class: "loe-inbox-terms", "aria-labelledby": "loe-inbox-terms-title" });
  // 以下只含經確認的固定條款文字，不插入任何帳號或外部資料。
  dialog.innerHTML = `
      <header class="loe-inbox-terms-head">
        <h1 id="loe-inbox-terms-title" tabindex="-1">懶惰蟲收件匣版本（UTurn 收件匣）使用條款</h1>
        <p>請詳閱以下條款，勾選「我同意」後再繼續使用。</p>
      </header>
      <article class="loe-inbox-terms-body" tabindex="0" aria-label="使用條款全文">
        <p>本服務由懶惰蟲提供，包含收件匣、訊息管理、派單、訂單追蹤、自動通知及其他相關輔助功能。使用者應詳閱本條款，確認理解並同意後再啟用服務。代表車隊申請或同意本條款者，應具備代表該車隊營運主體的合法授權。</p>
        <section>
          <h2>1. 使用授權與保密義務</h2>
          <p>本服務為 U-TURN 投入開發及維護資源所提供之工具，僅限經授權之使用者及車隊，於約定業務範圍內使用，不得擅自轉售、轉授權、出借或提供予未經授權之第三人。</p>
          <p>未經 U-TURN 事前書面同意，不得向競爭對手揭露、展示或提供本服務之非公開資訊。競爭對手包括從事相同或類似車隊管理、叫車、派單、調度或相關軟體服務之公司、團隊及個人開發者。</p>
          <p><mark class="loe-inbox-terms-highlight">禁止提供的內容</mark>包括非公開操作畫面、功能流程、安裝檔案、安裝及更新連結、教學文件、原始碼、系統設定、授權資料、技術細節，以及本條款中尚未公開之內容。揭露方式包括截圖、錄影、直播、遠端操控、螢幕分享、現場展示、文章、訊息轉傳及其他足以使第三人取得資訊之方式。</p>
          <p>車隊應將接觸權限限於業務所需人員，並確保其知悉及遵守保密要求。依法必須揭露、向主管機關申訴或檢舉、為維護合法權益提出證據，或向負有保密義務之律師等專業顧問諮詢所必要之揭露，不受本條限制。已合法公開且非因違約而公開之資訊，亦不在保密範圍內。</p>
        </section>
        <section>
          <h2>2. 違約處理及違約金</h2>
          <p>使用者<mark class="loe-inbox-terms-highlight">違反前條保密或使用授權義務</mark>，經 U-TURN 依合法取得之截圖、錄影、操作紀錄、往來訊息或其他證據查證，且具有可歸責事由者，應依約支付<mark class="loe-inbox-terms-highlight">新臺幣十萬元違約金</mark>。責任由締約之個人或車隊營運主體，依其可歸責事由及法律規定承擔。</p>
          <p>U-TURN 得依違約情節，暫停本服務、撤銷使用授權，或終止與違約行為相關之 U-TURN 後台帳號使用權限。</p>
          <p>檢舉或截圖可作為調查依據，但不單憑檢舉即認定違約。U-TURN 應告知違約事由，並提供合理說明機會。</p>
          <p>保密義務不因停止使用、帳號停權或契約終止而當然消滅。</p>
        </section>
        <section>
          <h2>3. 服務用途與功能限制</h2>
          <p>本服務以 LINE 官方帳號客服及車隊調度作業為主要使用情境，透過整合多個官方帳號的訊息與操作介面，減少重複開啟完整頁面的需求，協助使用者在有限電腦資源下處理更多工作。</p>
          <p>實際效能及可同時管理的帳號數量，仍受電腦規格、瀏覽器、網路、對話量及 LINE 平台限制影響，不保證特定記憶體用量、開啟數量或處理速度。</p>
        </section>
        <section>
          <h2>4. 派單、訂單追蹤與自動通知</h2>
          <p>欲使用本服務提供之訂單追蹤及自動通知，原則上應透過懶惰蟲完成派單，並成功建立訂單與客戶聊天室的關聯。</p>
          <p>經手機、Discord（DC）或其他管道建立之訂單，如未成功建立上述關聯，可能無法顯示對應訂單、追蹤狀態或傳送自動通知。系統另有支援之客叫、AI 叫車等訂單，則依實際關聯結果及可用功能處理。</p>
          <p>「派單後自動回覆」與「司機承接、抵達等系統自動通知」為不同設定。派單成功不代表所有通知均已啟用或送達；使用者應確認設定、訂單狀態及通知結果。</p>
          <p>使用者仍應核對乘客、上車地址、時間、派單群組及承接情形。遇有訊息延遲、通知失敗或狀態異常時，應透過人工方式確認，避免影響乘客接送。</p>
        </section>
        <section>
          <h2>5. 身份授權、帳號及資料使用</h2>
          <p>使用者須具有相關 LINE 官方帳號及 U-TURN 後台帳號之合法操作權限，並依服務要求完成身份授權，不得冒用他人帳號或提供不實資料。</p>
          <p>本服務會依啟用功能處理必要的客戶、聊天室、訊息及訂單資料；執行「同步客戶與記事本」時，會將相關客戶資料與記事本內容傳送至 U-TURN 後端。使用者應確保資料之蒐集、提供及利用具有合法依據，並完成必要告知。</p>
          <p>U-TURN 應於提供服務所必要之範圍內處理資料，採取適當保護措施，並依法履行其個人資料保護責任。資料保存期限、利用範圍及刪除申請方式，應另行向使用者清楚告知。</p>
        </section>
        <section>
          <h2>6. 訊息發送與 LINE 平台風險</h2>
          <p>本服務為第三方輔助工具，使用者完成 U-TURN 身份授權，不代表取得 LINE 對本工具或其操作方式的認可。使用者仍須遵守 LINE 適用條款，不得濫發、騷擾、違法蒐集資料或以其他不當方式使用服務。</p>
          <p>依 LINE 目前公告，單一官方帳號於一小時內，透過後台一對一聊天向<strong>超過 200 個不同聊天室（用戶）</strong>發送訊息，會觸發一對一聊天功能的暫時限制。此處計算的是不同聊天室，並非訊息則數；其他限制及恢復時間仍以 LINE 實際規則為準。<a href="https://tw.linebiz.com/faq/oa-chat/chattinglimit/" target="_blank" rel="noopener noreferrer">LINE 官方說明</a></p>
          <p>本服務提供的分批傳送、發送間隔或限速設定，僅用於協助控管操作量，不保證免於限制或停權。人工回覆、自動通知、群發及其他工具對同一帳號的使用，均可能影響平台判斷。</p>
          <p>使用者應自行評估營運需求及可承受風險。違反平台規則或觸發風控，可能導致訊息發送受限、功能暫停或官方帳號遭停用；U-TURN 無法承諾解除 LINE 所採取的限制。也沒有賠償義務。<a href="https://terms2.line.me/official_account_terms_tw?lang=zh-Hant" target="_blank" rel="noopener noreferrer">LINE 官方帳號使用條款</a></p>
        </section>
        <section>
          <h2>7. 服務中斷、更新與責任範圍</h2>
          <p>本服務依賴 LINE、瀏覽器、擴充套件、網路及相關後端服務運作。上述服務發生改版、故障、政策調整、登入失效或連線限制時，本服務可能部分或全部無法使用，並可能需要等待更新、重新授權或調整功能。</p>
          <p>U-TURN 將於合理可行範圍內處理問題並說明服務狀態，但不保證第三方異動後一定能恢復原功能，或於固定期限內完成修復。使用者應保留必要的人工客服、調度及聯絡方式。</p>
          <p>因使用者錯誤設定、未經授權操作、違法發送，或不可歸責於 U-TURN 的第三方服務異常所生損害，依實際原因、雙方可歸責程度及適用法律認定責任。</p>
          <p>本條款不免除 U-TURN 因故意、重大過失或其他依法不得免除之責任，亦不排除使用者依法享有之權利。</p>
        </section>
        <section>
          <h2>8. 條款變更與同意</h2>
          <p>U-TURN 調整本條款時，應告知變更內容及生效日期。涉及新增資料用途、費用或重大權利義務變更者，應依法取得必要同意。</p>
          <p>使用者確認已理解本服務之功能限制、授權及資料處理方式、保密義務、違約責任與 LINE 平台風險後，始得同意啟用。</p>
        </section>
      </article>
      <footer class="loe-inbox-terms-foot">
        <label class="loe-inbox-terms-agree"><input type="checkbox" data-terms="agree">我同意</label>
        <p class="loe-inbox-terms-error" role="alert" hidden></p>
        <div class="loe-inbox-terms-actions">
          <a class="loe-inbox-btn" href="https://chat.line.biz/">返回 LINE 後台</a>
          <button class="loe-inbox-btn primary" type="button" data-terms="continue" disabled>繼續使用</button>
        </div>
      </footer>`;
  const checkbox = dialog.querySelector('[data-terms="agree"]');
  const next = dialog.querySelector('[data-terms="continue"]');
  checkbox.addEventListener("change", () => { next.disabled = !checkbox.checked; });
  dialog.addEventListener("cancel", (event) => event.preventDefault()); // Esc 不代表同意，不能關閉後操作收件匣
  next.addEventListener("click", () => {
    if (!checkbox.checked || next.disabled) return;
    if (getDispatcher() !== account) { // 讀條款期間在別的分頁切換後台帳號，重新確認目前帳號
      dialog.close();
      dialog.remove();
      bootInbox();
      return;
    }
    storeSet(inboxTermsKey(account), { version: INBOX_TERMS_VERSION, account, acceptedAt: Date.now() });
    if (!hasAcceptedInboxTerms(account)) {
      const error = dialog.querySelector(".loe-inbox-terms-error");
      error.textContent = "無法儲存同意紀錄，請確認瀏覽器允許儲存資料後再試。";
      error.hidden = false;
      return;
    }
    dialog.close();
    dialog.remove();
    bootInbox();
  });
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector("h1").focus();
}

export { hasAcceptedInboxTerms, showInboxTerms };
