/**
 * @deepseek-ai/dsh-sprout-widget — a small, draggable sprout status widget for the
 * DSH Web surface. It follows the harness agent session turn lifecycle and
 * renders a growing (green) sprout while the harness is working and a grey
 * sprout when idle.
 *
 * It is a node-side bundle plugin: it injects a `<script>` into the served
 * index.html through `webServer.tapIndex`, serves the client sprite and a tiny
 * status endpoint through `webServer.register`, and derives the working/idle
 * state from the session event feed (`turn/start` / `turn/end`).
 * @module @deepseek-ai/dsh-sprout-widget
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session'

/** Stable Cordis plugin name. */
export const name = 'sprout-widget'

/** Services required before the sprout can mount. */
export const inject = ['webServer']

/**
 * Global open-turn counter across all sessions: a turn is "open" between the
 * session's `turn/start` and `turn/end` events, so openTurns > 0 means the
 * harness is currently doing work.
 */
let openTurns = 0
/** A short "linger" so the sprout keeps animating a beat after work ends. */
let activeUntil = 0

function isWorking(): boolean {
  return openTurns > 0 || Date.now() < activeUntil
}

/** The client sprite: a self-contained vanilla-JS + inline-SVG draggable widget. */
const WIDGET_JS = `(function () {
  'use strict';
  var HOST = '/dsh-sprout';
  var SIZE = 58;
  var GAP = 20;
  var root = null;
  var state = 'idle';
  var dragging = false;
  var justDragged = false;
  var startX = 0, startY = 0, baseLeft = 0, baseTop = 0;
  var POS_KEY = 'dshs-pos';

  var CSS = '' +
    '#dshs-root{position:fixed;z-index:2147483000;cursor:grab;user-select:none;' +
      '-webkit-user-select:none;font-family:system-ui,Segoe UI,Arial,sans-serif;touch-action:none;}' +
    '#dshs-root.dshs-dragging{cursor:grabbing;}' +
    '#dshs-root .dshs-tip{position:absolute;left:66px;bottom:6px;white-space:nowrap;' +
      'background:rgba(20,20,20,.82);color:#fff;font-size:12px;line-height:1;padding:6px 9px;' +
      'border-radius:8px;opacity:0;transition:opacity .18s ease;pointer-events:none;}' +
    '#dshs-root:hover .dshs-tip{opacity:1;}' +
    '#dshs-root .dshs-svg{display:block;transform-origin:50% 90%;pointer-events:none;}' +
    '#dshs-root .leaf{transform-origin:32px 30px;}' +
    '#dshs-root.dshs-working .leaf-l{fill:#4fae57;}' +
    '#dshs-root.dshs-working .leaf-r{fill:#5fbf68;}' +
    '#dshs-root.dshs-working .leaf-s{fill:#5fbf68;}' +
    '#dshs-root.dshs-working .stem{stroke:#4fae57;}' +
    '#dshs-root.dshs-working .mound{fill:#8fce97;}' +
    '#dshs-root.dshs-working .dshs-svg{animation:dshsGrow 1.1s ease-in-out infinite;}' +
    '@keyframes dshsGrow{0%,100%{transform:scale(1);}50%{transform:scale(1.07);}}' +
    '#dshs-root.dshs-idle .leaf-l,#dshs-root.dshs-idle .leaf-r,#dshs-root.dshs-idle .leaf-s{fill:#b9bdc2;}' +
    '#dshs-root.dshs-idle .stem{stroke:#b9bdc2;}' +
    '#dshs-root.dshs-idle .mound{fill:#cfd3d8;}' +
    '#dshs-root.dshs-idle .dshs-svg{animation:dshsIdle 3s ease-in-out infinite;}' +
    '@keyframes dshsIdle{0%,100%{transform:rotate(0deg);}30%{transform:rotate(-2.5deg);}' +
      '70%{transform:rotate(2deg);}}';

  function setState(next) {
    if (next === state) return;
    state = next;
    if (root) {
      root.className = 'dshs-' + state;
      var tip = root.querySelector('.dshs-tip');
      if (tip) tip.textContent = state === 'working' ? 'Harness 工作中' : '空闲';
    }
  }

  function poll() {
    try {
      fetch(HOST + '/state', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { setState(d && d.working ? 'working' : 'idle'); })
        .catch(function () {});
    } catch (e) {}
  }

  function clampToViewport(left, top) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = root ? root.offsetWidth : SIZE;
    var h = root ? root.offsetHeight : SIZE;
    left = Math.max(0, Math.min(left, Math.max(0, vw - w)));
    top = Math.max(0, Math.min(top, Math.max(0, vh - h)));
    return { left: left, top: top };
  }

  function placeAt(left, top) {
    if (!root) return;
    var p = clampToViewport(left, top);
    root.style.left = p.left + 'px';
    root.style.top = p.top + 'px';
  }

  function loadPos() {
    try {
      var a = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (a && typeof a.left === 'number' && typeof a.top === 'number') return a;
    } catch (e) {}
    return null;
  }

  function savePos() {
    try {
      var r = root.getBoundingClientRect();
      localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
    } catch (e) {}
  }

  function initPos() {
    var saved = loadPos();
    if (saved) { placeAt(saved.left, saved.top); return; }
    var vw = window.innerWidth, vh = window.innerHeight;
    placeAt(vw - SIZE - GAP, vh - SIZE - GAP);
  }

  function onMove(e) {
    if (!dragging) return;
    placeAt(baseLeft + (e.clientX - startX), baseTop + (e.clientY - startY));
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) justDragged = true;
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('dshs-dragging');
    root.style.cursor = 'grab';
    savePos();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onUp);
  }

  function onTouchMove(e) {
    if (!dragging) return;
    var t = e.touches[0];
    placeAt(baseLeft + (t.clientX - startX), baseTop + (t.clientY - startY));
    if (Math.abs(t.clientX - startX) > 4 || Math.abs(t.clientY - startY) > 4) justDragged = true;
    e.preventDefault();
  }

  function bindDrag() {
    root.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true; justDragged = false;
      startX = e.clientX; startY = e.clientY;
      var r = root.getBoundingClientRect();
      baseLeft = r.left; baseTop = r.top;
      root.classList.add('dshs-dragging');
      root.style.cursor = 'grabbing';
      e.preventDefault();
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    root.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      dragging = true; justDragged = false;
      startX = t.clientX; startY = t.clientY;
      var r = root.getBoundingClientRect();
      baseLeft = r.left; baseTop = r.top;
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }, { passive: true });
  }

  function create() {
    if (document.getElementById('dshs-root')) return;
    root = document.createElement('div');
    root.id = 'dshs-root';
    root.className = 'dshs-idle';

    root.innerHTML =
      '<div class="dshs-tip">空闲</div>' +
      '<svg class="dshs-svg" width="' + SIZE + '" height="' + SIZE + '" viewBox="0 0 64 64">' +
        '<path class="stem" d="M32 52 C32 44 32 34 32 25" stroke="#4fae57" stroke-width="3" ' +
          'fill="none" stroke-linecap="round"/>' +
        '<path class="leaf-l" d="M31 31 C23 31 16 24 18 16 C27 16 32 24 31 31 Z" fill="#4fae57"/>' +
        '<path class="leaf-r" d="M33 27 C41 25 48 19 46 12 C38 13 33 20 33 27 Z" fill="#5fbf68"/>' +
        '<path class="leaf-s" d="M34 36 C38 35 42 31 41 27 C37 28 34 32 34 36 Z" fill="#5fbf68"/>' +
        '<ellipse class="mound" cx="32" cy="53" rx="15" ry="5" fill="#8fce97"/>' +
      '</svg>';

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.appendChild(root);

    initPos();
    bindDrag();

    root.addEventListener('click', function () {
      if (justDragged) { justDragged = false; return; }
      poll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { create(); poll(); });
  } else {
    create(); poll();
  }
  setInterval(poll, 1000);
})();`

/** Disposers returned by the webServer calls, released on plugin teardown. */
const disposers: Array<() => void> = []

/**
 * Mount the sprout widget: subscribe to the session turn lifecycle, serve the
 * client sprite and status endpoint, and tap the served index.html.
 * @param ctx - plugin context carrying the webServer service.
 */
export function apply(ctx: Context): void {
  ctx.on('session/event', (_session, event) => {
    if (event.type === 'turn/start') {
      openTurns += 1
      activeUntil = Date.now() + 1500
    } else if (event.type === 'turn/end') {
      openTurns = Math.max(0, openTurns - 1)
      activeUntil = Date.now() + 1500
    }
  })

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-sprout/widget.js',
    handler: (_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(WIDGET_JS)
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-sprout/state',
    handler: (_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(JSON.stringify({ working: isWorking() }))
    },
  }))

  disposers.push(ctx.webServer.tapIndex((html) => {
    if (html.includes('/dsh-sprout/widget.js')) return html
    const tag = '<script defer src="/dsh-sprout/widget.js"></script>'
    if (html.includes('</body>')) return html.replace('</body>', `${tag}</body>`)
    return `${html}${tag}`
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* ignore teardown errors */ }
    }
  })
}
