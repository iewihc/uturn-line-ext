// 每則訊息旁的複製／轉發按鈕與地址連結化。
import { BUBBLE_CLASS, BUTTON_CLASS, TEXT_PAD_CLASS } from "../core/constants.js";
import { COPY_ICON } from "../core/icons.js";
import { addForwardButton } from "../forward.js";
import { copyText, flashCopied, getMessageText } from "./copy.js";

/* ---------------------------------------------------------------------- *
 * Per-message copy button + address linkify
 * ---------------------------------------------------------------------- */
function addCopyButton(chatBody, bubble) {
  // 熱路徑：enhanceChatBodies 只會送還沒掛 BUBBLE_CLASS / loe-nocopy 的泡泡進來；
  // 這裡每個分支都要把泡泡標記掉，之後的掃描才不會再碰它。
  if (!chatBody || !bubble) return;
  if (chatBody.querySelector(`.${BUTTON_CLASS}`)) {
    bubble.classList.add("loe-nocopy"); // 同一則已有按鈕（多個 .chat-item 時只掛第一個）
    return;
  }
  const textNode =
    chatBody.querySelector("[data-copy-target].chat-item-text") ||
    chatBody.querySelector(".chat-item-text");
  // 位置訊息（LINE location）：沒有 .chat-item-text，地址在 .chat-item-loc .small
  const locNode = textNode ? null : bubble.querySelector(".chat-item-loc .small");
  const srcNode = textNode || locNode;
  if (!srcNode) {
    bubble.classList.add("loe-nocopy"); // 圖片／貼圖等無文字訊息：標記後不再重掃
    return;
  }
  addForwardButton(bubble, srcNode);
  bubble.classList.add(BUBBLE_CLASS);
  if (textNode) textNode.classList.add(TEXT_PAD_CLASS); // 預留右側空間，固定顯示的按鈕不會蓋到文字
  else bubble.classList.add("loe-loc-pad");            // 位置訊息：泡泡右側留白，按鈕不蓋住箭頭
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.innerHTML = COPY_ICON;
  button.setAttribute("aria-label", "複製這則訊息");
  button.setAttribute("data-loe-tip", "複製");
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const ok = await copyText(getMessageText(chatBody));
      flashCopied(button, ok);
    } catch (_) {
      flashCopied(button, false);
    }
  });
  bubble.appendChild(button);
}
function enhanceChatBodies(root = document) {
  // 熱路徑：LINE 每次改 DOM 都會跑到這裡。只選「還沒處理過」的泡泡
  //（處理完掛 BUBBLE_CLASS、無文字掛 loe-nocopy），幾百則舊訊息不再每幀逐一 querySelector。
  // 標記掛在 .chat-item 而非 .chat-body：LINE 就地換掉泡泡內容時新泡泡沒有標記，會被重新處理。
  root
    .querySelectorAll(`.chat-body .chat-item:not(.${BUBBLE_CLASS}):not(.loe-nocopy)`)
    .forEach((bubble) => addCopyButton(bubble.closest(".chat-body"), bubble));
}

export { enhanceChatBodies };
