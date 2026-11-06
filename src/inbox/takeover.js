// 收件匣頁面骨架：document-start 停掉 LINE 的載入並整頁換成收件匣的 HTML 與樣式。
import { ic } from "../core/icons.js";
/* ---------------------------------------------------------------------- *
 * 收件匣頁面骨架：document-start 就停掉 LINE 的載入並整頁換掉。
 *   只放版面與樣式；資料與互動都在 uturnMain 裡的 bootInbox()。
 *   共用樣式（.loe-toast、.loe-qr-bar、.loe-qr-chip）由 uturnMain 的 <style> 提供。
 * ---------------------------------------------------------------------- */
function inboxTakeover() {
  try { window.stop(); } catch (_) {}
  document.documentElement.innerHTML = `
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UTurn 收件匣</title>
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.5 "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif; color: #1f2937; background: #f3f5f9; }
  button, input, textarea { font: inherit; }
  a { color: #1c6cf3; }
  .loe-inbox { position: relative; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .loe-inbox [hidden] { display: none !important; }
  .loe-inbox-top { flex: 0 0 auto; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; min-height: 56px; padding: 6px 20px; background: #fff; border-bottom: 1px solid #e3e7ee; }
  .loe-inbox-brand { display: flex; align-items: center; gap: 10px; }
  .loe-inbox-brand strong { font-size: 16px; }
  .loe-inbox-logo { width: 28px; height: 28px; border-radius: 8px; background: #1c6cf3; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-logo svg, .loe-inbox-btn svg, .loe-inbox-x svg, .loe-inbox-rail-strip svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-stats { display: flex; align-items: center; gap: 8px; }
  .loe-inbox-muted { font-size: 12px; color: #6b7280; }
  .loe-inbox-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 7px; border-radius: 10px; background: #fee2e2; color: #b91c1c; font-size: 12px; font-weight: 700; white-space: nowrap; }
  .loe-inbox-spacer { flex: 1 1 auto; }
  .loe-inbox-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .loe-inbox-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid #d5dbe5; background: #fff; color: #1f2937; font-size: 13px; cursor: pointer; text-decoration: none; white-space: nowrap; }
  .loe-inbox-btn:hover { background: #f8fafc; border-color: #b6c2d6; }
  .loe-inbox-btn:disabled { opacity: .5; cursor: default; }
  .loe-inbox-btn.on { background: #eef4ff; border-color: #1c6cf3; color: #1c6cf3; }
  .loe-inbox-btn.warn { background: #fffbeb; border-color: #f59e0b; color: #b45309; font-weight: 600; }
  .loe-inbox-btn.primary { background: #1c6cf3; border-color: #1c6cf3; color: #fff; font-weight: 600; }
  .loe-inbox-btn.primary:hover { background: #0b57d0; }
  .loe-inbox-hint { font-size: 12px; color: #9a3412; background: #ffedd5; padding: 2px 8px; border-radius: 10px; }
  .loe-inbox-body { flex: 1 1 auto; display: flex; align-items: stretch; min-height: 0; }
  /* 欄與欄之間的直分隔線：6px 寬、疊在邊框上，拖拉改左邊那欄（右側欄則改右邊）的寬度 */
  .loe-inbox-vsplit { flex: 0 0 6px; margin: 0 -3px; position: relative; z-index: 3; cursor: col-resize; touch-action: none; user-select: none; }
  .loe-inbox-vsplit::before { content: ""; position: absolute; top: 50%; left: 50%; width: 4px; height: 28px; margin: -14px 0 0 -2px; border-left: 1px solid #c7cdd8; border-right: 1px solid #c7cdd8; opacity: .8; }
  .loe-inbox-vsplit:hover, .loe-inbox-vsplit.dragging { background: rgba(28,108,243,.15); }
  .loe-inbox-vsplit:hover::before, .loe-inbox-vsplit.dragging::before { border-color: #1c6cf3; }
  .loe-inbox-rail.collapsed + .loe-inbox-vsplit, .loe-inbox-body:has(> .loe-inbox-side[hidden]) > .loe-inbox-vsplit[data-col="side"] { display: none; }
  @media (max-width: 960px) { .loe-inbox-vsplit { display: none; } }
  .loe-inbox-gate { position: absolute; top: 56px; left: 0; right: 0; bottom: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px; background: #f3f5f9; }
  .loe-inbox-gate[hidden] { display: none; }
  .loe-inbox-gate-box { display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 460px; padding: 32px 28px; background: #fff; border: 1px solid #e3e7ee; border-radius: 16px; box-shadow: 0 12px 40px rgba(15,23,42,.08); text-align: center; }
  .loe-inbox-gate-box strong { font-size: 17px; color: #1f2937; }
  .loe-inbox-gate-box p { margin: 0; color: #4b5563; font-size: 13px; line-height: 1.6; }
  .loe-inbox-gate-icon { width: 56px; height: 56px; border-radius: 50%; background: #fffbeb; color: #b45309; display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-gate-icon svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-gate-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .loe-inbox-terms { width: min(880px, calc(100vw - 32px)); max-width: none; max-height: calc(100vh - 32px); max-height: calc(100dvh - 32px); margin: auto; padding: 0; border: 1px solid #e3e7ee; border-radius: 16px; background: #fff; color: #1f2937; box-shadow: 0 24px 80px rgba(15,23,42,.24); overflow: hidden; }
  .loe-inbox-terms[open] { display: flex; flex-direction: column; }
  .loe-inbox-terms::backdrop { background: rgba(15,23,42,.5); }
  .loe-inbox-terms-head { flex: 0 0 auto; padding: 22px 28px 16px; border-bottom: 1px solid #e3e7ee; }
  .loe-inbox-terms-head h1 { margin: 0; font-size: 20px; line-height: 1.5; }
  .loe-inbox-terms-head p { margin: 8px 0 0; color: #6b7280; font-size: 13px; }
  .loe-inbox-terms-body { flex: 1 1 auto; min-height: 0; padding: 8px 28px 20px; overflow-y: auto; overscroll-behavior: contain; line-height: 1.85; overflow-wrap: anywhere; }
  .loe-inbox-terms-body h2 { margin: 24px 0 10px; font-size: 16px; }
  .loe-inbox-terms-body p { margin: 12px 0; }
  .loe-inbox-terms-body a { text-underline-offset: 3px; }
  .loe-inbox-terms-highlight { padding: 2px 5px; border-radius: 4px; background: #fef08a; color: #991b1b; font-weight: 800; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .loe-inbox-terms-foot { flex: 0 0 auto; display: flex; align-items: center; flex-wrap: wrap; gap: 12px 20px; padding: 16px 28px; border-top: 1px solid #e3e7ee; background: #f8fafc; }
  .loe-inbox-terms-agree { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; cursor: pointer; }
  .loe-inbox-terms-agree input { width: 18px; height: 18px; margin: 0; accent-color: #1c6cf3; }
  .loe-inbox-terms-actions { display: flex; gap: 8px; margin-left: auto; }
  .loe-inbox-terms-error { flex-basis: 100%; margin: 0; color: #b91c1c; font-size: 13px; }
  @media (max-width: 600px) {
    .loe-inbox-terms { width: calc(100vw - 16px); max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); border-radius: 12px; }
    .loe-inbox-terms-head, .loe-inbox-terms-foot { padding: 14px 16px; }
    .loe-inbox-terms-head h1 { font-size: 17px; }
    .loe-inbox-terms-body { padding: 0 16px 12px; }
    .loe-inbox-terms-actions { flex-wrap: wrap; }
  }
  @media (max-width: 960px) { .loe-inbox { height: auto; min-height: 100vh; overflow: visible; } .loe-inbox-body { flex-wrap: wrap; } }
  .loe-inbox-rail { flex: 0 0 272px; min-width: 0; min-height: 0; background: #fff; border-right: 1px solid #e3e7ee; display: flex; flex-direction: column; }
  .loe-inbox-rail-head, .loe-inbox-list-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; font-size: 13px; color: #374151; }
  .loe-inbox-rail-head span, .loe-inbox-list-head span { font-size: 11px; color: #6b7280; }
  .loe-inbox-rail-head { gap: 8px; }
  .loe-inbox-rail-head strong { margin-right: auto; }
  /* 左欄收起：只剩一條可點的直條（監聽與通知照常），再點展開 */
  .loe-inbox-rail.collapsed { flex-basis: 40px !important; }
  .loe-inbox-rail.collapsed > :not(.loe-inbox-rail-strip) { display: none; }
  .loe-inbox-rail-strip { display: none; }
  .loe-inbox-rail.collapsed .loe-inbox-rail-strip { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; height: 100%; padding: 12px 0; border: 0; background: transparent; color: #374151; cursor: pointer; }
  .loe-inbox-rail-strip:hover { background: #f8fafc; }
  .loe-inbox-rail-strip-text { writing-mode: vertical-rl; font-size: 12px; letter-spacing: 2px; }
  /* 其他欄位收起：同官方帳號欄，收成 40px 的窄條（直排欄名＋箭頭），點一下展開 */
  .loe-inbox-col-strip { display: none; }
  .loe-inbox-list.collapsed, .loe-inbox-thread.collapsed, .loe-inbox-side.collapsed { flex: 0 0 40px !important; width: 40px !important; min-width: 40px; background: #fff; }
  .loe-inbox-list.collapsed > :not(.loe-inbox-col-strip), .loe-inbox-thread.collapsed > :not(.loe-inbox-col-strip), .loe-inbox-side.collapsed > :not(.loe-inbox-col-strip) { display: none !important; }
  .collapsed > .loe-inbox-col-strip { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; height: 100%; padding: 12px 0; border: 0; background: transparent; color: #374151; cursor: pointer; }
  .loe-inbox-col-strip:hover { background: #f8fafc; }
  .loe-inbox-col-strip svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-list.collapsed + .loe-inbox-vsplit, .loe-inbox-thread.collapsed + .loe-inbox-vsplit, .loe-inbox-body:has(> .loe-inbox-side.collapsed) > .loe-inbox-vsplit[data-col="side"] { display: none; }
  .loe-inbox-thread.collapsed { border-right: 1px solid #e3e7ee; }
  .loe-inbox-list-head .loe-inbox-col-toggle { margin-left: auto; }
  .loe-inbox-list-head > span { margin-left: auto; }
  .loe-inbox-list-head > span + .loe-inbox-col-toggle { margin-left: 6px; }
  .loe-inbox-side-bar { flex: 0 0 auto; display: flex; align-items: center; height: 28px; padding: 0 6px; border-bottom: 1px solid #e3e7ee; background: #f8fafc; }
  .loe-inbox-search { margin: 0 12px 10px; height: 34px; padding: 0 10px; border: 1px solid #d5dbe5; border-radius: 8px; font-size: 13px; }
  .loe-inbox-rail-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding: 0 8px 12px; }
  .loe-inbox-rail-foot { flex: 0 0 auto; padding: 10px 12px 10px 16px; border-top: 1px solid #e3e7ee; font-size: 11px; color: #6b7280; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .loe-inbox-rail-foot-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .loe-inbox-rail-foot-all { display: flex; gap: 2px; flex: 0 0 auto; }
  .loe-inbox-rail-foot-all .loe-inbox-x.on { color: #1c6cf3; }
  .loe-inbox-rail-foot strong { color: #1f2937; }
  .loe-inbox-oa { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; }
  .loe-inbox-oa.on { background: #f8fafc; }
  .loe-inbox-oa-avatar { width: 32px; height: 32px; border-radius: 9px; flex: 0 0 auto; object-fit: cover; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; }
  .loe-inbox-oa-main { flex: 1 1 auto; min-width: 0; }
  .loe-inbox-oa-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #6b7280; }
  .loe-inbox-oa.on .loe-inbox-oa-name { color: #1f2937; }
  .loe-inbox-oa-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
  .loe-inbox-oa-status.live { color: #16a34a; }
  .loe-inbox-oa-status.connecting { color: #ca8a04; }
  .loe-inbox-oa-status.poll { color: #2563eb; }
  .loe-inbox-oa-status.error { color: #dc2626; }
  .loe-inbox-oa-status.limit { color: #d97706; }
  .loe-inbox-stat-limit { color: #d97706; }
  .loe-inbox-switch { width: 38px; height: 22px; border-radius: 11px; border: 0; padding: 2px; background: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: flex-start; flex: 0 0 auto; }
  .loe-inbox-switch[aria-checked="true"] { background: #1c6cf3; justify-content: flex-end; }
  .loe-inbox-knob { width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
  .loe-inbox-empty { padding: 28px 16px; text-align: center; color: #6b7280; font-size: 13px; }
  .loe-inbox-empty.err { color: #b91c1c; }
  .loe-inbox-list { flex: 0 0 400px; min-width: 0; min-height: 0; background: #fff; border-right: 1px solid #e3e7ee; display: flex; flex-direction: column; }
  /* 篩選列：緊湊、一排不換行（超出可左右滑、不顯示捲軸） */
  .loe-inbox-filters { flex: 0 0 auto; display: flex; gap: 4px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding: 0 12px 6px; }
  .loe-inbox-filters::-webkit-scrollbar { display: none; }
  .loe-inbox-chip { flex: 0 0 auto; height: 24px; padding: 0 9px; border-radius: 12px; border: 1px solid #d5dbe5; background: #fff; color: #374151; font-size: 12px; line-height: 1; white-space: nowrap; cursor: pointer; display: inline-flex; align-items: center; }
  .loe-inbox-chip.on { background: #1c6cf3; border-color: #1c6cf3; color: #fff; }
  .loe-inbox-rows { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; }
  .loe-inbox-row { display: flex; gap: 10px; align-items: flex-start; text-align: left; width: 100%; padding: 10px 14px; border: 0; border-left: 3px solid transparent; background: #fff; cursor: pointer; color: #1f2937; }
  .loe-inbox-row:hover { background: #f8fafc; }
  .loe-inbox-row.selected { background: #eef4ff; }
  .loe-inbox-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e5e7eb; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: #4b5563; flex: 0 0 auto; }
  .loe-inbox-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .loe-inbox-row-top, .loe-inbox-row-mid, .loe-inbox-row-meta { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .loe-inbox-oa-chip { font-size: 11px; padding: 1px 6px; border-radius: 4px; color: #fff; white-space: nowrap; flex: 0 0 auto; }
  .loe-inbox-row-name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0; }
  .loe-inbox-row-time { font-size: 11px; color: #6b7280; white-space: nowrap; }
  .loe-inbox-pin { display: inline-flex; flex: 0 0 auto; color: #1c6cf3; }
  .loe-inbox-pin svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-row-preview { flex: 1 1 auto; min-width: 0; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-unread { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #dc2626; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
  .loe-inbox-unread.dot { min-width: 10px; width: 10px; height: 10px; padding: 0; }
  .loe-inbox-tag { font-size: 11px; padding: 1px 7px; border-radius: 4px; background: #ffedd5; color: #9a3412; }
  .loe-inbox-tag.done { background: #e5e7eb; color: #4b5563; }
  .loe-inbox-tag.ord { color: #fff; font-weight: 600; background: #6b7280; }
  .loe-inbox-tag.ord.booking { background: #7c3aed; }
  .loe-inbox-tag.ord.pending { background: #f59e0b; }
  .loe-inbox-tag.ord.accepted { background: #1c6cf3; }
  .loe-inbox-tag.ord.arrived { background: #16a34a; }
  .loe-inbox-tag.ord.executing { background: #0d9488; }
  .loe-inbox-order-filters { padding-top: 0; }
  .loe-inbox-chip .n { margin-left: 4px; opacity: .75; }
  .loe-inbox-chip-refresh { width: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: #6b7280; }
  .loe-inbox-chip-refresh svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-chip-refresh:disabled { opacity: .6; cursor: progress; }
  .loe-inbox-chip-fold { width: 26px; padding: 0; justify-content: center; color: #6b7280; gap: 3px; }
  .loe-inbox-chip-fold[aria-expanded="false"] { width: auto; padding: 0 9px 0 6px; }
  .loe-inbox-chip-fold.on { color: #fff; }
  .loe-inbox-chip-fold-icon { display: inline-flex; }
  .loe-inbox-chip-fold svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-chip-refresh:disabled svg { animation: loe-inbox-spin 1s linear infinite; }
  @keyframes loe-inbox-spin { to { transform: rotate(360deg); } }
  .loe-inbox-tag.ai { background: #eef2ff; color: #4f46e5; font-weight: 700; }
  .loe-inbox-tag.group { background: #eef4ff; color: #1c6cf3; border: 1px solid rgba(28,108,243,.35); font-weight: 600; }
  .loe-inbox-row-top > .loe-inbox-tag { flex: 0 0 auto; white-space: nowrap; } /* 群編不換行、不被擠扁；名字太長用 … 縮 */
  .loe-inbox-prefix { color: #1c6cf3; border-color: rgba(28,108,243,.35); font-weight: 600; }
  .loe-inbox-prefix.empty { color: #6b7280; font-weight: 400; }
  .loe-inbox-tag.ai-on { background: #6366f1; color: #fff; }
  .loe-inbox-tag.ai-human { background: #f97316; color: #fff; }
  .loe-inbox-tag.ai-unmatched { background: #e5e7eb; color: #6b7280; }
  .loe-inbox-oa-name { display: flex; align-items: center; gap: 5px; }
  .loe-inbox-oa-name > .loe-inbox-oa-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-oa-name > .loe-inbox-tag { flex: 0 0 auto; }
  .loe-inbox-oa-status > .loe-inbox-tag.ai { padding: 0 5px; line-height: 16px; }
  .loe-inbox-thread { flex: 1 1 560px; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #f3f5f9; position: relative; }
  .loe-inbox-notes { position: absolute; top: 57px; right: 0; bottom: 0; width: min(340px, 100%); background: #fff; border-left: 1px solid #e3e7ee; box-shadow: -6px 0 18px rgba(15,23,42,.08); display: flex; flex-direction: column; z-index: 4; }
  .loe-inbox-notes-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #e3e7ee; }
  .loe-inbox-note-add { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; border-bottom: 1px solid #e3e7ee; align-items: flex-end; }
  .loe-inbox-note-input { width: 100%; box-sizing: border-box; resize: vertical; padding: 8px 10px; border: 1px solid #d5dbe5; border-radius: 8px; font-size: 13px; }
  .loe-inbox-notes-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
  .loe-inbox-note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px; }
  .loe-inbox-note-body { white-space: pre-wrap; word-break: break-word; }
  .loe-inbox-note-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: #92400e; }
  .loe-inbox-note-del { border: 0; background: transparent; color: #b91c1c; font-size: 11px; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
  .loe-inbox-note-del:hover { background: #fee2e2; }
  .loe-inbox-note-del.edit { color: #1c6cf3; }
  .loe-inbox-note-del.edit:hover { background: #dbe7ff; }
  .loe-inbox-note.editing .loe-inbox-note-input { background: #fff; }
  .loe-inbox-note-edit-actions { display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 6px; }
  .loe-inbox-rename { height: 32px; padding: 0 10px; border: 1px solid #1c6cf3; border-radius: 8px; font-size: 14px; min-width: 180px; }
  .loe-inbox-rename-btn { color: #9ca3af; }
  .loe-inbox-rename-btn:hover { color: #1c6cf3; }
  .loe-inbox-th-head { flex: 0 0 auto; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 44px 10px 20px; background: #fff; border-bottom: 1px solid #e3e7ee; position: relative; }
  .loe-inbox-th-head > .loe-inbox-col-toggle { position: absolute; top: 10px; right: 12px; } /* 收起「聊天」欄的箭頭固定在右上角，不佔一行 */
  .loe-inbox-th-head .loe-inbox-avatar { width: 36px; height: 36px; }
  /* 對話內訊息搜尋列（標題列下方）＋結果下拉 */
  .loe-inbox-msearch { flex: 0 0 auto; position: relative; display: flex; align-items: center; gap: 6px; padding: 8px 20px; background: #fff; border-bottom: 1px solid #e3e7ee; }
  .loe-inbox-msearch-icon { display: inline-flex; color: #6b7280; }
  .loe-inbox-msearch-icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-msearch-input { flex: 1 1 auto; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid #1c6cf3; border-radius: 8px; font: inherit; font-size: 13px; }
  .loe-inbox-msearch-count { font-size: 12px; color: #6b7280; white-space: nowrap; min-width: 2em; text-align: center; }
  .loe-inbox-msearch .loe-inbox-x:disabled { opacity: .35; cursor: default; }
  .loe-inbox-msearch-list { position: absolute; top: 100%; left: 44px; right: 120px; max-height: min(360px, 50vh); overflow-y: auto; background: #fff; border: 1px solid #e3e7ee; border-radius: 10px; box-shadow: 0 12px 30px rgba(15,23,42,.18); z-index: 6; display: flex; flex-direction: column; padding: 4px; gap: 2px; }
  .loe-inbox-msearch-item { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; font: inherit; cursor: pointer; }
  .loe-inbox-msearch-item:hover, .loe-inbox-msearch-item.on { background: #f1f5ff; }
  .loe-inbox-msearch-who { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: #6b7280; }
  .loe-inbox-msearch-who strong { color: #1f2937; }
  .loe-inbox-msearch-snippet { font-size: 13px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-msearch-snippet mark.loe-hit { background: transparent; color: #1c6cf3; font-weight: 700; }
  mark.loe-hit { background: #fde68a; color: inherit; padding: 0; border-radius: 2px; }
  .loe-inbox-msg.hit .loe-inbox-bubble { box-shadow: 0 0 0 2px #f59e0b; }
  .loe-inbox-th-title { min-width: 0; }
  .loe-inbox-th-name { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .loe-inbox-th-msgs { flex: 1 1 auto; min-height: 0; padding: 20px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
  .loe-inbox-th-empty { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; color: #6b7280; }
  .loe-inbox-day { align-self: center; font-size: 11px; color: #6b7280; background: #e5e7eb; padding: 2px 10px; border-radius: 10px; }
  .loe-inbox-msg { display: flex; flex-direction: column; gap: 2px; max-width: 68%; }
  .loe-inbox-msg.in { align-self: flex-start; align-items: flex-start; }
  .loe-inbox-msg.out { align-self: flex-end; align-items: flex-end; }
  .loe-inbox-bubble { padding: 9px 13px; border-radius: 14px; background: #fff; color: #1f2937; white-space: pre-wrap; word-break: break-word; box-shadow: 0 1px 1px rgba(0,0,0,.05); }
  .loe-inbox-msg.out .loe-inbox-bubble { background: #1c6cf3; color: #fff; }
  .loe-inbox-msg.failed .loe-inbox-bubble { background: #fee2e2; color: #991b1b; }
  .loe-inbox-bubble.media { padding: 4px; background: #fff; }
  .loe-inbox-bubble.media.loe-has-forward { padding: 9px 13px; } /* 位置訊息：留位置給右上角派車／複製 */
  .loe-inbox-msg.out .loe-inbox-bubble.media { background: #fff; color: #1f2937; }
  .loe-inbox-media-link { display: block; line-height: 0; }
  .loe-inbox-media-img { max-width: 260px; max-height: 260px; border-radius: 10px; display: block; object-fit: contain; }
  .loe-inbox-media-video { max-width: 320px; max-height: 260px; border-radius: 10px; display: block; background: #000; }
  .loe-inbox-media-audio { display: block; width: 260px; }
  .loe-inbox-media-sticker { width: 120px; height: 120px; object-fit: contain; display: block; }
  .loe-inbox-media-file { display: inline-block; padding: 6px 10px; color: #1c6cf3; text-decoration: none; word-break: break-all; }
  .loe-inbox-media-file:hover { text-decoration: underline; }
  .loe-inbox-media-expired { display: inline-block; padding: 6px 10px; color: #6b7280; font-size: 12px; }
  .loe-inbox-link { color: inherit; text-decoration: underline; text-underline-offset: 2px; word-break: break-all; }
  .loe-inbox-link:hover { opacity: .85; }
  .loe-inbox-msg.in .loe-inbox-link, .loe-inbox-msg.card .loe-inbox-link { color: #1c6cf3; }
  .loe-inbox-msg.card .loe-inbox-bubble { background: #eef2ff; color: #312e81; border: 1px solid #c7d2fe; border-left: 4px solid #6366f1; border-radius: 10px 14px 14px 10px; }
  .loe-inbox-msg.card .loe-inbox-msg-meta { color: #6366f1; }
  .loe-inbox-card-label { display: block; font-size: 11px; font-weight: 700; color: #6366f1; margin-bottom: 4px; letter-spacing: .02em; }
  .loe-inbox-msg.card .loe-copy-button, .loe-inbox-msg.card .loe-forward-button { color: #6366f1; }
  .loe-inbox-msg-meta { font-size: 11px; color: #9ca3af; }
  .loe-inbox-msg .loe-copy-button, .loe-inbox-msg .loe-forward-button { opacity: .85; }
  .loe-inbox-msg.out .loe-copy-button, .loe-inbox-msg.out .loe-forward-button { background: rgba(255,255,255,.96); }
  .loe-inbox-bubble.loe-has-forward { min-width: 96px; }
  .loe-inbox-ai-slot { display: inline-flex; align-items: center; }
  .loe-inbox-sysnoti.on { background: #ecfdf3; border-color: #16a34a; color: #15803d; font-weight: 600; }
  .loe-inbox-sysnoti.off { color: #6b7280; }
  .loe-inbox-orders { flex: 0 0 auto; position: relative; display: flex; flex-direction: column; gap: 6px; padding: 8px 48px 8px 20px; background: #fafbfd; border-bottom: 1px solid #e3e7ee; font-size: 13px; }
  .loe-inbox-orders.collapsed { padding-top: 5px; padding-bottom: 5px; }
  .loe-inbox-orders-toggle { position: absolute; top: 6px; right: 14px; }
  .loe-inbox-orders.collapsed .loe-inbox-orders-toggle { top: 3px; }
  .loe-ord-summary { gap: 4px 14px; }
  .loe-ord-mini { display: inline-flex; align-items: center; gap: 6px; }
  .loe-inbox-orders .err { color: #dc2626; }
  .loe-inbox-sysnoti:disabled { opacity: 1; }
  .loe-inbox-dchat { position: absolute; top: 57px; right: 0; bottom: 0; width: min(400px, 100%); background: #fff; border-left: 1px solid #e3e7ee; box-shadow: -6px 0 18px rgba(15,23,42,.08); display: flex; flex-direction: column; z-index: 5; }
  .loe-inbox-dchat.dock { position: static; flex: 0 0 400px; width: 400px; min-height: 0; box-shadow: none; }
  .loe-inbox-dchat.dock .loe-dchat-title { cursor: default; }
  @media (max-width: 1400px) { .loe-inbox-dchat.dock { flex-basis: 340px; width: 340px; } }
  /* 右欄：上半司機對話（停靠）、下半記事本，中間可拖拉 */
  .loe-inbox-side { flex: 0 0 400px; width: 400px; min-height: 0; display: flex; flex-direction: column; border-left: 1px solid #e3e7ee; background: #fff; }
  @media (max-width: 1400px) { .loe-inbox-side { flex-basis: 340px; width: 340px; } }
  .loe-inbox-side .loe-inbox-dchat.dock { flex: 1 1 auto; width: auto; border-left: 0; }
  .loe-inbox-side.split .loe-inbox-dchat.dock { flex: 0 0 55%; }
  .loe-inbox-side .loe-inbox-notes { position: static; width: auto; flex: 1 1 auto; min-height: 0; border-left: 0; box-shadow: none; }
  .loe-inbox-side .loe-inbox-notes.collapsed { flex: 0 0 auto; }
  .loe-inbox-side .loe-inbox-dchat.dock + .loe-inbox-side-split[hidden] + .loe-inbox-notes { border-top: 1px solid #e3e7ee; }
  .loe-inbox-notes-title { cursor: pointer; }
  /* 記事本放大：固定定位蓋在訊息串上（右欄原位留空），寬度最多 960px */
  .loe-inbox-side .loe-inbox-notes.max { position: fixed; top: var(--loe-notes-top, 57px); right: 0; bottom: 0; left: auto; width: min(960px, 100vw); z-index: 60; border-left: 1px solid #e3e7ee; box-shadow: -12px 0 32px rgba(15,23,42,.18); }
  .loe-inbox-notes.max .loe-inbox-notes-list { padding: 14px 20px; }
  .loe-inbox-notes.max .loe-inbox-note-input { min-height: 72px; }
  .loe-inbox-side-split { flex: 0 0 8px; cursor: row-resize; background: #f1f5f9; border-block: 1px solid #e3e7ee; touch-action: none; position: relative; }
  .loe-inbox-side-split::after { content: ""; position: absolute; left: 50%; top: 2px; width: 36px; height: 3px; margin-left: -18px; border-radius: 2px; background: #94a3b8; }
  .loe-inbox-side-empty { padding: 12px 14px; font-size: 13px; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e3e7ee; }
  /* 右上「選項」 */
  .loe-inbox-options { position: relative; }
  .loe-inbox-options-menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 30; width: 320px; background: #fff; border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,.2); padding: 6px; display: flex; flex-direction: column; gap: 2px; }
  .loe-inbox-options-group { padding: 8px 10px 4px; font-size: 12px; font-weight: 700; color: #64748b; }
  .loe-inbox-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 4px 10px; border-radius: 8px; cursor: pointer; }
  .loe-inbox-option:hover { background: #eef4ff; }
  .loe-inbox-option input { width: 18px; height: 18px; accent-color: #1c6cf3; flex: none; }
  .loe-inbox-option-icon { flex: none; width: 20px; height: 20px; color: #64748b; display: flex; }
  .loe-inbox-option-icon svg { width: 20px; height: 20px; }
  .loe-inbox-option:has(input:checked) .loe-inbox-option-icon { color: #1c6cf3; }
  .loe-inbox-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 14px; color: #1f2937; }
  .loe-inbox-option-text small { font-size: 12px; color: #64748b; }
  img.loe-inbox-avatar { object-fit: cover; }
  .loe-inbox-msg.failed .loe-inbox-msg-meta { color: #b91c1c; }
  .loe-inbox-composer { flex: 0 0 auto; padding: 10px 20px 16px; background: #fff; border-top: 1px solid #e3e7ee; display: flex; flex-direction: column; gap: 8px; }
  .loe-inbox-composer-row { display: flex; gap: 10px; align-items: flex-end; }
  /* 回覆（引用）：輸入框上方的引用條（同 LINE 聊天室）；泡泡內的引用塊 */
  .loe-inbox-reply { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-left: 3px solid #1c6cf3; border-radius: 6px; background: #f1f5ff; font-size: 12px; }
  .loe-inbox-reply-body { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
  .loe-inbox-reply-text { color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-quote { display: block; margin-bottom: 4px; padding: 4px 8px; border-left: 3px solid rgba(0,0,0,.25); border-radius: 4px; background: rgba(0,0,0,.06); font-size: 12px; opacity: .85; max-width: 100%; overflow: hidden; }
  .loe-inbox-quote strong { display: block; font-size: 11px; }
  .loe-inbox-quote span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-msg.out .loe-inbox-bubble:not(.media) .loe-inbox-quote { border-left-color: rgba(255,255,255,.6); background: rgba(255,255,255,.15); }
  .loe-inbox-textarea { flex: 1 1 auto; min-width: 0; min-height: 60px; resize: vertical; padding: 10px 12px; border: 1px solid #d5dbe5; border-radius: 10px; font-size: 14px; line-height: 1.5; }
  .loe-inbox-composer-btns { display: flex; flex-direction: column; gap: 6px; align-self: stretch; justify-content: flex-end; }
  .loe-inbox-dispatch { height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid #f97316; background: #fff; color: #c2410c; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
  .loe-inbox-dispatch:hover { background: #fff7ed; }
  .loe-inbox-dispatch svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-send { height: 40px; padding: 0 16px; border-radius: 10px; border: 0; background: #1c6cf3; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
  .loe-inbox-send:hover { background: #0b57d0; }
  .loe-inbox-send:disabled { opacity: .6; cursor: progress; }
  /* 輸入框下方一排：左邊三顆圖示、右邊待處理／處理完畢／開啟官方，擠不下就縮小、再擠不下只留圖示（不換行） */
  .loe-inbox-composer { container-type: inline-size; }
  .loe-inbox-tools { display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; min-width: 0; }
  .loe-inbox-tools-right { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; flex-wrap: nowrap; flex: 0 1 auto; min-width: 0; }
  .loe-inbox-tools-right .loe-inbox-btn { height: 28px; padding: 0 8px; gap: 4px; font-size: 12px; }
  @container (max-width: 480px) { .loe-inbox-tools-right .loe-inbox-btn { height: 26px; padding: 0 6px; font-size: 11px; } .loe-inbox-tools-right .loe-inbox-btn svg { width: 14px; height: 14px; } .loe-inbox-tool { width: 28px; } }
  @container (max-width: 360px) { .loe-inbox-tools-right .loe-inbox-btn span { display: none; } .loe-inbox-tools-right .loe-inbox-btn { padding: 0 7px; } }
  .loe-inbox-flag.on { background: #ecfdf3; border-color: #16a34a; color: #15803d; font-weight: 600; }
  .loe-inbox-tool { width: 34px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: #6b7280; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-tool:hover, .loe-inbox-tool.on { background: #e8eefb; color: #1c6cf3; }
  .loe-inbox-tool svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-picker { border: 1px solid #e3e7ee; border-radius: 10px; background: #fafbfd; display: flex; flex-direction: column; height: 280px; }
  .loe-inbox-picker-tabs { flex: 0 0 auto; display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-bottom: 1px solid #e3e7ee; min-width: 0; }
  .loe-inbox-picker-scroll { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 2px; overflow-x: auto; scrollbar-width: thin; }
  .loe-inbox-picker-close { flex: 0 0 auto; border: 1px solid #d5dbe5; background: #fff; }
  .loe-inbox-picker-close:hover { background: #f1f5f9; color: #1f2937; }
  .loe-inbox-picker-kind { flex: 0 0 auto; height: 28px; padding: 0 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #6b7280; font-size: 13px; cursor: pointer; }
  .loe-inbox-picker-kind.on { background: #fff; border-color: #d5dbe5; color: #1f2937; font-weight: 600; }
  .loe-inbox-picker-sep { flex: 0 0 auto; width: 1px; height: 22px; margin: 0 6px; background: #e3e7ee; }
  .loe-inbox-picker-tab { flex: 0 0 auto; width: 38px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-picker-tab.on { background: #dbe7ff; }
  .loe-inbox-picker-tab img { width: 26px; height: 26px; object-fit: contain; }
  .loe-inbox-picker-grid { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4px; padding: 8px; }
  .loe-inbox-picker-grid > button { width: 84px; height: 84px; padding: 4px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
  .loe-inbox-picker.emoji .loe-inbox-picker-grid > button { width: 40px; height: 40px; }
  .loe-inbox-picker-grid > button:hover { background: #e8eefb; }
  .loe-inbox-picker-grid img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .loe-inbox-picker-grid .loe-inbox-empty { width: 100%; }
  .loe-inbox-emoji { width: 20px; height: 20px; vertical-align: -5px; display: inline-block; }
  .loe-inbox-lightbox { position: fixed; inset: 0; background: rgba(15,23,42,.88); z-index: 2147483645; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
  .loe-inbox-lightbox-img { max-width: 96vw; max-height: 92vh; object-fit: contain; border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,.5); cursor: zoom-out; }
  .loe-inbox-lightbox-bar { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; cursor: default; }
  .loe-inbox-lightbox-bar .loe-inbox-btn { background: rgba(255,255,255,.92); }
  .loe-inbox-modal { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
  .loe-inbox-modal-box { width: min(760px, calc(100vw - 32px)); height: min(640px, calc(100vh - 48px)); background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(15,23,42,.25); display: flex; flex-direction: column; }
  .loe-inbox-modal-head { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 14px 18px 8px; font-size: 16px; font-weight: 700; }
  .loe-inbox-modal-tabs { flex: 0 0 auto; display: flex; gap: 4px; padding: 0 18px; border-bottom: 1px solid #e3e7ee; }
  .loe-inbox-modal-tab { padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: #6b7280; font-size: 13px; cursor: pointer; }
  .loe-inbox-modal-tab.on { color: #1f2937; border-bottom-color: #1c6cf3; font-weight: 600; }
  .loe-inbox-modal-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 10px 18px; display: flex; flex-direction: column; gap: 6px; }
  .loe-inbox-content-item { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid #e3e7ee; border-radius: 10px; background: #fff; cursor: pointer; text-align: left; color: inherit; }
  .loe-inbox-content-item:hover { background: #f8fafc; }
  .loe-inbox-content-item.on { border-color: #1c6cf3; background: #eef4ff; }
  .loe-inbox-content-item img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; flex: 0 0 auto; }
  .loe-inbox-content-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .loe-inbox-content-text .desc { color: #6b7280; font-size: 12px; white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .loe-inbox-more { align-self: center; }
  .loe-inbox-modal-foot { flex: 0 0 auto; display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #e3e7ee; }
  .loe-inbox-send svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-toasts { position: fixed; top: 64px; right: 20px; width: min(360px, calc(100vw - 32px)); display: flex; flex-direction: column; gap: 8px; z-index: 2147483647; pointer-events: none; }
  .loe-inbox-toasts > * { pointer-events: auto; }
  .loe-inbox-toast { background: #fff; border: 1px solid #e3e7ee; border-left: 4px solid #1c6cf3; border-radius: 10px; padding: 10px 12px; box-shadow: 0 6px 20px rgba(15,23,42,.12); display: flex; flex-direction: column; gap: 6px; }
  .loe-inbox-toast-top { display: flex; align-items: center; gap: 6px; }
  .loe-inbox-toast-top > .loe-inbox-tag { flex: 0 0 auto; white-space: nowrap; }
  .loe-inbox-toast-top > .loe-inbox-row-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .loe-inbox-toast-sub { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12px; color: #64748b; margin-top: -2px; }
  .loe-inbox-toast-order { flex: 0 0 auto; font-weight: 600; color: #475569; }
  .loe-inbox-toast-who { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .loe-inbox-toast-sub .loe-inbox-badge { flex: 0 0 auto; }
  .loe-inbox-toast-ori { font-size: 11px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: -2px; }
  .loe-inbox-toast-body { color: #374151; white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .loe-inbox-toast-actions { display: flex; gap: 6px; }
  .loe-inbox-toast { position: relative; overflow: hidden; }
  .loe-inbox-toast-time { flex: 0 0 auto; font-size: 11px; color: #94a3b8; }
  .loe-inbox-toast-top > .loe-inbox-x { flex: 0 0 auto; }
  /* 右上角的卡：露出期間底部一條藍線倒數（CSS 動畫，時間同 INBOX_TOAST_MS） */
  .loe-inbox-toasts .loe-inbox-toast-timer { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: #1c6cf3; opacity: .45; transform-origin: left; animation: loe-inbox-toast-timer 10s linear forwards; }
  @keyframes loe-inbox-toast-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  .loe-inbox-notif .loe-inbox-toast-timer { display: none; }
  /* 第 4 張起摺成一列 */
  .loe-inbox-toast-fold { display: flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px dashed #c7cdd8; border-radius: 10px; padding: 4px 6px 4px 10px; font-size: 12px; color: #64748b; }
  .loe-inbox-toast-fold-open { flex: 1 1 auto; display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: #374151; font-size: 12px; cursor: pointer; text-align: left; }
  .loe-inbox-toast-fold-open svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-toast-fold-clear { flex: 0 0 auto; border: 1px solid #d5dbe5; background: #fff; border-radius: 6px; height: 24px; padding: 0 8px; font-size: 11px; color: #374151; cursor: pointer; }
  .loe-inbox-toast-fold-clear:hover { background: #f1f5f9; }
  /* 標頭鈴鐺 */
  .loe-inbox-bell { position: relative; }
  .loe-inbox-stepper { display: inline-flex; align-items: center; gap: 4px; }
  .loe-inbox-stepper button { width: 26px; height: 26px; border: 1px solid #d5dbe5; border-radius: 6px; background: #fff; color: #374151; cursor: pointer; font-size: 14px; line-height: 1; }
  .loe-inbox-stepper button:disabled { opacity: .4; cursor: default; }
  .loe-inbox-stepper strong { min-width: 18px; text-align: center; }
  .loe-inbox-bell-n { margin-left: 4px; }
  /* 鈴鐺清單抽屜：從收件匣主體上緣蓋到底、靠右 */
  .loe-inbox-notif { position: fixed; top: var(--loe-notif-top, 57px); right: 0; bottom: 0; width: min(380px, 100vw); background: #fff; border-left: 1px solid #e3e7ee; box-shadow: -12px 0 32px rgba(15,23,42,.18); z-index: 2147483646; display: flex; flex-direction: column; }
  .loe-inbox-notif-head { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e3e7ee; font-size: 13px; }
  .loe-inbox-notif-head svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-notif-head .loe-inbox-btn { height: 26px; font-size: 12px; }
  .loe-inbox-notif-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; }
  .loe-inbox-notif .loe-inbox-toast { box-shadow: none; }
  .loe-inbox-toast-actions .loe-inbox-btn { height: 28px; font-size: 12px; }
  .loe-inbox-x { width: 24px; height: 24px; border: 0; background: transparent; cursor: pointer; color: #6b7280; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; }
  .loe-inbox-x:hover { background: #f1f5f9; }
  .loe-inbox .loe-qr-bar { padding: 0; margin: 0; }
  /* 訂單看板（獨立畫面） */
  .loe-board { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; background: #f3f5f9; }
  .loe-board-bar { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 20px; background: #fff; border-bottom: 1px solid #e3e7ee; }
  .loe-board-title { font-size: 15px; }
  .loe-board-select { height: 32px; padding: 0 8px; border: 1px solid #d5dbe5; border-radius: 8px; background: #fff; font-size: 13px; }
  .loe-board-seg { display: inline-flex; gap: 4px; }
  .loe-board-search { width: 280px; max-width: 100%; height: 32px; padding: 0 10px; border: 1px solid #d5dbe5; border-radius: 8px; font-size: 13px; }
  .loe-board-spacer { flex: 1 1 auto; }
  .loe-board-main { flex: 1 1 auto; min-height: 0; display: flex; position: relative; }
  .loe-board-cols { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: repeat(5, minmax(220px, 1fr)); gap: 12px; padding: 14px 20px; overflow-x: auto; }
  .loe-board-col { min-height: 0; display: flex; flex-direction: column; background: #e9edf3; border-radius: 12px; padding: 10px; }
  .loe-board-col-head { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 2px 4px 10px; }
  .loe-board-dot { width: 10px; height: 10px; border-radius: 50%; background: #6b7280; }
  .loe-board-count { min-width: 22px; height: 20px; padding: 0 6px; border-radius: 10px; background: #fff; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
  .loe-board-cards { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .loe-board-none { color: #6b7280; font-size: 12px; text-align: center; padding: 16px 0; }
  .loe-board-card { text-align: left; background: #fff; border: 1px solid #e3e7ee; border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; gap: 5px; cursor: pointer; color: #1f2937; font-size: 13px; }
  .loe-board-card:hover { border-color: #b6c2d6; }
  .loe-board-card.selected { border-color: #1c6cf3; box-shadow: 0 0 0 2px rgba(28,108,243,.25); }
  .loe-board-card-top { display: flex; align-items: center; gap: 6px; }
  .loe-board-src { padding: 0 6px; height: 18px; border-radius: 4px; background: #eef1f6; color: #374151; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; }
  .loe-board-time { font-size: 12px; font-weight: 600; color: #4b5563; white-space: nowrap; }
  .loe-board-time.late { color: #b91c1c; }
  .loe-board-addr { line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .loe-board-sub { font-size: 12px; color: #4b5563; }
  .loe-board-sub.muted { color: #6b7280; }
  .loe-board-dot.booking, .loe-board-pill.booking { background: #7c3aed; }
  .loe-board-dot.pending, .loe-board-pill.pending { background: #b45309; }
  .loe-board-dot.accepted, .loe-board-pill.accepted { background: #1c6cf3; }
  .loe-board-dot.arrived, .loe-board-pill.arrived { background: #15803d; }
  .loe-board-dot.executing, .loe-board-pill.executing { background: #0f766e; }
  .loe-board-pill { color: #fff; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
  .loe-board-drawer { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100%); background: #fff; box-shadow: -10px 0 30px rgba(15,23,42,.16); display: flex; flex-direction: column; overflow-y: auto; z-index: 4; }
  .loe-board-drawer-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #e3e7ee; }
  .loe-board-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-bottom: 1px solid #f1f3f7; }
  .loe-board-cancel { color: #b91c1c; border-color: #fecaca; }
  .loe-board-kvs { display: flex; flex-direction: column; gap: 6px; padding: 12px 16px; }
  .loe-board-kv { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; font-size: 13px; }
  .loe-board-kv > span:first-child { color: #6b7280; }
  .loe-board-kv > span:last-child { white-space: pre-wrap; word-break: break-word; }
  .loe-board-note { padding: 0 16px 12px; }
  .loe-board-dchat { flex: 1 0 420px; display: flex; flex-direction: column; border-top: 1px solid #e3e7ee; min-height: 0; }
  .loe-board-dchat:empty { display: none; }
</style>
</head>
<body>
<div id="loe-inbox" class="loe-inbox">
  <header class="loe-inbox-top"></header>
  <div class="loe-inbox-gate" hidden></div>
  <div class="loe-inbox-body">
    <aside class="loe-inbox-rail">
      <div class="loe-inbox-rail-head"><strong>官方帳號</strong><span>打開 ＝ 監聽新訊息</span><button type="button" class="loe-inbox-x loe-inbox-rail-toggle" title="收起官方帳號面板" aria-label="收起官方帳號面板">${ic("chevron-left")}</button></div>
      <button type="button" class="loe-inbox-rail-strip" title="展開官方帳號面板" aria-label="展開官方帳號面板">${ic("chevron-right")}<span class="loe-inbox-rail-strip-text">官方帳號</span></button>
      <input class="loe-inbox-search" type="search" placeholder="搜尋帳號或群編" aria-label="搜尋帳號或群編">
      <div class="loe-inbox-rail-list"></div>
      <div class="loe-inbox-rail-foot"></div>
    </aside>
    <div class="loe-inbox-vsplit" data-col="rail" role="separator" aria-orientation="vertical" aria-label="拖拉調整官方帳號欄寬度" title="拖拉調整寬度，雙擊回到預設"></div>
    <section class="loe-inbox-list">
      <div class="loe-inbox-list-head"><strong>官方訊息</strong><span>依最後訊息時間</span><button type="button" class="loe-inbox-x loe-inbox-col-toggle" data-col-toggle="list" title="收起官方訊息" aria-label="收起官方訊息">${ic("chevron-left")}</button></div>
      <input class="loe-inbox-search loe-inbox-list-search" type="search" placeholder="搜尋客人、訊息內容、官方帳號或群編" aria-label="搜尋官方訊息">
      <div class="loe-inbox-filters"></div>
      <div class="loe-inbox-filters loe-inbox-order-filters" hidden aria-label="依訂單狀態篩選"></div>
      <div class="loe-inbox-rows"></div>
    </section>
    <div class="loe-inbox-vsplit" data-col="list" role="separator" aria-orientation="vertical" aria-label="拖拉調整官方訊息欄寬度" title="拖拉調整寬度，雙擊回到預設"></div>
    <main class="loe-inbox-thread">
      <div class="loe-inbox-th-head" hidden></div>
      <div class="loe-inbox-msearch" hidden role="search" aria-label="搜尋這位客人的訊息">
        <span class="loe-inbox-msearch-icon">${ic("search")}</span>
        <input class="loe-inbox-msearch-input" type="search" placeholder="輸入搜尋內容（Enter 搜尋，↑↓ 上下一筆，Esc 關閉）" aria-label="搜尋內容">
        <span class="loe-inbox-msearch-count"></span>
        <button type="button" class="loe-inbox-x loe-inbox-msearch-prev" title="上一筆（更舊）" aria-label="更舊的一筆">${ic("chevron-up")}</button>
        <button type="button" class="loe-inbox-x loe-inbox-msearch-next" title="下一筆（更新）" aria-label="更新的一筆">${ic("chevron-down")}</button>
        <button type="button" class="loe-inbox-x loe-inbox-msearch-close" title="關閉搜尋" aria-label="關閉搜尋">${ic("x")}</button>
        <div class="loe-inbox-msearch-list" hidden></div>
      </div>
      <div class="loe-inbox-orders" hidden aria-label="訂單狀態"></div>
      <div class="loe-inbox-th-msgs" hidden></div>
      <div class="loe-inbox-th-empty">尚無訊息，請從官方訊息選取一位客人</div>
      <aside class="loe-inbox-dchat" hidden aria-label="司機對話"></aside>
      <div class="loe-inbox-composer" hidden>
        <div class="loe-inbox-quick loe-qr-bar"></div>
        <div class="loe-inbox-picker" hidden></div>
        <div class="loe-inbox-reply" hidden aria-label="回覆的訊息"><span class="loe-inbox-reply-body"><strong class="loe-inbox-reply-who"></strong><span class="loe-inbox-reply-text"></span></span><button type="button" class="loe-inbox-x loe-inbox-reply-x" title="取消回覆（Esc）" aria-label="取消回覆">${ic("x")}</button></div>
        <div class="loe-inbox-composer-row">
          <textarea class="loe-inbox-textarea" rows="2" placeholder="輸入回覆 (Enter傳送，Shift+Enter可換行)" aria-label="回覆內容"></textarea>
          <div class="loe-inbox-composer-btns">
            <button type="button" class="loe-inbox-dispatch" title="派車：開啟派車視窗（上車地址自行填寫，或點訊息旁的派車帶入）"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg><span>派車</span></button>
            <button type="button" class="loe-inbox-send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg><span>傳送</span></button>
          </div>
        </div>
        <div class="loe-inbox-tools" role="toolbar" aria-label="更多傳送方式">
          <button type="button" class="loe-inbox-tool" data-tool="sticker" title="貼圖、表情貼" aria-label="貼圖、表情貼"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg></button>
          <button type="button" class="loe-inbox-tool" data-tool="file" title="檔案：圖片、影片、語音或其他檔案（圖片 20MB、其他 100MB 以內）" aria-label="檔案"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>
          <button type="button" class="loe-inbox-tool" data-tool="contents" title="選擇內容：預設訊息、多頁訊息、優惠券" aria-label="選擇內容"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path></svg></button>
          <button type="button" class="loe-inbox-tool" data-tool="quick" title="快捷回覆管理：新增、編輯、排序個人模板（和 LINE 聊天室那顆一樣）" aria-label="快捷回覆管理">${ic("message-square")}</button>
          <input type="file" class="loe-inbox-file" multiple hidden tabindex="-1" aria-hidden="true">
          <span class="loe-inbox-tools-right"></span>
        </div>
      </div>
    </main>
    <div class="loe-inbox-vsplit" data-col="side" role="separator" aria-orientation="vertical" aria-label="拖拉調整司機對話與記事本欄寬度" title="拖拉調整寬度，雙擊回到預設"></div>
    <aside class="loe-inbox-side" hidden aria-label="司機對話與記事本">
      <div class="loe-inbox-side-bar"><span class="loe-inbox-spacer"></span><button type="button" class="loe-inbox-x loe-inbox-col-toggle" data-col-toggle="side" title="收起司機對話與記事本" aria-label="收起司機對話與記事本">${ic("chevron-right")}</button></div>
      <div class="loe-inbox-side-empty" hidden></div>
      <div class="loe-inbox-side-split" hidden role="separator" aria-orientation="horizontal" aria-label="拖拉調整司機對話與記事本的高度" title="拖拉調整高度，雙擊回到預設"></div>
      <aside class="loe-inbox-notes" hidden aria-label="記事本"></aside>
    </aside>
  </div>
  <section class="loe-board" hidden aria-label="訂單看板">
    <div class="loe-board-bar"></div>
    <div class="loe-board-main">
      <div class="loe-board-cols"></div>
      <aside class="loe-board-drawer" hidden aria-label="訂單細節"></aside>
    </div>
  </section>
  <div class="loe-inbox-modal" hidden></div>
  <div class="loe-inbox-toasts" aria-live="polite"></div>
  <aside class="loe-inbox-notif" hidden aria-label="通知清單"></aside>
</div>
</body>`;
}

export { inboxTakeover };
