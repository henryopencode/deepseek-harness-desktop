// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RUNTIME_UPDATE_CHECK_INTERVAL_MS, RUNTIME_UPDATE_INSTALL_WAIT_ATTEMPTS, RUNTIME_UPDATE_INSTALL_WAIT_TIMEOUT_MS, RuntimeUpdateNotice, waitForVersion, type RuntimeUpdateNoticeProps } from '../src/client/RuntimeUpdateNotice.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const t = ((key: keyof typeof zh, params?: Record<string, unknown>) => {
  const value = zh[key]
  return params === undefined ? value : value.replace(/\{(\w+)\}/gu, (match, name: string) => name in params ? String(params[name]) : match)
}) as RuntimeUpdateNoticeProps['t']

function props(overrides: Partial<RuntimeUpdateNoticeProps> = {}): RuntimeUpdateNoticeProps {
  return {
    check: vi.fn().mockResolvedValue({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.9', updateAvailable: true }),
    install: vi.fn().mockResolvedValue(undefined),
    readVersion: vi.fn().mockResolvedValue('0.1.0-rc.9'),
    t,
    ...overrides,
  } as RuntimeUpdateNoticeProps
}

describe('runtime update notice', () => {
  it('stays hidden when no update is available', async () => {
    render(<RuntimeUpdateNotice {...props({ check: vi.fn().mockResolvedValue({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.8', updateAvailable: false }) })} />)
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('finds a release published after the page first loads', async () => {
    vi.useFakeTimers()
    const check = vi.fn()
      .mockResolvedValueOnce({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.8', updateAvailable: false })
      .mockResolvedValueOnce({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.9', updateAvailable: true })
    render(<RuntimeUpdateNotice {...props({ check })} />)
    await act(async () => { await Promise.resolve() })
    expect(check).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(RUNTIME_UPDATE_CHECK_INTERVAL_MS) })
    expect(screen.getByRole('dialog', { name: '发现新版本' })).not.toBeNull()
  })

  it('does not reopen a dismissed release but shows a later release', async () => {
    vi.useFakeTimers()
    const check = vi.fn()
      .mockResolvedValueOnce({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.9', updateAvailable: true })
      .mockResolvedValueOnce({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.9', updateAvailable: true })
      .mockResolvedValueOnce({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.10', updateAvailable: true })
    render(<RuntimeUpdateNotice {...props({ check })} />)
    await act(async () => { await Promise.resolve() })
    fireEvent.click(screen.getByRole('button', { name: '稍后' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(RUNTIME_UPDATE_CHECK_INTERVAL_MS) })
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(RUNTIME_UPDATE_CHECK_INTERVAL_MS) })
    expect(screen.getByText('当前版本 0.1.0-rc.8，最新版本 0.1.0-rc.10。')).not.toBeNull()
  })

  it('stops checking when the notice unmounts', async () => {
    vi.useFakeTimers()
    const check = vi.fn().mockResolvedValue({ currentVersion: '0.1.0-rc.8', latestVersion: '0.1.0-rc.8', updateAvailable: false })
    const view = render(<RuntimeUpdateNotice {...props({ check })} />)
    await act(async () => { await Promise.resolve() })
    expect(check).toHaveBeenCalledOnce()
    view.unmount()
    await vi.advanceTimersByTimeAsync(RUNTIME_UPDATE_CHECK_INTERVAL_MS * 2)
    expect(check).toHaveBeenCalledOnce()
  })

  it('shows the version and asks before installing', async () => {
    const install = vi.fn().mockResolvedValue(undefined)
    render(<RuntimeUpdateNotice {...props({ install })} />)
    expect(await screen.findByRole('dialog', { name: '发现新版本' })).not.toBeNull()
    expect(screen.getByText('当前版本 0.1.0-rc.8，最新版本 0.1.0-rc.9。')).not.toBeNull()
    expect(install).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '稍后' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('installs once and reloads after the target version answers', async () => {
    const install = vi.fn().mockResolvedValue(undefined)
    const readVersion = vi.fn().mockResolvedValue('0.1.0-rc.9')
    const reload = vi.fn()
    render(<RuntimeUpdateNotice {...props({ install, readVersion, reload })} />)
    fireEvent.click(await screen.findByRole('button', { name: '立即更新' }))
    fireEvent.click(screen.getByRole('button', { name: '正在更新…' }))
    await waitFor(() => { expect(install).toHaveBeenCalledOnce() })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('keeps an install failure visible for retry', async () => {
    const install = vi.fn().mockRejectedValue(new Error('不可用'))
    render(<RuntimeUpdateNotice {...props({ install })} />)
    fireEvent.click(await screen.findByRole('button', { name: '立即更新' }))
    expect((await screen.findByRole('alert')).textContent).toBe('更新失败：不可用')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '立即更新' }).disabled).toBe(false)
  })

  it('uses the host capability to hide the install action for a remote deployment', async () => {
    const remoteProps = props({
      check: vi.fn().mockResolvedValue({
        currentVersion: '0.1.0-rc.8',
        latestVersion: '0.1.0-rc.9',
        updateAvailable: true,
        installAvailable: false,
      }),
    })
    render(<RuntimeUpdateNotice {...remoteProps} />)
    expect(await screen.findByRole('dialog', { name: '发现新版本' })).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('远程部署请通过 SSH 更新服务器。')
    expect(screen.queryByRole('button', { name: '立即更新' })).toBeNull()
    expect(screen.getByRole('button', { name: '稍后' })).not.toBeNull()
  })

  it('offers the install action when the remote host explicitly enables it', async () => {
    const remoteProps = props({
      check: vi.fn().mockResolvedValue({
        currentVersion: '0.1.0-rc.8',
        latestVersion: '0.1.0-rc.9',
        updateAvailable: true,
        installAvailable: true,
      }),
    })
    render(<RuntimeUpdateNotice {...remoteProps} />)
    expect(await screen.findByRole('button', { name: '立即更新' })).not.toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('waitForVersion', () => {
  it('keeps the default wait long enough for a first install', async () => {
    const read = vi.fn().mockImplementation(async () => read.mock.calls.length >= 32 ? 'new' : 'old')
    await expect(waitForVersion(read, 'new', { sleep: async () => {} })).resolves.toBe(true)
    expect(read).toHaveBeenCalledTimes(32)
    expect(RUNTIME_UPDATE_INSTALL_WAIT_TIMEOUT_MS).toBeGreaterThanOrEqual(5 * 60 * 1000)
    expect(RUNTIME_UPDATE_INSTALL_WAIT_ATTEMPTS).toBeGreaterThanOrEqual(300)
  })

  it('retries through restart failures until the target responds', async () => {
    const read = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new')
    const sleeps: number[] = []
    await expect(waitForVersion(read, 'new', { attempts: 4, delayMs: 12, sleep: async (ms) => { sleeps.push(ms) } })).resolves.toBe(true)
    expect(read).toHaveBeenCalledTimes(3)
    expect(sleeps).toEqual([12, 12])
  })
})
