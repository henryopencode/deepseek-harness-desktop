/** Browser Web runtime update prompt, mounted only for loopback pages. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { RpcResult } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { RuntimeUpdateNotice } from './RuntimeUpdateNotice.tsx'
import type { RuntimeUpdateInfo, RuntimeUpdateInjected } from './RuntimeUpdateNotice.tsx'
import { en, zh, type RuntimeUpdateKey } from './locales.ts'

export type { RuntimeUpdateInfo, RuntimeUpdateInjected, RuntimeUpdateNoticeProps, WaitForVersionOptions } from './RuntimeUpdateNotice.tsx'
export { RuntimeUpdateNotice, waitForVersion } from './RuntimeUpdateNotice.tsx'
export type { RuntimeUpdateKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Runtime update prompt copy. */
    runtimeUpdate: RuntimeUpdateKey
  }
}

const NS = 'runtimeUpdate'

/** Required services: the connection, locale registry, and shell overlay declaration. */
export const inject = ['connection', 'slots', 'locale']

function valueFrom<T>(response: RpcResult<T>): T {
  if (!response.ok) throw new Error(`${response.error.message} (${response.error.code})`)
  return response.value
}

/** Register the loopback-only update prompt. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-runtime-update: dictionaries')
  const connection = ctx.get('connection') as ConnectionHandle
  if (!connection.isLoopback) return

  const injected = (): RuntimeUpdateInjected => ({
    check: async (): Promise<RuntimeUpdateInfo> => {
      const response = await connection.api.host.updateCheck({})
      return valueFrom(response.result)
    },
    install: async (): Promise<void> => {
      const response = await connection.api.host.updateInstall({})
      valueFrom(response.result)
    },
    readVersion: async (): Promise<string> => {
      const response = await connection.api.host.describe({})
      return valueFrom(response.result).version
    },
  })

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'runtime-update',
    order: 100,
    locale: NS,
    inject: injected,
  }, RuntimeUpdateNotice))
}
