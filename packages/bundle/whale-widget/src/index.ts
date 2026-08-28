/** Optional draggable DeepSeek balance widget for the browser surface. */

import { readFileSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'

const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const IMAGE = readFileSync(fileURLToPath(new URL('../assets/DSniang1.png', import.meta.url)))
const SCRIPT_PATH = '/dsh-whale/widget.js'

interface BalanceInfo {
  total_balance: number
  currency?: string
}

interface BalanceResponse {
  balance_infos?: BalanceInfo[]
}

interface BalancePayload {
  ok: boolean
  totalBalance?: number
  currency?: string
  error?: string
}

/** Browser implementation kept independent from the React application bundle. */
const WIDGET_JS = `(() => {
  const id = 'dsh-whale-widget';
  const script = ${JSON.stringify(SCRIPT_PATH)};
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.textContent = [
    '#' + id + '{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:grid;justify-items:end;gap:6px;touch-action:none;user-select:none;}',
    '#' + id + ' button{border:0;border-radius:12px;background:rgba(24,35,61,.92);color:#fff;padding:7px 10px;font:12px system-ui;box-shadow:0 8px 28px rgba(0,0,0,.24);cursor:pointer;}',
    '#' + id + ' img{width:96px;max-height:96px;object-fit:contain;cursor:grab;-webkit-user-drag:none;}',
  ].join('');
  document.head.append(style);

  const root = document.createElement('aside');
  root.id = id;
  const balance = document.createElement('button');
  balance.type = 'button';
  balance.textContent = '小鲸鱼：加载余额';
  const image = document.createElement('img');
  image.src = '/dsh-whale/image.png';
  image.alt = 'DeepSeek 余额小鲸鱼';
  root.append(balance, image);
  document.body.append(root);

  async function refresh() {
    balance.textContent = '小鲸鱼：查询余额…';
    try {
      const response = await fetch('/dsh-whale/balance.json', { cache: 'no-store' });
      const payload = await response.json();
      balance.textContent = payload.ok
        ? '余额 ' + Number(payload.totalBalance).toFixed(2) + ' ' + payload.currency
        : '小鲸鱼：' + payload.error;
    } catch {
      balance.textContent = '小鲸鱼：余额暂不可用';
    }
  }

  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  function move(event) {
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.left = Math.max(0, originX + event.clientX - startX) + 'px';
    root.style.top = Math.max(0, originY + event.clientY - startY) + 'px';
  }
  image.addEventListener('pointerdown', event => {
    const rect = root.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    originX = rect.left;
    originY = rect.top;
    image.setPointerCapture(event.pointerId);
    image.style.cursor = 'grabbing';
  });
  image.addEventListener('pointermove', event => {
    if (image.hasPointerCapture(event.pointerId)) move(event);
  });
  image.addEventListener('pointerup', event => {
    if (image.hasPointerCapture(event.pointerId)) image.releasePointerCapture(event.pointerId);
    image.style.cursor = 'grab';
  });
  balance.addEventListener('click', refresh);
  refresh();
})();`

/** Stable Cordis plugin name. */
export const name = 'whale-widget'
/** Services required before the widget can register its browser routes. */
export const inject = ['webServer', 'credentials']

function sendJson(res: ServerResponse, payload: BalancePayload): void {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

async function readBalance(ctx: Context): Promise<BalancePayload> {
  const credential = await ctx.credentials.resolve(credentialRef('DEEPSEEK_API_KEY'))
  if (credential === undefined) return { ok: false, error: '未配置 DEEPSEEK_API_KEY' }
  const response = await fetch(BALANCE_URL, {
    headers: { Authorization: `Bearer ${credential.value}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) return { ok: false, error: '余额服务暂不可用' }
  const body = await response.json() as BalanceResponse
  const info = body.balance_infos?.[0]
  if (info === undefined || !Number.isFinite(info.total_balance)) {
    return { ok: false, error: '余额服务返回了无效数据' }
  }
  return { ok: true, totalBalance: info.total_balance, currency: info.currency ?? 'CNY' }
}

/** Register balance and asset routes, then inject the optional browser widget. */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const disposeImage = ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-whale/image.png',
      handler: (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': String(IMAGE.length),
          'Cache-Control': 'no-store',
        })
        res.end(IMAGE)
      },
    })
    const disposeBalance = ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-whale/balance.json',
      handler: async (_req, res) => {
        try {
          sendJson(res, await readBalance(ctx))
        } catch {
          sendJson(res, { ok: false, error: '余额暂不可用' })
        }
      },
    })
    const disposeScript = ctx.webServer.register({
      kind: 'exact',
      path: SCRIPT_PATH,
      handler: (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(WIDGET_JS)
      },
    })
    const disposeIndexTap = ctx.webServer.tapIndex((html) => {
      if (html.includes(SCRIPT_PATH)) return html
      const tag = `<script defer src="${SCRIPT_PATH}"></script>`
      return html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : `${html}${tag}`
    })
    return () => {
      disposeIndexTap()
      disposeScript()
      disposeBalance()
      disposeImage()
    }
  }, 'whale-widget: web routes')
}
