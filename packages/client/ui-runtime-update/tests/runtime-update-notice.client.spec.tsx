// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RuntimeUpdateNotice, waitForVersion, type RuntimeUpdateNoticeProps } from '../src/client/RuntimeUpdateNotice.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

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
    expect((screen.getByRole('button', { name: '立即更新' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows remote update status without offering a server install action', async () => {
    const remoteProps = props()
    delete remoteProps.install
    render(<RuntimeUpdateNotice {...remoteProps} />)
    expect(await screen.findByRole('dialog', { name: '发现新版本' })).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('远程部署请通过 SSH 更新服务器。')
    expect(screen.queryByRole('button', { name: '立即更新' })).toBeNull()
    expect(screen.getByRole('button', { name: '稍后' })).not.toBeNull()
  })
})

describe('waitForVersion', () => {
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
