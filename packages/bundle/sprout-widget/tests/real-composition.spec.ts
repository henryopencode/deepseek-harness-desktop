/** Real Loader coverage for the optional sprout and whale browser widgets. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import HttpServer from '@deepseek-ai/dsh-host-webserver'
import * as SproutWidget from '../src/index.ts'
import * as WhaleWidget from '../../whale-widget/src/index.ts'

const API_BALANCE_URL = 'https://api.deepseek.com/user/balance'
const nativeFetch = globalThis.fetch
let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Boot both opt-in widgets through the same Loader and HTTP server used by a profile. */
async function loadWidgets(credential?: { value: string }): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-widget-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    "- name: '@deepseek-ai/dsh-sprout-widget'",
    "- name: '@deepseek-ai/dsh-whale-widget'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  context.provide('credentials', { resolve: async () => credential } as never)
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', HttpServer],
    ['@deepseek-ai/dsh-sprout-widget', SproutWidget],
    ['@deepseek-ai/dsh-whale-widget', WhaleWidget],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      const module = modules.get(specifier)
      if (module === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return module
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

/** Make one request against the real loopback web server without intercepting it. */
async function request(port: number, path: string): Promise<Response> {
  return nativeFetch(`http://127.0.0.1:${String(port)}${path}`)
}

/** Dispose one loader entry and make a missing entry a test failure. */
async function disposeEntry(ctx: Context, name: string): Promise<void> {
  const fiber = [...ctx.loader.entries()].find(candidate => candidate.options.name === name)?.fiber
  if (fiber === undefined) throw new Error(`missing loaded entry ${name}`)
  await fiber.dispose()
}

/** Mock only the DeepSeek upstream request; loopback assertions stay real. */
function mockBalance(result: () => Promise<Response>): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (input === API_BALANCE_URL) return result()
    return nativeFetch(input, init)
  })
}

describe('optional widget Loader composition', () => {
  it('serves both widgets, reflects turn state, and removes each surface on disposal', { timeout: 60_000 }, async () => {
    const ctx = await loadWidgets()
    const server = ctx.webServer
    const port = server.port
    const index = server.applyIndexTaps('<body>shell</body>')
    expect(index).toContain('/dsh-sprout/widget.js')
    expect(index).toContain('/dsh-whale/widget.js')
    expect(server.applyIndexTaps(index)).toBe(index)
    expect(server.applyIndexTaps('shell')).toContain('/dsh-whale/widget.js')

    expect((await request(port, '/dsh-sprout/widget.js')).headers.get('content-type'))
      .toContain('application/javascript')
    expect((await request(port, '/dsh-whale/widget.js')).headers.get('content-type'))
      .toContain('application/javascript')
    expect((await request(port, '/dsh-whale/image.png')).headers.get('content-type')).toContain('image/png')
    expect(await (await request(port, '/dsh-sprout/state')).json()).toEqual({ working: false })
    expect(await (await request(port, '/dsh-whale/balance.json')).json())
      .toEqual({ ok: false, error: '未配置 DEEPSEEK_API_KEY' })

    const clock = vi.spyOn(Date, 'now').mockReturnValue(1)
    ctx.emit('session/event', { id: 'widget-session' } as never, { type: 'tool/result' } as never)
    ctx.emit('session/event', { id: 'widget-session' } as never, { type: 'turn/start' } as never)
    expect(await (await request(port, '/dsh-sprout/state')).json()).toEqual({ working: true })
    ctx.emit('session/event', { id: 'widget-session' } as never, { type: 'turn/end' } as never)
    clock.mockReturnValue(1_000)
    expect(await (await request(port, '/dsh-sprout/state')).json()).toEqual({ working: true })
    clock.mockReturnValue(2_000)
    expect(await (await request(port, '/dsh-sprout/state')).json()).toEqual({ working: false })

    await disposeEntry(ctx, '@deepseek-ai/dsh-sprout-widget')
    expect(server.applyIndexTaps('<body>shell</body>')).not.toContain('/dsh-sprout/widget.js')
    expect((await request(port, '/dsh-sprout/state')).status).toBe(404)
    expect(server.applyIndexTaps('<body>shell</body>')).toContain('/dsh-whale/widget.js')

    await disposeEntry(ctx, '@deepseek-ai/dsh-whale-widget')
    expect(server.applyIndexTaps('<body>shell</body>')).not.toContain('/dsh-whale/widget.js')
    expect((await request(port, '/dsh-whale/balance.json')).status).toBe(404)
  })

  it('returns the upstream balance and falls back to CNY when the response omits a currency', async () => {
    const ctx = await loadWidgets({ value: 'not-exposed' })
    const port = ctx.webServer.port
    mockBalance(async () => new Response(JSON.stringify({ balance_infos: [{ total_balance: 12.34, currency: 'USD' }] })))
    expect(await (await request(port, '/dsh-whale/balance.json')).json())
      .toEqual({ ok: true, totalBalance: 12.34, currency: 'USD' })

    mockBalance(async () => new Response(JSON.stringify({ balance_infos: [{ total_balance: 3 }] })))
    expect(await (await request(port, '/dsh-whale/balance.json')).json())
      .toEqual({ ok: true, totalBalance: 3, currency: 'CNY' })
  })

  it.each([
    ['an upstream HTTP failure', async () => new Response('', { status: 503 }), '余额服务暂不可用'],
    ['an invalid upstream body', async () => new Response(JSON.stringify({ balance_infos: [] })), '余额服务返回了无效数据'],
    ['an upstream transport failure', async () => { throw new Error('offline') }, '余额暂不可用'],
  ])('returns a safe error for %s', async (_label, result, error) => {
    const ctx = await loadWidgets({ value: 'not-exposed' })
    mockBalance(result)
    const response = await request(ctx.webServer.port, '/dsh-whale/balance.json')
    expect(await response.json()).toEqual({ ok: false, error })
  })
})
