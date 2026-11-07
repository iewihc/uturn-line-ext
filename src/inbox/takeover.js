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
  /* 收件匣配色 token：亮色＝原本的顏色；暗色在選項「外觀」切換（html[data-loe-theme="dark"]） */
  html { color-scheme: light; --loe-oa-mix: 0%; --loe-bg: #f4f6f8; --loe-paper: #fff; --loe-raise: #f9fafb; --loe-raise2: #f1f5f9; --loe-line: rgba(145,158,171,.24); --loe-border: #d5dbe5; --loe-border-strong: #b6c2d6; --loe-fg: #212b36; --loe-fg2: #454f5b; --loe-muted: #6b7280; --loe-faint: #9ca3af; --loe-primary: #00a76f; --loe-primary-dark: #1b806a; --loe-primary-btn: #1b806a; --loe-primary-btn-hover: #16695a; --loe-primary-soft: #e6f6ef; --loe-teal: #0f766e; --loe-info: #2f5fd0; --loe-info-soft: #e8eefb; --loe-info-line: rgba(28,108,243,.35); --loe-out: #e9f0ff; --loe-warn: #b45309; --loe-warn-soft: #fffbeb; --loe-warn-line: #fde68a; --loe-error: #b91c1c; --loe-error-soft: #fee2e2; --loe-error-line: #fecaca; --loe-ai: #6366f1; --loe-ai-line: #c7d2fe; --loe-glass: rgba(255,255,255,.92); }
  html[data-loe-theme="dark"] { color-scheme: dark; --loe-oa-mix: 55%; --loe-bg: #141a21; --loe-paper: #1c252e; --loe-raise: #212b36; --loe-raise2: #28323d; --loe-line: rgba(145,158,171,.2); --loe-border: rgba(145,158,171,.32); --loe-border-strong: rgba(145,158,171,.5); --loe-fg: #f4f6f8; --loe-fg2: #c4cdd5; --loe-muted: #919eab; --loe-faint: #637381; --loe-primary: #5be49b; --loe-primary-dark: #5be49b; --loe-primary-btn: #00a76f; --loe-primary-btn-hover: #00b97a; --loe-primary-soft: #1f3a30; --loe-teal: #5eead4; --loe-info: #8fb4ff; --loe-info-soft: #22304a; --loe-info-line: rgba(143,180,255,.5); --loe-out: #22304a; --loe-warn: #ffd666; --loe-warn-soft: #3a3220; --loe-warn-line: rgba(255,214,102,.45); --loe-error: #ffac82; --loe-error-soft: #3d2626; --loe-error-line: rgba(255,172,130,.45); --loe-ai: #b4b9ff; --loe-ai-line: rgba(180,185,255,.45); --loe-glass: rgba(28,37,46,.92); }
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.5 "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif; color: var(--loe-fg); background: var(--loe-bg); }
  button, input, textarea { font: inherit; }
  .loe-inbox input:not([type="checkbox"]), .loe-inbox textarea, .loe-inbox select { background: var(--loe-paper); color: var(--loe-fg); }
  .loe-inbox ::placeholder { color: var(--loe-faint); }
  a { color: var(--loe-primary); }
  .loe-inbox { position: relative; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .loe-inbox [hidden] { display: none !important; }
  .loe-inbox-top { flex: 0 0 auto; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; min-height: 56px; padding: 6px 20px; background: var(--loe-paper); border-bottom: 1px solid var(--loe-line); }
  .loe-inbox-brand { display: flex; align-items: center; gap: 10px; }
  .loe-inbox-brand strong { font-size: 16px; }
  .loe-inbox-logo { width: 28px; height: 28px; border-radius: 8px; background: #00a76f; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-logo svg, .loe-inbox-btn svg, .loe-inbox-x svg, .loe-inbox-rail-strip svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-stats { display: flex; align-items: center; gap: 8px; }
  .loe-inbox-muted { font-size: 12px; color: var(--loe-muted); }
  .loe-inbox-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 7px; border-radius: 10px; background: var(--loe-error-soft); color: var(--loe-error); font-size: 12px; font-weight: 700; white-space: nowrap; }
  .loe-inbox-spacer { flex: 1 1 auto; }
  .loe-inbox-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .loe-inbox-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--loe-border); background: var(--loe-paper); color: var(--loe-fg); font-size: 13px; cursor: pointer; text-decoration: none; white-space: nowrap; }
  .loe-inbox-btn:hover { background: var(--loe-raise); border-color: var(--loe-border-strong); }
  .loe-inbox-btn:disabled { opacity: .5; cursor: default; }
  .loe-inbox-btn.on { background: var(--loe-primary-soft); border-color: var(--loe-primary); color: var(--loe-primary); }
  .loe-inbox-btn.warn { background: var(--loe-warn-soft); border-color: #f59e0b; color: var(--loe-warn); font-weight: 600; }
  .loe-inbox-btn.primary { background: var(--loe-primary-btn); border-color: var(--loe-primary); color: #fff; font-weight: 600; }
  .loe-inbox-btn.primary:hover { background: var(--loe-primary-btn-hover); }
  .loe-inbox-hint { font-size: 12px; color: var(--loe-warn); background: var(--loe-warn-soft); padding: 2px 8px; border-radius: 10px; }
  .loe-inbox-body { flex: 1 1 auto; display: flex; align-items: stretch; min-height: 0; }
  /* 欄與欄之間的直分隔線：6px 寬、疊在邊框上，拖拉改左邊那欄（右側欄則改右邊）的寬度 */
  .loe-inbox-vsplit { flex: 0 0 6px; margin: 0 -3px; position: relative; z-index: 3; cursor: col-resize; touch-action: none; user-select: none; }
  .loe-inbox-vsplit::before { content: ""; position: absolute; top: 50%; left: 50%; width: 4px; height: 28px; margin: -14px 0 0 -2px; border-left: 1px solid var(--loe-border-strong); border-right: 1px solid var(--loe-border-strong); opacity: .8; }
  .loe-inbox-vsplit:hover, .loe-inbox-vsplit.dragging { background: rgba(28,108,243,.15); }
  .loe-inbox-vsplit:hover::before, .loe-inbox-vsplit.dragging::before { border-color: var(--loe-primary); }
  .loe-inbox-rail.collapsed + .loe-inbox-vsplit, .loe-inbox-body:has(> .loe-inbox-side[hidden]) > .loe-inbox-vsplit[data-col="side"] { display: none; }
  @media (max-width: 960px) { .loe-inbox-vsplit { display: none; } }
  .loe-inbox-gate { position: absolute; top: 56px; left: 0; right: 0; bottom: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--loe-bg); }
  .loe-inbox-gate[hidden] { display: none; }
  .loe-inbox-gate-box { display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 460px; padding: 32px 28px; background: var(--loe-paper); border: 1px solid var(--loe-line); border-radius: 16px; box-shadow: 0 12px 40px rgba(15,23,42,.08); text-align: center; }
  .loe-inbox-gate-box strong { font-size: 17px; color: var(--loe-fg); }
  .loe-inbox-gate-box p { margin: 0; color: var(--loe-muted); font-size: 13px; line-height: 1.6; }
  .loe-inbox-gate-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--loe-warn-soft); color: var(--loe-warn); display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-gate-icon svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-gate-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .loe-inbox-terms { width: min(880px, calc(100vw - 32px)); max-width: none; max-height: calc(100vh - 32px); max-height: calc(100dvh - 32px); margin: auto; padding: 0; border: 1px solid var(--loe-line); border-radius: 16px; background: var(--loe-paper); color: var(--loe-fg); box-shadow: 0 24px 80px rgba(15,23,42,.24); overflow: hidden; }
  .loe-inbox-terms[open] { display: flex; flex-direction: column; }
  .loe-inbox-terms::backdrop { background: rgba(15,23,42,.5); }
  .loe-inbox-terms-head { flex: 0 0 auto; padding: 22px 28px 16px; border-bottom: 1px solid var(--loe-line); }
  .loe-inbox-terms-head h1 { margin: 0; font-size: 20px; line-height: 1.5; }
  .loe-inbox-terms-head p { margin: 8px 0 0; color: var(--loe-muted); font-size: 13px; }
  .loe-inbox-terms-body { flex: 1 1 auto; min-height: 0; padding: 8px 28px 20px; overflow-y: auto; overscroll-behavior: contain; line-height: 1.85; overflow-wrap: anywhere; }
  .loe-inbox-terms-body h2 { margin: 24px 0 10px; font-size: 16px; }
  .loe-inbox-terms-body p { margin: 12px 0; }
  .loe-inbox-terms-body a { text-underline-offset: 3px; }
  .loe-inbox-terms-highlight { padding: 2px 5px; border-radius: 4px; background: #fef08a; color: #991b1b; font-weight: 800; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .loe-inbox-terms-foot { flex: 0 0 auto; display: flex; align-items: center; flex-wrap: wrap; gap: 12px 20px; padding: 16px 28px; border-top: 1px solid var(--loe-line); background: var(--loe-raise); }
  .loe-inbox-terms-agree { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; cursor: pointer; }
  .loe-inbox-terms-agree input { width: 18px; height: 18px; margin: 0; accent-color: var(--loe-primary); }
  .loe-inbox-terms-actions { display: flex; gap: 8px; margin-left: auto; }
  .loe-inbox-terms-error { flex-basis: 100%; margin: 0; color: var(--loe-error); font-size: 13px; }
  @media (max-width: 600px) {
    .loe-inbox-terms { width: calc(100vw - 16px); max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); border-radius: 12px; }
    .loe-inbox-terms-head, .loe-inbox-terms-foot { padding: 14px 16px; }
    .loe-inbox-terms-head h1 { font-size: 17px; }
    .loe-inbox-terms-body { padding: 0 16px 12px; }
    .loe-inbox-terms-actions { flex-wrap: wrap; }
  }
  @media (max-width: 960px) { .loe-inbox { height: auto; min-height: 100vh; overflow: visible; } .loe-inbox-body { flex-wrap: wrap; } }
  .loe-inbox-rail { flex: 0 0 272px; min-width: 0; min-height: 0; background: var(--loe-bg); border-right: 1px solid var(--loe-line); display: flex; flex-direction: column; }
  .loe-inbox-rail-head, .loe-inbox-list-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; font-size: 13px; color: var(--loe-fg2); }
  .loe-inbox-rail-head span, .loe-inbox-list-head span { font-size: 11px; color: var(--loe-muted); }
  .loe-inbox-rail-head { gap: 8px; }
  .loe-inbox-rail-head strong { margin-right: auto; }
  /* 左欄收起：只剩一條可點的直條（監聽與通知照常），再點展開 */
  .loe-inbox-rail.collapsed { flex-basis: 40px !important; }
  .loe-inbox-rail.collapsed > :not(.loe-inbox-rail-strip) { display: none; }
  .loe-inbox-rail-strip { display: none; }
  .loe-inbox-rail.collapsed .loe-inbox-rail-strip { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; height: 100%; padding: 12px 0; border: 0; background: transparent; color: var(--loe-fg2); cursor: pointer; }
  .loe-inbox-rail-strip:hover { background: var(--loe-raise); }
  .loe-inbox-rail-strip-text { writing-mode: vertical-rl; font-size: 12px; letter-spacing: 2px; }
  /* 其他欄位收起：同官方帳號欄，收成 40px 的窄條（直排欄名＋箭頭），點一下展開 */
  .loe-inbox-col-strip { display: none; }
  .loe-inbox-list.collapsed, .loe-inbox-thread.collapsed, .loe-inbox-side.collapsed { flex: 0 0 40px !important; width: 40px !important; min-width: 40px; background: var(--loe-paper); }
  .loe-inbox-list.collapsed > :not(.loe-inbox-col-strip), .loe-inbox-thread.collapsed > :not(.loe-inbox-col-strip), .loe-inbox-side.collapsed > :not(.loe-inbox-col-strip) { display: none !important; }
  .collapsed > .loe-inbox-col-strip { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; height: 100%; padding: 12px 0; border: 0; background: transparent; color: var(--loe-fg2); cursor: pointer; }
  .loe-inbox-col-strip:hover { background: var(--loe-raise); }
  .loe-inbox-col-strip svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-list.collapsed + .loe-inbox-vsplit, .loe-inbox-thread.collapsed + .loe-inbox-vsplit, .loe-inbox-body:has(> .loe-inbox-side.collapsed) > .loe-inbox-vsplit[data-col="side"] { display: none; }
  .loe-inbox-thread.collapsed { border-right: 1px solid var(--loe-line); }
  .loe-inbox-list-head .loe-inbox-col-toggle { margin-left: auto; }
  .loe-inbox-list-head > span { margin-left: auto; }
  .loe-inbox-list-head > span + .loe-inbox-col-toggle { margin-left: 6px; }
  .loe-inbox-side-bar { flex: 0 0 auto; display: flex; align-items: center; height: 28px; padding: 0 6px; border-bottom: 1px solid var(--loe-line); background: var(--loe-raise); }
  .loe-inbox-search { margin: 0 12px 10px; height: 34px; padding: 0 10px; border: 1px solid var(--loe-border); border-radius: 8px; font-size: 13px; }
  .loe-inbox-rail-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding: 0 8px 12px; }
  .loe-inbox-rail-foot { flex: 0 0 auto; padding: 10px 12px 10px 16px; border-top: 1px solid var(--loe-line); font-size: 11px; color: var(--loe-muted); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .loe-inbox-rail-foot-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .loe-inbox-rail-foot-all { display: flex; gap: 2px; flex: 0 0 auto; }
  .loe-inbox-rail-foot-all .loe-inbox-x.on { color: var(--loe-primary); }
  .loe-inbox-rail-foot strong { color: var(--loe-fg); }
  .loe-inbox-oa { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; }
  .loe-inbox-oa.on { background: var(--loe-paper); box-shadow: 0 1px 1px rgba(15,23,42,.05); }
  .loe-inbox-oa:hover { background: var(--loe-glass); }
  .loe-inbox-oa-avatar { width: 32px; height: 32px; border-radius: 9px; flex: 0 0 auto; object-fit: cover; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; }
  .loe-inbox-oa-main { flex: 1 1 auto; min-width: 0; }
  .loe-inbox-oa-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--loe-muted); }
  .loe-inbox-oa.on .loe-inbox-oa-name { color: var(--loe-fg); }
  .loe-inbox-oa-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--loe-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
  .loe-inbox-oa-status.live { color: var(--loe-primary-dark); }
  .loe-inbox-oa-status.connecting { color: var(--loe-warn); }
  .loe-inbox-oa-status.poll { color: var(--loe-info); }
  .loe-inbox-oa-status.error { color: var(--loe-error); }
  .loe-inbox-oa-status.limit { color: var(--loe-warn); }
  .loe-inbox-stat-limit { color: var(--loe-warn); }
  .loe-inbox-switch { width: 38px; height: 22px; border-radius: 11px; border: 0; padding: 2px; background: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: flex-start; flex: 0 0 auto; }
  .loe-inbox-switch[aria-checked="true"] { background: #00a76f; justify-content: flex-end; }
  .loe-inbox-knob { width: 18px; height: 18px; border-radius: 50%; background: var(--loe-paper); box-shadow: 0 1px 2px rgba(0,0,0,.25); }
  .loe-inbox-empty { padding: 28px 16px; text-align: center; color: var(--loe-muted); font-size: 13px; }
  .loe-inbox-empty.err { color: var(--loe-error); }
  .loe-inbox-list { flex: 0 0 400px; min-width: 0; min-height: 0; background: var(--loe-bg); border-right: 1px solid var(--loe-line); display: flex; flex-direction: column; }
  /* 篩選列：緊湊、一排不換行（超出可左右滑、不顯示捲軸） */
  .loe-inbox-filters { flex: 0 0 auto; display: flex; gap: 4px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding: 0 12px 6px; }
  .loe-inbox-filters::-webkit-scrollbar { display: none; }
  .loe-inbox-chip { flex: 0 0 auto; height: 24px; padding: 0 9px; border-radius: 12px; border: 1px solid var(--loe-border); background: var(--loe-paper); color: var(--loe-fg2); font-size: 12px; line-height: 1; white-space: nowrap; cursor: pointer; display: inline-flex; align-items: center; }
  .loe-inbox-chip.on { background: var(--loe-primary-btn); border-color: var(--loe-primary); color: #fff; }
  .loe-inbox-rows { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; }
  .loe-inbox-row { display: flex; gap: 10px; align-items: flex-start; text-align: left; width: 100%; padding: 10px 14px; border: 0; border-bottom: 1px solid var(--loe-line); border-left: 3px solid transparent; background: var(--loe-paper); cursor: pointer; color: var(--loe-fg); }
  .loe-inbox-row:hover { background: var(--loe-raise); }
  .loe-inbox-row.selected { background: var(--loe-primary-soft); }
  .loe-inbox-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--loe-raise2); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: var(--loe-muted); flex: 0 0 auto; }
  .loe-inbox-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .loe-inbox-row-top, .loe-inbox-row-mid, .loe-inbox-row-meta { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .loe-inbox-oa-chip { font-size: 11px; padding: 0 6px; line-height: 18px; border-radius: 4px; background: transparent; color: color-mix(in srgb, #fff var(--loe-oa-mix), var(--oa, #637381)); border: 1px solid color-mix(in srgb, var(--oa, #637381) 60%, transparent); font-weight: 700; white-space: nowrap; flex: 0 0 auto; }
  .loe-inbox-row-name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0; }
  .loe-inbox-row-time { font-size: 11px; color: var(--loe-muted); white-space: nowrap; }
  .loe-inbox-pin { display: inline-flex; flex: 0 0 auto; color: var(--loe-primary); }
  .loe-inbox-pin svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-row-preview { flex: 1 1 auto; min-width: 0; color: var(--loe-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-unread { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #dc2626; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
  .loe-inbox-unread.dot { min-width: 10px; width: 10px; height: 10px; padding: 0; }
  /* 標籤（B2）：不填色，只留 1px 同色框＋同色粗體字；顏色用 admin 語意色 */
  .loe-inbox-tag { font-size: 11px; padding: 0 6px; line-height: 18px; border-radius: 4px; background: transparent; border: 1px solid currentColor; color: var(--loe-warn); font-weight: 700; }
  .loe-inbox-tag { border-color: color-mix(in srgb, currentColor 55%, transparent); }
  .loe-inbox-tag.done { color: var(--loe-muted); }
  .loe-inbox-tag.ord { color: var(--loe-muted); }
  .loe-inbox-tag.ord.booking { color: var(--loe-ai); }
  .loe-inbox-tag.ord.pending { color: var(--loe-warn); }
  .loe-inbox-tag.ord.accepted { color: var(--loe-info); }
  .loe-inbox-tag.ord.arrived { color: var(--loe-primary-dark); }
  .loe-inbox-tag.ord.executing { color: var(--loe-teal); }
  .loe-inbox-order-filters { padding-top: 0; }
  .loe-inbox-chip .n { margin-left: 4px; opacity: .75; }
  .loe-inbox-chip-refresh { width: 26px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--loe-muted); }
  .loe-inbox-chip-refresh svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-chip-refresh:disabled { opacity: .6; cursor: progress; }
  .loe-inbox-chip-fold { width: 26px; padding: 0; justify-content: center; color: var(--loe-muted); gap: 3px; }
  .loe-inbox-chip-fold[aria-expanded="false"] { width: auto; padding: 0 9px 0 6px; }
  .loe-inbox-chip-fold.on { color: #fff; }
  .loe-inbox-chip-fold-icon { display: inline-flex; }
  .loe-inbox-chip-fold svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-chip-refresh:disabled svg { animation: loe-inbox-spin 1s linear infinite; }
  @keyframes loe-inbox-spin { to { transform: rotate(360deg); } }
  .loe-inbox-tag.ai { color: var(--loe-ai); }
  .loe-inbox-tag.group { background: var(--loe-primary-soft); color: var(--loe-primary); border: 1px solid var(--loe-info-line); font-weight: 600; }
  .loe-inbox-row-top > .loe-inbox-tag { flex: 0 0 auto; white-space: nowrap; } /* 群編不換行、不被擠扁；名字太長用 … 縮 */
  .loe-inbox-prefix { color: var(--loe-primary); border-color: var(--loe-info-line); font-weight: 600; }
  .loe-inbox-prefix.empty { color: var(--loe-muted); font-weight: 400; }
  .loe-inbox-tag.ai-on { color: var(--loe-ai); }
  .loe-inbox-tag.ai-human { color: var(--loe-warn); }
  .loe-inbox-tag.handoff { color: var(--loe-error); font-weight: 700; } /* 轉人工通知（同後台調度中心紅色轉人工列） */
  .loe-inbox-tag.ai-unmatched { color: var(--loe-muted); }
  .loe-inbox-oa-name { display: flex; align-items: center; gap: 5px; }
  .loe-inbox-oa-name > .loe-inbox-oa-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-oa-name > .loe-inbox-tag { flex: 0 0 auto; }
  .loe-inbox-oa-status > .loe-inbox-tag.ai { padding: 0 5px; line-height: 16px; }
  .loe-inbox-thread { flex: 1 1 560px; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--loe-bg); position: relative; }
  .loe-inbox-notes { position: absolute; top: 57px; right: 0; bottom: 0; width: min(340px, 100%); background: var(--loe-bg); border-left: 1px solid var(--loe-line); box-shadow: -6px 0 18px rgba(15,23,42,.08); display: flex; flex-direction: column; z-index: 4; }
  .loe-inbox-notes-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--loe-line); }
  .loe-inbox-note-add { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; border-bottom: 1px solid var(--loe-line); align-items: flex-end; }
  .loe-inbox-note-input { width: 100%; box-sizing: border-box; resize: vertical; padding: 8px 10px; border: 1px solid var(--loe-border); border-radius: 8px; font-size: 13px; }
  .loe-inbox-notes-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
  .loe-inbox-note { background: var(--loe-warn-soft); border: 1px solid #fde68a; border-radius: 10px; padding: 8px 10px; }
  .loe-inbox-note-body { white-space: pre-wrap; word-break: break-word; }
  .loe-inbox-note-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: var(--loe-warn); }
  .loe-inbox-note-del { border: 0; background: transparent; color: var(--loe-error); font-size: 11px; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
  .loe-inbox-note-del:hover { background: var(--loe-error-soft); }
  .loe-inbox-note-del.edit { color: var(--loe-primary); }
  .loe-inbox-note-del.edit:hover { background: var(--loe-info-soft); }
  .loe-inbox-note.editing .loe-inbox-note-input { background: var(--loe-paper); }
  .loe-inbox-note-edit-actions { display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 6px; }
  .loe-inbox-rename { height: 32px; padding: 0 10px; border: 1px solid var(--loe-primary); border-radius: 8px; font-size: 14px; min-width: 180px; }
  .loe-inbox-rename-btn { color: var(--loe-faint); }
  .loe-inbox-rename-btn:hover { color: var(--loe-primary); }
  .loe-inbox-th-head { flex: 0 0 auto; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 44px 10px 20px; background: var(--loe-paper); border-bottom: 1px solid var(--loe-line); position: relative; }
  .loe-inbox-th-head > .loe-inbox-col-toggle { position: absolute; top: 10px; right: 12px; } /* 收起「聊天」欄的箭頭固定在右上角，不佔一行 */
  /* 聊天欄不夠寬時（例如三欄都開、視窗小），標頭按鈕只留 icon，文字收進 title，避免換行擠成兩排 */
  .loe-inbox-thread { container-type: inline-size; }
  @container (max-width: 720px) {
    .loe-inbox-th-head { gap: 8px; padding-right: 40px; }
    .loe-inbox-th-head .loe-inbox-btn > span { display: none; }
    .loe-inbox-th-head .loe-inbox-btn { padding: 0 9px; gap: 0; }
  }
  .loe-inbox-th-head .loe-inbox-avatar { width: 36px; height: 36px; }
  /* 對話內訊息搜尋列（標題列下方）＋結果下拉 */
  .loe-inbox-msearch { flex: 0 0 auto; position: relative; display: flex; align-items: center; gap: 6px; padding: 8px 20px; background: var(--loe-paper); border-bottom: 1px solid var(--loe-line); }
  .loe-inbox-msearch-icon { display: inline-flex; color: var(--loe-muted); }
  .loe-inbox-msearch-icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-msearch-input { flex: 1 1 auto; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--loe-primary); border-radius: 8px; font: inherit; font-size: 13px; }
  .loe-inbox-msearch-count { font-size: 12px; color: var(--loe-muted); white-space: nowrap; min-width: 2em; text-align: center; }
  .loe-inbox-msearch .loe-inbox-x:disabled { opacity: .35; cursor: default; }
  .loe-inbox-msearch-list { position: absolute; top: 100%; left: 44px; right: 120px; max-height: min(360px, 50vh); overflow-y: auto; background: var(--loe-paper); border: 1px solid var(--loe-line); border-radius: 10px; box-shadow: 0 12px 30px rgba(15,23,42,.18); z-index: 6; display: flex; flex-direction: column; padding: 4px; gap: 2px; }
  .loe-inbox-msearch-item { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; font: inherit; cursor: pointer; }
  .loe-inbox-msearch-item:hover, .loe-inbox-msearch-item.on { background: var(--loe-info-soft); }
  .loe-inbox-msearch-who { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--loe-muted); }
  .loe-inbox-msearch-who strong { color: var(--loe-fg); }
  .loe-inbox-msearch-snippet { font-size: 13px; color: var(--loe-fg2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-msearch-snippet mark.loe-hit { background: transparent; color: var(--loe-primary); font-weight: 700; }
  mark.loe-hit { background: var(--loe-warn-line); color: inherit; padding: 0; border-radius: 2px; }
  .loe-inbox-msg.hit .loe-inbox-bubble { box-shadow: 0 0 0 2px #f59e0b; }
  .loe-inbox-th-title { min-width: 0; }
  .loe-inbox-th-name { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .loe-inbox-th-msgs { flex: 1 1 auto; min-height: 0; padding: 20px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
  .loe-inbox-th-empty { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; color: var(--loe-muted); }
  .loe-inbox-day { align-self: center; font-size: 11px; color: var(--loe-muted); background: var(--loe-raise2); padding: 2px 10px; border-radius: 10px; }
  .loe-inbox-msg { display: flex; flex-direction: column; gap: 2px; max-width: 68%; }
  .loe-inbox-msg.in { align-self: flex-start; align-items: flex-start; }
  .loe-inbox-msg.out { align-self: flex-end; align-items: flex-end; }
  .loe-inbox-bubble { padding: 9px 13px; border-radius: 14px; background: var(--loe-paper); color: var(--loe-fg); border: 1px solid var(--loe-line); white-space: pre-wrap; word-break: break-word; box-shadow: 0 1px 1px rgba(0,0,0,.05); }
  .loe-inbox-msg.out .loe-inbox-bubble { background: var(--loe-out); color: var(--loe-fg); border: 1px solid rgba(64,127,255,.45); }
  .loe-inbox-msg.failed .loe-inbox-bubble { background: var(--loe-error-soft); color: #991b1b; }
  .loe-inbox-bubble.media { padding: 4px; background: var(--loe-paper); }
  .loe-inbox-bubble.media.loe-has-forward { padding: 9px 13px; } /* 位置訊息：留位置給右上角派車／複製 */
  .loe-inbox-msg.out .loe-inbox-bubble.media { background: var(--loe-paper); color: var(--loe-fg); }
  .loe-inbox-media-link { display: block; line-height: 0; }
  .loe-inbox-media-img { max-width: 260px; max-height: 260px; border-radius: 10px; display: block; object-fit: contain; }
  .loe-inbox-media-video { max-width: 320px; max-height: 260px; border-radius: 10px; display: block; background: #000; }
  .loe-inbox-media-audio { display: block; width: 260px; }
  .loe-inbox-media-sticker { width: 120px; height: 120px; object-fit: contain; display: block; }
  .loe-inbox-media-file { display: inline-block; padding: 6px 10px; color: var(--loe-primary); text-decoration: none; word-break: break-all; }
  .loe-inbox-media-file:hover { text-decoration: underline; }
  .loe-inbox-media-expired { display: inline-block; padding: 6px 10px; color: var(--loe-muted); font-size: 12px; }
  .loe-inbox-link { color: inherit; text-decoration: underline; text-underline-offset: 2px; word-break: break-all; }
  .loe-inbox-link:hover { opacity: .85; }
  .loe-inbox-msg.in .loe-inbox-link, .loe-inbox-msg.out .loe-inbox-link, .loe-inbox-msg.card .loe-inbox-link { color: var(--loe-info); }
  .loe-inbox-msg.card .loe-inbox-bubble { background: var(--loe-info-soft); color: var(--loe-ai); border: 1px solid var(--loe-ai-line); border-left: 4px solid #6366f1; border-radius: 10px 14px 14px 10px; }
  .loe-inbox-msg.card .loe-inbox-msg-meta { color: var(--loe-ai); }
  .loe-inbox-card-label { display: block; font-size: 11px; font-weight: 700; color: var(--loe-ai); margin-bottom: 4px; letter-spacing: .02em; }
  .loe-inbox-msg.card .loe-copy-button, .loe-inbox-msg.card .loe-forward-button { color: var(--loe-ai); }
  .loe-inbox-msg-meta { font-size: 11px; color: var(--loe-faint); }
  .loe-inbox-msg .loe-copy-button, .loe-inbox-msg .loe-forward-button { opacity: .85; }
  .loe-inbox-msg.out .loe-copy-button, .loe-inbox-msg.out .loe-forward-button { background: var(--loe-glass); }
  .loe-inbox-bubble.loe-has-forward { min-width: 96px; }
  .loe-inbox-ai-slot { display: inline-flex; align-items: center; }
  .loe-inbox-sysnoti.on { background: var(--loe-primary-soft); border-color: var(--loe-primary); color: var(--loe-primary-dark); font-weight: 600; }
  .loe-inbox-sysnoti.off { color: var(--loe-muted); }
  .loe-inbox-orders { flex: 0 0 auto; position: relative; display: flex; flex-direction: column; gap: 6px; padding: 8px 48px 8px 20px; background: var(--loe-raise); border-bottom: 1px solid var(--loe-line); font-size: 13px; }
  .loe-inbox-orders.collapsed { padding-top: 5px; padding-bottom: 5px; }
  .loe-inbox-orders-toggle { position: absolute; top: 6px; right: 14px; }
  .loe-inbox-orders.collapsed .loe-inbox-orders-toggle { top: 3px; }
  .loe-ord-summary { gap: 4px 14px; }
  .loe-ord-mini { display: inline-flex; align-items: center; gap: 6px; }
  .loe-inbox-orders .err { color: var(--loe-error); }
  .loe-inbox-sysnoti:disabled { opacity: 1; }
  .loe-inbox-dchat { position: absolute; top: 57px; right: 0; bottom: 0; width: min(400px, 100%); background: var(--loe-bg); border-left: 1px solid var(--loe-line); box-shadow: -6px 0 18px rgba(15,23,42,.08); display: flex; flex-direction: column; z-index: 5; }
  .loe-inbox-dchat.dock { position: static; flex: 0 0 400px; width: 400px; min-height: 0; box-shadow: none; }
  .loe-inbox-dchat.dock .loe-dchat-title { cursor: default; }
  @media (max-width: 1400px) { .loe-inbox-dchat.dock { flex-basis: 340px; width: 340px; } }
  /* 右欄：上半司機對話（停靠）、下半記事本，中間可拖拉 */
  .loe-inbox-side { flex: 0 0 400px; width: 400px; min-height: 0; display: flex; flex-direction: column; border-left: 1px solid var(--loe-line); background: var(--loe-bg); }
  @media (max-width: 1400px) { .loe-inbox-side { flex-basis: 340px; width: 340px; } }
  .loe-inbox-side .loe-inbox-dchat.dock { flex: 1 1 auto; width: auto; border-left: 0; }
  .loe-inbox-side.split .loe-inbox-dchat.dock { flex: 0 0 55%; }
  .loe-inbox-side .loe-inbox-notes { position: static; width: auto; flex: 1 1 auto; min-height: 0; border-left: 0; box-shadow: none; }
  .loe-inbox-side .loe-inbox-notes.collapsed { flex: 0 0 auto; }
  .loe-inbox-side .loe-inbox-dchat.dock + .loe-inbox-side-split[hidden] + .loe-inbox-notes { border-top: 1px solid var(--loe-line); }
  .loe-inbox-notes-title { cursor: pointer; }
  /* 記事本放大：固定定位蓋在訊息串上（右欄原位留空），寬度最多 960px */
  .loe-inbox-side .loe-inbox-notes.max { position: fixed; top: var(--loe-notes-top, 57px); right: 0; bottom: 0; left: auto; width: min(960px, 100vw); z-index: 60; border-left: 1px solid var(--loe-line); box-shadow: -12px 0 32px rgba(15,23,42,.18); }
  .loe-inbox-notes.max .loe-inbox-notes-list { padding: 14px 20px; }
  .loe-inbox-notes.max .loe-inbox-note-input { min-height: 72px; }
  .loe-inbox-side-split { flex: 0 0 8px; cursor: row-resize; background: var(--loe-raise2); border-block: 1px solid var(--loe-line); touch-action: none; position: relative; }
  .loe-inbox-side-split::after { content: ""; position: absolute; left: 50%; top: 2px; width: 36px; height: 3px; margin-left: -18px; border-radius: 2px; background: #94a3b8; }
  .loe-inbox-side-empty { padding: 12px 14px; font-size: 13px; color: var(--loe-muted); background: var(--loe-raise); border-bottom: 1px solid var(--loe-line); }
  /* 右上「選項」 */
  .loe-inbox-options { position: relative; }
  .loe-inbox-options-menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 30; width: 320px; background: var(--loe-paper); border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,.2); padding: 6px; display: flex; flex-direction: column; gap: 2px; max-height: calc(100vh - 80px); overflow-y: auto; overscroll-behavior: contain; }
  .loe-inbox-options-menu > * { flex: 0 0 auto; } /* 選項多到超過視窗時在選單內捲動，不被切掉 */
  .loe-inbox-options-group { padding: 8px 10px 4px; font-size: 12px; font-weight: 700; color: var(--loe-muted); }
  .loe-inbox-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 4px 10px; border-radius: 8px; cursor: pointer; }
  .loe-inbox-option:hover { background: var(--loe-primary-soft); }
  .loe-inbox-option input { width: 18px; height: 18px; accent-color: var(--loe-primary); flex: none; }
  .loe-inbox-option-icon { flex: none; width: 20px; height: 20px; color: var(--loe-muted); display: flex; }
  .loe-inbox-option-icon svg { width: 20px; height: 20px; }
  .loe-inbox-option:has(input:checked) .loe-inbox-option-icon { color: var(--loe-primary); }
  .loe-inbox-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 14px; color: var(--loe-fg); }
  .loe-inbox-option-text small { font-size: 12px; color: var(--loe-muted); }
  /* 配色：三段切換鈕另起一行放在說明下面，不跟說明擠同一行 */
  .loe-inbox-option.stack { flex-wrap: wrap; }
  .loe-inbox-option.stack .loe-inbox-seg { flex-basis: 100%; margin-left: 32px; justify-content: stretch; }
  .loe-inbox-option.stack .loe-inbox-seg button { flex: 1 1 0; }
  img.loe-inbox-avatar { object-fit: cover; }
  .loe-inbox-msg.failed .loe-inbox-msg-meta { color: var(--loe-error); }
  .loe-inbox-composer { flex: 0 0 auto; padding: 10px 20px 16px; background: var(--loe-paper); border-top: 1px solid var(--loe-line); display: flex; flex-direction: column; gap: 8px; }
  /* 訊息串與輸入區之間的分隔條：拖拉調整輸入框高度（記住），雙擊回預設；和右欄的 side-split 同款 */
  .loe-inbox-th-split { flex: 0 0 8px; margin: -11px -20px 0; cursor: row-resize; background: var(--loe-raise2); border-block: 1px solid var(--loe-line); touch-action: none; user-select: none; position: relative; }
  .loe-inbox-th-split::after { content: ""; position: absolute; left: 50%; top: 2px; width: 36px; height: 3px; margin-left: -18px; border-radius: 2px; background: #94a3b8; }
  .loe-inbox-th-split:hover, .loe-inbox-th-split.dragging { background: rgba(28,108,243,.15); }
  .loe-inbox-th-split:hover::after, .loe-inbox-th-split.dragging::after { background: var(--loe-primary); }
  .loe-inbox-composer-row { display: flex; gap: 10px; align-items: flex-end; }
  /* 回覆（引用）：輸入框上方的引用條（同 LINE 聊天室）；泡泡內的引用塊 */
  .loe-inbox-reply { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-left: 3px solid var(--loe-primary); border-radius: 6px; background: var(--loe-info-soft); font-size: 12px; }
  .loe-inbox-reply-body { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
  .loe-inbox-reply-text { color: var(--loe-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-quote { display: block; margin-bottom: 4px; padding: 4px 8px; border-left: 3px solid rgba(0,0,0,.25); border-radius: 4px; background: rgba(0,0,0,.06); font-size: 12px; opacity: .85; max-width: 100%; overflow: hidden; }
  .loe-inbox-quote strong { display: block; font-size: 11px; }
  .loe-inbox-quote span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .loe-inbox-msg.out .loe-inbox-bubble:not(.media) .loe-inbox-quote { border-left-color: #407fff; background: rgba(64,127,255,.1); }
  .loe-inbox-textarea { flex: 1 1 auto; min-width: 0; min-height: 60px; resize: vertical; padding: 10px 12px; border: 1px solid var(--loe-border); border-radius: 10px; font-size: 14px; line-height: 1.5; }
  .loe-inbox-composer-btns { display: flex; flex-direction: column; gap: 6px; align-self: stretch; justify-content: flex-end; }
  .loe-inbox-dispatch { height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid #f97316; background: var(--loe-paper); color: var(--loe-warn); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
  .loe-inbox-dispatch:hover { background: var(--loe-warn-soft); }
  .loe-inbox-dispatch svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-send { height: 40px; padding: 0 16px; border-radius: 10px; border: 0; background: #00a76f; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
  .loe-inbox-send:hover { background: #007867; }
  .loe-inbox-send:disabled { opacity: .6; cursor: progress; }
  /* 輸入框下方一排：左邊三顆圖示、右邊待處理／處理完畢／開啟官方，擠不下就縮小、再擠不下只留圖示（不換行） */
  .loe-inbox-composer { container-type: inline-size; }
  .loe-inbox-tools { display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; min-width: 0; }
  .loe-inbox-tools-right { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; flex-wrap: nowrap; flex: 0 1 auto; min-width: 0; }
  .loe-inbox-tools-right .loe-inbox-btn { height: 28px; padding: 0 8px; gap: 4px; font-size: 12px; }
  @container (max-width: 480px) { .loe-inbox-tools-right .loe-inbox-btn { height: 26px; padding: 0 6px; font-size: 11px; } .loe-inbox-tools-right .loe-inbox-btn svg { width: 14px; height: 14px; } .loe-inbox-tool { width: 28px; } }
  @container (max-width: 360px) { .loe-inbox-tools-right .loe-inbox-btn span { display: none; } .loe-inbox-tools-right .loe-inbox-btn { padding: 0 7px; } }
  .loe-inbox-flag.on { background: var(--loe-primary-soft); border-color: var(--loe-primary); color: var(--loe-primary-dark); font-weight: 600; }
  .loe-inbox-tool { width: 34px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--loe-muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-tool:hover, .loe-inbox-tool.on { background: var(--loe-info-soft); color: var(--loe-primary); }
  .loe-inbox-tool svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-picker { border: 1px solid var(--loe-line); border-radius: 10px; background: var(--loe-raise); display: flex; flex-direction: column; height: 280px; }
  .loe-inbox-picker-tabs { flex: 0 0 auto; display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--loe-line); min-width: 0; }
  .loe-inbox-picker-scroll { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 2px; overflow-x: auto; scrollbar-width: thin; }
  .loe-inbox-picker-close { flex: 0 0 auto; border: 1px solid var(--loe-border); background: var(--loe-paper); }
  .loe-inbox-picker-close:hover { background: var(--loe-raise2); color: var(--loe-fg); }
  .loe-inbox-picker-kind { flex: 0 0 auto; height: 28px; padding: 0 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--loe-muted); font-size: 13px; cursor: pointer; }
  .loe-inbox-picker-kind.on { background: var(--loe-paper); border-color: var(--loe-border); color: var(--loe-fg); font-weight: 600; }
  .loe-inbox-picker-sep { flex: 0 0 auto; width: 1px; height: 22px; margin: 0 6px; background: rgba(145,158,171,.24); }
  .loe-inbox-picker-tab { flex: 0 0 auto; width: 38px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .loe-inbox-picker-tab.on { background: var(--loe-info-soft); }
  .loe-inbox-picker-tab img { width: 26px; height: 26px; object-fit: contain; }
  .loe-inbox-picker-grid { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 4px; padding: 8px; }
  .loe-inbox-picker-grid > button { width: 84px; height: 84px; padding: 4px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; }
  .loe-inbox-picker.emoji .loe-inbox-picker-grid > button { width: 40px; height: 40px; }
  .loe-inbox-picker-grid > button:hover { background: var(--loe-info-soft); }
  .loe-inbox-picker-grid img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .loe-inbox-picker-grid .loe-inbox-empty { width: 100%; }
  .loe-inbox-emoji { width: 20px; height: 20px; vertical-align: -5px; display: inline-block; }
  .loe-inbox-lightbox { position: fixed; inset: 0; background: rgba(15,23,42,.88); z-index: 2147483645; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
  .loe-inbox-lightbox-img { max-width: 96vw; max-height: 92vh; object-fit: contain; border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,.5); cursor: zoom-out; }
  .loe-inbox-lightbox-bar { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; cursor: default; }
  .loe-inbox-lightbox-bar .loe-inbox-btn { background: var(--loe-glass); }
  /* 群組 @標記：輸入框上方的成員清單；泡泡裡被標記的藍字 */
  .loe-inbox-mention-list { max-height: 220px; overflow-y: auto; border: 1px solid var(--loe-line); border-radius: 10px; background: var(--loe-paper); box-shadow: 0 -4px 16px rgba(15,23,42,.08); display: flex; flex-direction: column; padding: 4px; }
  .loe-inbox-mention-head { display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 11px; color: var(--loe-muted); }
  .loe-inbox-mention-head svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-mention-item { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--loe-fg); font-size: 13px; cursor: pointer; text-align: left; }
  .loe-inbox-mention-item:hover, .loe-inbox-mention-item.on { background: var(--loe-info-soft); }
  .loe-inbox-mention-at { color: var(--loe-primary); font-weight: 700; }
  .loe-inbox-mention-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .loe-inbox-mention-empty { padding: 8px 10px; font-size: 12px; color: var(--loe-muted); }
  .loe-inbox-mention { color: var(--loe-primary); font-weight: 600; }
  .loe-inbox-bubble .loe-inbox-mention { color: var(--loe-primary); }
  .loe-inbox-msg.out .loe-inbox-bubble .loe-inbox-mention { color: var(--loe-info); }
  .loe-inbox-modal { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 60; }
  .loe-inbox-modal-box { width: min(760px, calc(100vw - 32px)); height: min(640px, calc(100vh - 48px)); background: var(--loe-paper); border-radius: 12px; box-shadow: 0 20px 60px rgba(15,23,42,.25); display: flex; flex-direction: column; }
  .loe-inbox-modal-head { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 14px 18px 8px; font-size: 16px; font-weight: 700; }
  .loe-inbox-modal-tabs { flex: 0 0 auto; display: flex; gap: 4px; padding: 0 18px; border-bottom: 1px solid var(--loe-line); }
  .loe-inbox-modal-tab { padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: transparent; color: var(--loe-muted); font-size: 13px; cursor: pointer; }
  .loe-inbox-modal-tab.on { color: var(--loe-fg); border-bottom-color: var(--loe-primary); font-weight: 600; }
  .loe-inbox-modal-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 10px 18px; display: flex; flex-direction: column; gap: 6px; }
  .loe-inbox-content-item { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--loe-line); border-radius: 10px; background: var(--loe-paper); cursor: pointer; text-align: left; color: inherit; }
  .loe-inbox-content-item:hover { background: var(--loe-raise); }
  .loe-inbox-content-item.on { border-color: var(--loe-primary); background: var(--loe-primary-soft); }
  .loe-inbox-content-item img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; flex: 0 0 auto; }
  .loe-inbox-content-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .loe-inbox-content-text .desc { color: var(--loe-muted); font-size: 12px; white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .loe-inbox-more { align-self: center; }
  .loe-inbox-modal-foot { flex: 0 0 auto; display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--loe-line); }
  .loe-inbox-send svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-toasts { position: fixed; top: 64px; right: 20px; width: min(320px, calc(100vw - 32px)); display: flex; flex-direction: column; gap: 6px; z-index: 2147483647; pointer-events: none; }
  .loe-inbox-toasts > * { pointer-events: auto; }
  .loe-inbox-toast { background: var(--loe-paper); border: 1px solid var(--loe-line); border-left: 4px solid var(--loe-primary); border-radius: 10px; padding: 7px 10px; box-shadow: 0 6px 20px rgba(15,23,42,.12); display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
  .loe-inbox-toast-top { display: flex; align-items: center; gap: 6px; }
  .loe-inbox-toast-top > .loe-inbox-tag { flex: 0 0 auto; white-space: nowrap; }
  .loe-inbox-toast-top > .loe-inbox-row-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .loe-inbox-toast-sub { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; color: var(--loe-muted); }
  .loe-inbox-toast-order { flex: 0 0 auto; font-weight: 600; color: var(--loe-fg2); }
  .loe-inbox-toast-who { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .loe-inbox-toast-sub .loe-inbox-badge { flex: 0 0 auto; }
  .loe-inbox-toast-ori { flex: 1 1 auto; min-width: 0; font-size: 11px; color: var(--loe-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .loe-inbox-toast-body { color: var(--loe-fg2); white-space: pre-line; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }
  .loe-inbox-toast-actions { display: flex; gap: 6px; }
  .loe-inbox-toast { position: relative; overflow: hidden; }
  .loe-inbox-toast.handoff { border-left-color: var(--loe-error); }
  .loe-inbox-toast-time { flex: 0 0 auto; font-size: 11px; color: var(--loe-faint); }
  .loe-inbox-toast-top > .loe-inbox-x { flex: 0 0 auto; }
  /* 右上角的卡：露出期間底部一條藍線倒數（CSS 動畫，時間同 INBOX_TOAST_MS） */
  .loe-inbox-toasts .loe-inbox-toast-timer { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: #00a76f; opacity: .45; transform-origin: left; animation: loe-inbox-toast-timer 10s linear forwards; }
  @keyframes loe-inbox-toast-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  .loe-inbox-notif .loe-inbox-toast-timer { display: none; }
  /* 第 4 張起摺成一列 */
  .loe-inbox-toast-fold { display: flex; align-items: center; gap: 6px; background: var(--loe-raise); border: 1px dashed var(--loe-border-strong); border-radius: 10px; padding: 4px 6px 4px 10px; font-size: 12px; color: var(--loe-muted); }
  .loe-inbox-toast-fold-open { flex: 1 1 auto; display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--loe-fg2); font-size: 12px; cursor: pointer; text-align: left; }
  .loe-inbox-toast-fold-open svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-toast-fold-clear { flex: 0 0 auto; border: 1px solid var(--loe-border); background: var(--loe-paper); border-radius: 6px; height: 24px; padding: 0 8px; font-size: 11px; color: var(--loe-fg2); cursor: pointer; }
  .loe-inbox-toast-fold-clear:hover { background: var(--loe-raise2); }
  /* 標頭：全部縮回時鈴鐺左邊的摺疊列 */
  .loe-inbox-fold-inline { display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 4px 0 8px; border: 1px dashed var(--loe-border-strong); border-radius: 8px; background: var(--loe-raise); font-size: 12px; color: var(--loe-muted); }
  .loe-inbox-fold-inline-open { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--loe-fg2); font-size: 12px; cursor: pointer; padding: 0 4px; }
  .loe-inbox-fold-inline-open svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-fold-inline-clear { border: 1px solid var(--loe-border); background: var(--loe-paper); border-radius: 6px; height: 24px; padding: 0 8px; font-size: 11px; color: var(--loe-fg2); cursor: pointer; }
  .loe-inbox-fold-inline-clear:hover { background: var(--loe-raise2); }
  /* 標頭鈴鐺 */
  .loe-inbox-bell { position: relative; }
  .loe-inbox-seg { display: inline-flex; border: 1px solid var(--loe-border); border-radius: 8px; overflow: hidden; }
  .loe-inbox-seg button { height: 26px; padding: 0 10px; border: 0; background: var(--loe-paper); color: var(--loe-fg2); cursor: pointer; font-size: 12px; }
  .loe-inbox-seg button + button { border-left: 1px solid var(--loe-border); }
  .loe-inbox-seg button.on { background: var(--loe-primary-btn); color: #fff; font-weight: 600; }
  .loe-inbox-stepper { display: inline-flex; align-items: center; gap: 4px; }
  .loe-inbox-stepper button { width: 26px; height: 26px; border: 1px solid var(--loe-border); border-radius: 6px; background: var(--loe-paper); color: var(--loe-fg2); cursor: pointer; font-size: 14px; line-height: 1; }
  .loe-inbox-stepper button:disabled { opacity: .4; cursor: default; }
  .loe-inbox-stepper strong { min-width: 18px; text-align: center; }
  .loe-inbox-bell-n { margin-left: 4px; }
  /* 鈴鐺清單抽屜：從收件匣主體上緣蓋到底、靠右 */
  .loe-inbox-notif { position: fixed; top: var(--loe-notif-top, 57px); right: 0; bottom: 0; width: min(380px, 100vw); background: var(--loe-paper); border-left: 1px solid var(--loe-line); box-shadow: -12px 0 32px rgba(15,23,42,.18); z-index: 2147483646; display: flex; flex-direction: column; }
  .loe-inbox-notif-head { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--loe-line); font-size: 13px; }
  .loe-inbox-notif-head svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .loe-inbox-notif-head .loe-inbox-btn { height: 26px; font-size: 12px; }
  .loe-inbox-notif-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; }
  .loe-inbox-notif-list > * { flex: 0 0 auto; } /* 卡片不隨清單高度被壓扁（多則時整排擠成一行高） */
  .loe-inbox-notif .loe-inbox-toast { box-shadow: none; }
  .loe-inbox-toast-actions { margin-top: 2px; }
  .loe-inbox-toast-actions .loe-inbox-btn { height: 26px; font-size: 12px; padding: 0 9px; }
  .loe-inbox-x { width: 24px; height: 24px; border: 0; background: transparent; cursor: pointer; color: var(--loe-muted); display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; }
  .loe-inbox-x:hover { background: var(--loe-raise2); }
  .loe-inbox .loe-qr-bar { padding: 0; margin: 0; }
  /* 訂單看板（獨立畫面） */
  .loe-board { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; background: var(--loe-bg); }
  .loe-board-bar { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 20px; background: var(--loe-paper); border-bottom: 1px solid var(--loe-line); }
  .loe-board-title { font-size: 15px; }
  .loe-board-select { height: 32px; padding: 0 8px; border: 1px solid var(--loe-border); border-radius: 8px; background: var(--loe-paper); font-size: 13px; }
  .loe-board-seg { display: inline-flex; gap: 4px; }
  .loe-board-search { width: 280px; max-width: 100%; height: 32px; padding: 0 10px; border: 1px solid var(--loe-border); border-radius: 8px; font-size: 13px; }
  .loe-board-spacer { flex: 1 1 auto; }
  .loe-board-main { flex: 1 1 auto; min-height: 0; display: flex; position: relative; }
  .loe-board-cols { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: repeat(5, minmax(220px, 1fr)); gap: 12px; padding: 14px 20px; overflow-x: auto; }
  .loe-board-col { min-height: 0; display: flex; flex-direction: column; background: var(--loe-raise2); border-radius: 12px; padding: 10px; }
  .loe-board-col-head { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 2px 4px 10px; }
  .loe-board-dot { width: 10px; height: 10px; border-radius: 50%; background: #6b7280; }
  .loe-board-count { min-width: 22px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--loe-paper); font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
  .loe-board-cards { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .loe-board-none { color: var(--loe-muted); font-size: 12px; text-align: center; padding: 16px 0; }
  .loe-board-card { text-align: left; background: var(--loe-paper); border: 1px solid var(--loe-line); border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; gap: 5px; cursor: pointer; color: var(--loe-fg); font-size: 13px; }
  .loe-board-card:hover { border-color: var(--loe-border-strong); }
  .loe-board-card.selected { border-color: var(--loe-primary); box-shadow: 0 0 0 2px rgba(28,108,243,.25); }
  .loe-board-card-top { display: flex; align-items: center; gap: 6px; }
  .loe-board-src { padding: 0 6px; height: 18px; border-radius: 4px; background: var(--loe-raise2); color: var(--loe-fg2); font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; }
  .loe-board-time { font-size: 12px; font-weight: 600; color: var(--loe-muted); white-space: nowrap; }
  .loe-board-time.late { color: var(--loe-error); }
  .loe-board-addr { line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .loe-board-sub { font-size: 12px; color: var(--loe-muted); }
  .loe-board-sub.muted { color: var(--loe-muted); }
  .loe-board-dot.booking, .loe-board-pill.booking { background: #7c3aed; }
  .loe-board-dot.pending, .loe-board-pill.pending { background: #b45309; }
  .loe-board-dot.accepted, .loe-board-pill.accepted { background: #00a76f; }
  .loe-board-dot.arrived, .loe-board-pill.arrived { background: #15803d; }
  .loe-board-dot.executing, .loe-board-pill.executing { background: #0f766e; }
  .loe-board-pill { color: #fff; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
  .loe-board-drawer { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100%); background: var(--loe-paper); box-shadow: -10px 0 30px rgba(15,23,42,.16); display: flex; flex-direction: column; overflow-y: auto; z-index: 4; }
  .loe-board-drawer-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--loe-line); }
  .loe-board-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--loe-line); }
  .loe-board-cancel { color: var(--loe-error); border-color: var(--loe-error-line); }
  .loe-board-kvs { display: flex; flex-direction: column; gap: 6px; padding: 12px 16px; }
  .loe-board-kv { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; font-size: 13px; }
  .loe-board-kv > span:first-child { color: var(--loe-muted); }
  .loe-board-kv > span:last-child { white-space: pre-wrap; word-break: break-word; }
  .loe-board-note { padding: 0 16px 12px; }
  .loe-board-dchat { flex: 1 0 420px; display: flex; flex-direction: column; border-top: 1px solid var(--loe-line); min-height: 0; }
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
        <div class="loe-inbox-th-split" role="separator" aria-orientation="horizontal" aria-label="拖拉調整回覆輸入框高度" title="拖拉調整輸入框高度，雙擊回到預設"></div>
        <div class="loe-inbox-quick loe-qr-bar"></div>
        <div class="loe-inbox-picker" hidden></div>
        <div class="loe-inbox-reply" hidden aria-label="回覆的訊息"><span class="loe-inbox-reply-body"><strong class="loe-inbox-reply-who"></strong><span class="loe-inbox-reply-text"></span></span><button type="button" class="loe-inbox-x loe-inbox-reply-x" title="取消回覆（Esc）" aria-label="取消回覆">${ic("x")}</button></div>
        <div class="loe-inbox-mention-list" hidden role="listbox" aria-label="標記成員"></div>
        <div class="loe-inbox-composer-row">
          <textarea class="loe-inbox-textarea" rows="2" placeholder="輸入回覆" aria-label="回覆內容"></textarea>
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
