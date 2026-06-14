// ==UserScript==
// @name         LINE Official Chat Bubble Copy
// @namespace    https://line-official-ext.local/
// @version      1.4.1
// @description  Add copy, address map links, and quick replies to LINE Official Account chat.
// @author       line-official-ext
// @match        https://manager.line.biz/*
// @match        https://chat.line.biz/*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const BUBBLE_CLASS = "loe-copy-bubble";
  const BUTTON_CLASS = "loe-copy-button";
  const TEXT_PAD_CLASS = "loe-copy-text-pad";
  const ICON_CLASS = "loe-copy-icon";
  const COPIED_CLASS = "loe-copy-copied";
  const MAP_LINK_CLASS = "loe-map-link";
  const QUICK_BUTTON_CLASS = "loe-quick-reply-button";
  const QUICK_MENU_CLASS = "loe-quick-reply-menu";
  const QUICK_SUBMENU_CLASS = "loe-quick-reply-submenu";
  const QUICK_MENU_OPEN_CLASS = "loe-quick-reply-open";

  const QUICK_REPLY_GROUPS = [
    {
      name: "車來了",
      replies: [
        {
          name: "請快速上車喔",
          text: "請快速上車喔",
        },
      ],
    },
  ];

  const ADDRESS_PATTERN =
    /((?:(?:(?:台|臺)北|新北|桃園|(?:台|臺)中|(?:台|臺)南|高雄|基隆|新竹|嘉義|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|(?:台|臺)東|澎湖|金門|連江)[縣市])?(?:[\u4e00-\u9fff]{1,8}[鄉鎮市區])?[\u4e00-\u9fff]{1,14}(?:路|街|大道)(?:[一二三四五六七八九十\d]+段)?(?:\d+巷)?(?:\d+弄)?\d+(?:-\d+)?號(?:\d+樓)?)/g;

  const COPY_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="${ICON_CLASS}">
      <rect x="9" y="9" width="10" height="10" rx="2"></rect>
      <path d="M5 15V7a2 2 0 0 1 2-2h8"></path>
    </svg>
  `;
  const CHECK_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="${ICON_CLASS}">
      <path d="m20 6-11 11-5-5"></path>
    </svg>
  `;
  const ERROR_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="${ICON_CLASS}">
      <path d="M18 6 6 18"></path>
      <path d="m6 6 12 12"></path>
    </svg>
  `;
  const DOCUMENT_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <path d="M14 2v6h6"></path>
      <path d="M8 13h8"></path>
      <path d="M8 17h6"></path>
    </svg>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .${BUBBLE_CLASS} {
      position: relative !important;
    }

    .${TEXT_PAD_CLASS} {
      padding-right: 30px !important;
    }

    .${BUTTON_CLASS} {
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid rgba(100, 116, 139, 0.24);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.72);
      color: #64748b;
      cursor: pointer;
      opacity: 0.72;
      user-select: none;
      backdrop-filter: blur(3px);
    }

    .${BUTTON_CLASS}:hover,
    .${BUTTON_CLASS}:focus-visible {
      border-color: rgba(100, 116, 139, 0.48);
      background: rgba(255, 255, 255, 0.94);
      color: #334155;
      opacity: 1;
      outline: none;
    }

    .${ICON_CLASS} {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .${BUTTON_CLASS}.${COPIED_CLASS} {
      border-color: rgba(6, 199, 85, 0.48);
      color: #06c755;
      opacity: 1;
    }

    .${MAP_LINK_CLASS} {
      color: #0b57d0;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .${QUICK_BUTTON_CLASS} {
      position: relative;
      display: inline-flex;
      align-items: center;
      color: #17a2b8;
    }

    .${QUICK_BUTTON_CLASS} > svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .${QUICK_MENU_CLASS},
    .${QUICK_SUBMENU_CLASS} {
      position: absolute;
      z-index: 2147483647;
      display: none;
      min-width: 180px;
      padding: 6px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
    }

    .${QUICK_MENU_CLASS} {
      left: 0;
      bottom: 100%;
      margin-bottom: 8px;
    }

    .${QUICK_BUTTON_CLASS}.${QUICK_MENU_OPEN_CLASS} .${QUICK_MENU_CLASS},
    .${QUICK_MENU_CLASS} li:hover > .${QUICK_SUBMENU_CLASS},
    .${QUICK_MENU_CLASS} li:focus-within > .${QUICK_SUBMENU_CLASS} {
      display: block;
    }

    .${QUICK_MENU_CLASS} ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .${QUICK_MENU_CLASS} li {
      position: relative;
      margin: 0;
      padding: 0;
    }

    .${QUICK_MENU_CLASS} button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 12px;
      padding: 8px 10px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #1f2937;
      font: inherit;
      font-size: 13px;
      line-height: 1.35;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
    }

    .${QUICK_MENU_CLASS} button:hover,
    .${QUICK_MENU_CLASS} button:focus-visible {
      background: #eef7f9;
      color: #0f766e;
      outline: none;
    }

    .${QUICK_SUBMENU_CLASS} {
      left: 100%;
      bottom: auto;
      top: 0;
      margin-left: 6px;
    }
  `;
  document.head.appendChild(style);

  function getMessageText(chatBody) {
    const textNode =
      chatBody.querySelector("[data-copy-target].chat-item-text") ||
      chatBody.querySelector(".chat-item-text");

    return textNode ? textNode.innerText.trim() : "";
  }

  async function copyText(text) {
    if (!text) return false;

    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text, "text");
      return true;
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  }

  function flashCopied(button, ok) {
    button.innerHTML = ok ? CHECK_ICON : ERROR_ICON;
    button.title = ok ? "已複製" : "複製失敗";
    button.classList.toggle(COPIED_CLASS, ok);

    window.setTimeout(() => {
      button.innerHTML = COPY_ICON;
      button.title = "複製這則訊息";
      button.classList.remove(COPIED_CLASS);
    }, 1000);
  }

  function createMapLink(address) {
    const link = document.createElement("a");
    link.className = MAP_LINK_CLASS;
    link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = address;
    link.title = "在 Google Maps 開啟";

    link.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    return link;
  }

  function linkifyAddressTextNode(textNode) {
    const text = textNode.nodeValue;
    ADDRESS_PATTERN.lastIndex = 0;
    if (!text || !ADDRESS_PATTERN.test(text)) return;

    ADDRESS_PATTERN.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = ADDRESS_PATTERN.exec(text)) !== null) {
      const address = match[0];

      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      fragment.appendChild(createMapLink(address));

      lastIndex = match.index + address.length;
    }

    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));

    const parent = textNode.parentNode;
    if (!parent || !textNode.isConnected || textNode.parentNode !== parent) return;
    if (!Array.prototype.includes.call(parent.childNodes, textNode)) return;

    try {
      parent.replaceChild(fragment, textNode);
    } catch (error) {
      if (error?.name !== "NotFoundError") throw error;
    }
  }

  function linkifyAddresses(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`a, button, script, style, textarea, input, .${MAP_LINK_CLASS}`)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach(linkifyAddressTextNode);
  }

  function getReplyTextarea() {
    return (
      document.querySelector('textarea[part="input"].input') ||
      document.querySelector('textarea[part="input"]') ||
      document.querySelector("textarea.input") ||
      document.querySelector("textarea")
    );
  }

  function fillReplyTextarea(text) {
    const textarea = getReplyTextarea();
    if (!textarea) return false;

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (valueSetter) {
      valueSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(text.length, text.length);
    return true;
  }

  function closeQuickReplyMenus(exceptButton) {
    document.querySelectorAll(`.${QUICK_BUTTON_CLASS}.${QUICK_MENU_OPEN_CLASS}`).forEach((button) => {
      if (button !== exceptButton) {
        button.classList.remove(QUICK_MENU_OPEN_CLASS);
        button.setAttribute("aria-expanded", "false");
      }
    });
  }

  function createQuickReplyMenu(button) {
    const menu = document.createElement("div");
    menu.className = QUICK_MENU_CLASS;
    menu.setAttribute("role", "menu");
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const groupList = document.createElement("ul");

    QUICK_REPLY_GROUPS.forEach((group) => {
      const groupItem = document.createElement("li");
      const groupButton = document.createElement("button");
      groupButton.type = "button";
      groupButton.setAttribute("role", "menuitem");
      groupButton.textContent = group.name;

      const arrow = document.createElement("span");
      arrow.textContent = ">";
      groupButton.appendChild(arrow);

      const replyMenu = document.createElement("div");
      replyMenu.className = QUICK_SUBMENU_CLASS;
      replyMenu.setAttribute("role", "menu");

      const replyList = document.createElement("ul");
      group.replies.forEach((reply) => {
        const replyItem = document.createElement("li");
        const replyButton = document.createElement("button");
        replyButton.type = "button";
        replyButton.setAttribute("role", "menuitem");
        replyButton.textContent = reply.name;
        replyButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          fillReplyTextarea(reply.text);
          closeQuickReplyMenus();
        });

        replyItem.appendChild(replyButton);
        replyList.appendChild(replyItem);
      });

      replyMenu.appendChild(replyList);
      groupItem.appendChild(groupButton);
      groupItem.appendChild(replyMenu);
      groupList.appendChild(groupItem);
    });

    menu.appendChild(groupList);
    button.appendChild(menu);
  }

  function addQuickReplyButton(phoneLink) {
    if (!phoneLink || phoneLink.parentElement.querySelector(`.${QUICK_BUTTON_CLASS}`)) return;

    const button = document.createElement("a");
    button.href = "#";
    button.role = "button";
    button.className = `text-info mr-2 ${QUICK_BUTTON_CLASS}`;
    button.setAttribute("aria-label", "快速回覆");
    button.setAttribute("aria-expanded", "false");
    button.title = "快速回覆";
    button.innerHTML = DOCUMENT_ICON;

    createQuickReplyMenu(button);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const willOpen = !button.classList.contains(QUICK_MENU_OPEN_CLASS);
      closeQuickReplyMenus(button);
      button.classList.toggle(QUICK_MENU_OPEN_CLASS, willOpen);
      button.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    phoneLink.insertAdjacentElement("afterend", button);
  }

  function enhanceQuickReplyToolbars(root = document) {
    root.querySelectorAll("i.lar.la-chat-phone.la-fw.la-lg").forEach((icon) => {
      addQuickReplyButton(icon.closest("a"));
    });
  }

  function addCopyButton(chatBody) {
    const bubble = chatBody.querySelector(".chat-item");
    const textNode =
      chatBody.querySelector("[data-copy-target].chat-item-text") ||
      chatBody.querySelector(".chat-item-text");
    if (!bubble || !textNode) return;

    linkifyAddresses(textNode);
    if (chatBody.querySelector(`.${BUTTON_CLASS}`)) return;

    bubble.classList.add(BUBBLE_CLASS);
    textNode.classList.add(TEXT_PAD_CLASS);

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.innerHTML = COPY_ICON;
    button.setAttribute("aria-label", "複製這則訊息");
    button.title = "複製這則訊息";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        const ok = await copyText(getMessageText(chatBody));
        flashCopied(button, ok);
      } catch (_error) {
        flashCopied(button, false);
      }
    });

    bubble.appendChild(button);
  }

  function enhanceChatBodies(root = document) {
    root.querySelectorAll(".chat-body").forEach(addCopyButton);
  }

  enhanceChatBodies();
  enhanceQuickReplyToolbars();

  document.addEventListener("click", () => {
    closeQuickReplyMenus();
  });

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const chatBody = mutation.target.parentElement?.closest(".chat-body");
        if (chatBody) addCopyButton(chatBody);
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node instanceof Text) {
          const chatBody = node.parentElement?.closest(".chat-body");
          if (chatBody) addCopyButton(chatBody);
          continue;
        }

        if (!(node instanceof Element)) continue;

        if (node.matches(".chat-body")) {
          addCopyButton(node);
        } else {
          enhanceChatBodies(node);
        }

        if (node.matches("i.lar.la-chat-phone.la-fw.la-lg")) {
          addQuickReplyButton(node.closest("a"));
        } else {
          enhanceQuickReplyToolbars(node);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();
