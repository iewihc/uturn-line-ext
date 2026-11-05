// LINE 回覆輸入框（自訂 <textarea-ex>，含 shadow DOM）的讀寫。
/* ---------------------------------------------------------------------- *
 * Reply input (custom <textarea-ex> with shadow DOM)
 * ---------------------------------------------------------------------- */
function getEditorHost() {
  return (
    document.querySelector("textarea-ex#editor") ||
    document.querySelector("textarea-ex")
  );
}
function fillReplyTextarea(text, replace = false) {
  const host = getEditorHost();
  const inner =
    host && host.shadowRoot && host.shadowRoot.querySelector("textarea");
  if (inner) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set;
    let next, pos;
    if (replace) {
      next = text;
      pos = text.length;
    } else {
      const start = inner.selectionStart ?? inner.value.length;
      const end = inner.selectionEnd ?? inner.value.length;
      next = inner.value.slice(0, start) + text + inner.value.slice(end);
      pos = start + text.length;
    }
    setter.call(inner, next);
    inner.dispatchEvent(
      new Event("input", { bubbles: true, composed: true }),
    );
    inner.dispatchEvent(
      new Event("change", { bubbles: true, composed: true }),
    );
    inner.focus();
    try {
      inner.setSelectionRange(pos, pos);
    } catch (_) {}
    return true;
  }
  // Fallback: plain textarea
  const ta =
    document.querySelector('textarea[part="input"].input') ||
    document.querySelector('textarea[part="input"]') ||
    document.querySelector("textarea.input") ||
    document.querySelector("textarea");
  if (!ta) return false;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  ).set;
  const next = replace ? text : ta.value + text;
  setter ? setter.call(ta, next) : (ta.value = next);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.dispatchEvent(new Event("change", { bubbles: true }));
  ta.focus();
  return true;
}

export { fillReplyTextarea, getEditorHost };
