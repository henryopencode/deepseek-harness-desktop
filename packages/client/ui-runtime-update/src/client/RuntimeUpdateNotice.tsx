import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime, Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { RuntimeUpdateKey } from './locales.ts'
import css from './RuntimeUpdateNotice.module.css'

/** Result returned by the Host update check. */
export interface RuntimeUpdateInfo {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseUrl?: string
}

/** Browser callbacks supplied by the plugin closure. */
export interface RuntimeUpdateInjected {
  check: () => Promise<RuntimeUpdateInfo>
  /** Install locally managed runtimes; remote deployments expose check-only status. */
  install?: () => Promise<void>
  readVersion: () => Promise<string>
  /** Optional page reload hook, injectable for non-browser tests. */
  reload?: () => void
}

/** Full shell-overlay props. */
export type RuntimeUpdateNoticeProps = PropsRuntime<'shell.overlay'>
  & { t: Translate<RuntimeUpdateKey> }
  & RuntimeUpdateInjected

/** Polling options kept injectable so the wait behavior can be tested without real time. */
export interface WaitForVersionOptions {
  attempts?: number
  delayMs?: number
  sleep?: (delayMs: number) => Promise<void>
}

/**
 * Wait until the restarted Host reports the requested version.
 * @param readVersion - callback reading the current Host version.
 * @param targetVersion - version expected after installation.
 * @param options - bounded polling controls.
 * @returns true when the target is observed before the bound expires.
 */
export async function waitForVersion(
  readVersion: () => Promise<string>,
  targetVersion: string,
  options: WaitForVersionOptions = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 30
  const delayMs = options.delayMs ?? 500
  const sleep = options.sleep ?? ((delay: number) => new Promise<void>((resolve) => { setTimeout(resolve, delay) }))
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await readVersion() === targetVersion) return true
    } catch {
      // The service is expected to reject while it is restarting.
    }
    if (attempt + 1 < attempts) await sleep(delayMs)
  }
  return false
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Render the user-confirmed update dialog. Check failures are intentionally
 * silent because ordinary source checkouts and deployments without a release
 * feed are valid Web runtimes.
 * @param props - Host update callbacks and localized copy.
 * @returns the update modal while an update is available.
 */
export function RuntimeUpdateNotice({ check, install, readVersion, reload, t }: RuntimeUpdateNoticeProps) {
  const [info, setInfo] = useState<RuntimeUpdateInfo | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    let cancelled = false
    void check().then((next) => {
      if (cancelled || !next.updateAvailable) return
      setInfo(next)
      setOpen(true)
    }).catch(() => {
      // A missing feed, an offline machine, and a source checkout all keep the
      // shell quiet; the updater remains available from its CLI entry point.
    })
    return () => { cancelled = true }
  }, [check])

  const close = useCallback(() => {
    if (!busy) setOpen(false)
  }, [busy])

  const onInstall = useCallback(async () => {
    if (busy || info === null || install === undefined) return
    setBusy(true)
    setError(null)
    try {
      await install()
      if (alive.current) setError(null)
      const updated = await waitForVersion(readVersion, info.latestVersion)
      if (!updated) throw new Error(t('timeout'))
      if (reload !== undefined) reload()
      else if (typeof window !== 'undefined') window.location.reload()
    } catch (reason) {
      if (alive.current) {
        setBusy(false)
        setError(t('error', { message: messageOf(reason) }))
      }
    }
  }, [busy, info, install, readVersion, t])

  if (info === null || !open) return null

  return (
    <Modal
      open
      onClose={close}
      title={t('title')}
      closeLabel={t('close')}
      {...css.notice === undefined ? {} : { className: css.notice }}
      description={t('description', { current: info.currentVersion, latest: info.latestVersion })}
      footer={(
        <>
          <Button variant="outline" onClick={close} disabled={busy}>{t('later')}</Button>
          {install !== undefined && (
            <Button variant="primary" onClick={() => { void onInstall() }} disabled={busy}>
              {busy ? t('installing') : t('install')}
            </Button>
          )}
        </>
      )}
    >
      <div className={css.body}>
        {install === undefined && <p className={css.status} role="status">{t('remote')}</p>}
        {busy && <p className={css.status} role="status">{t('waiting')}</p>}
        {error !== null && <p className={css.error} role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
