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
  /** Host capability allowing this page to start the managed installer. */
  installAvailable?: boolean
  releaseUrl?: string
}

/** Delay between release-feed checks while a page stays open. */
export const RUNTIME_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

/** Maximum browser wait for download, installation, and service restart. */
export const RUNTIME_UPDATE_INSTALL_WAIT_TIMEOUT_MS = 10 * 60 * 1000

/** Polling interval while a managed runtime update is being installed. */
export const RUNTIME_UPDATE_INSTALL_WAIT_INTERVAL_MS = 1_000

/** Number of version polls covered by the bounded installation wait. */
export const RUNTIME_UPDATE_INSTALL_WAIT_ATTEMPTS = Math.ceil(
  RUNTIME_UPDATE_INSTALL_WAIT_TIMEOUT_MS / RUNTIME_UPDATE_INSTALL_WAIT_INTERVAL_MS,
)

/** Browser callbacks supplied by the plugin closure. */
export interface RuntimeUpdateInjected {
  check: () => Promise<RuntimeUpdateInfo>
  /** Start the managed runtime installer; availability is carried by the check result. */
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
 * Wait until the installed runtime reports the requested version after its restart.
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
  const attempts = options.attempts ?? RUNTIME_UPDATE_INSTALL_WAIT_ATTEMPTS
  const delayMs = options.delayMs ?? RUNTIME_UPDATE_INSTALL_WAIT_INTERVAL_MS
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
  const dismissedVersion = useRef<string | undefined>(undefined)

  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    let cancelled = false
    let checking = false
    const checkForUpdate = async (): Promise<void> => {
      if (checking) return
      checking = true
      try {
        const next = await check()
        if (cancelled || !next.updateAvailable || dismissedVersion.current === next.latestVersion) return
        setInfo(next)
        setOpen(true)
      } catch {
        // A missing feed, an offline machine, and a source checkout all keep the
        // shell quiet; the updater remains available from its CLI entry point.
      } finally {
        checking = false
      }
    }
    void checkForUpdate()
    const timer = setInterval(() => { void checkForUpdate() }, RUNTIME_UPDATE_CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [check])

  const close = useCallback(() => {
    if (!busy) {
      if (info !== null) dismissedVersion.current = info.latestVersion
      setOpen(false)
    }
  }, [busy, info])

  const onInstall = useCallback(async () => {
    if (busy || info === null || install === undefined) return
    setBusy(true)
    setError(null)
    try {
      await install()
      if (alive.current) setError(null)
      const updated = await waitForVersion(readVersion, info.latestVersion)
      if (!updated) {
        if (alive.current) {
          setBusy(false)
          setError(t('timeout'))
        }
        return
      }
      if (reload !== undefined) reload()
      else if (typeof window !== 'undefined') window.location.reload()
    } catch (reason) {
      if (alive.current) {
        setBusy(false)
        setError(t('error', { message: messageOf(reason) }))
      }
    }
  }, [busy, info, install, readVersion, reload, t])

  if (info === null || !open) return null
  const canInstall = info.installAvailable ?? install !== undefined

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
          {install !== undefined && canInstall && (
            <Button variant="primary" onClick={() => { void onInstall() }} disabled={busy}>
              {busy ? t('installing') : t('install')}
            </Button>
          )}
        </>
      )}
    >
      <div className={css.body}>
        {!canInstall && <p className={css.status} role="status">{t('remote')}</p>}
        {busy && <p className={css.status} role="status">{t('waiting')}</p>}
        {error !== null && <p className={css.error} role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
