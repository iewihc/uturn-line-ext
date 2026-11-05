// 右下角 toast 提示。
/* ---------------------------------------------------------------------- *
 * Toast
 * ---------------------------------------------------------------------- */
function toast(msg, kind, durationMs) {
  const t = document.createElement("div");
  t.className = "loe-toast" + (kind ? " " + kind : "");
  t.textContent = msg;
  (document.querySelector(".loe-customers-dialog[open]") || document.body).appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, durationMs || 2200);
}

export { toast };
