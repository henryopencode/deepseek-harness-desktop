import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const runtimeRoot = dirname(fileURLToPath(import.meta.url))
const stateRoot = join(runtimeRoot, '.dsh-runtime')
const currentPath = join(runtimeRoot, 'current.json')
const pidPath = join(stateRoot, '.web.pid')
const logPath = join(stateRoot, '.web.log')
const argsPath = join(stateRoot, '.web.args.json')
const lockPath = join(stateRoot, '.operation.lock')
const startupTimeoutMs = 15_000

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Resolve the immutable directory containing the active runtime version. */
export function activeRuntimeRoot() {
  if (!existsSync(currentPath)) throw new Error('Runtime is not installed. Run node install.mjs first.')
  const current = readJson(currentPath)
  if (typeof current.version !== 'string' || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(current.version)) {
    throw new Error('current.json has no valid runtime version')
  }
  const activeRoot = join(runtimeRoot, 'versions', current.version)
  if (!existsSync(join(activeRoot, 'package.json'))) throw new Error('Current runtime version is incomplete. Run node install.mjs first.')
  return activeRoot
}

function binPath() {
  return join(activeRuntimeRoot(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

function readPid() {
  if (!existsSync(pidPath)) return undefined
  const value = Number.parseInt(readFileSync(pidPath, 'utf8').trim(), 10)
  return Number.isInteger(value) && value > 0 ? value : undefined
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function clearPid() {
  rmSync(pidPath, { force: true })
}

async function withLock(operation) {
  mkdirSync(stateRoot, { recursive: true })
  let fd
  try {
    fd = openSync(lockPath, 'wx')
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('DeepSeek Harness Web is busy with another lifecycle operation')
    throw error
  }
  try {
    return await operation()
  } finally {
    closeSync(fd)
    rmSync(lockPath, { force: true })
  }
}

function requireInstalled() {
  if (!existsSync(binPath())) throw new Error('Runtime is not installed. Run node install.mjs first.')
}

function logText() {
  return existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
}

function announcedUrl() {
  const match = logText().match(/dsh web: (https?:\/\/[^\s]+)/)
  return match === null ? undefined : match[1]
}

function sleep(milliseconds) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
}

async function waitForStartup(pid) {
  const deadline = Date.now() + startupTimeoutMs
  while (Date.now() < deadline) {
    const url = announcedUrl()
    if (url !== undefined) return url
    if (!isAlive(pid)) {
      clearPid()
      throw new Error('DeepSeek Harness Web exited before startup. See ' + logPath)
    }
    await sleep(100)
  }
  throw new Error('DeepSeek Harness Web did not announce a URL within ' + (startupTimeoutMs / 1000) + 's. See ' + logPath)
}

function currentPid() {
  const pid = readPid()
  if (pid === undefined) return undefined
  if (isAlive(pid)) return pid
  clearPid()
  return undefined
}

async function startUnlocked(extraArgs) {
  requireInstalled()
  const existing = currentPid()
  if (existing !== undefined) {
    console.log(`DeepSeek Harness Web is already running (pid ${existing}).`)
    console.log('URL: ' + (announcedUrl() ?? 'not announced'))
    return 0
  }
  const activeRoot = activeRuntimeRoot()
  mkdirSync(stateRoot, { recursive: true })
  writeFileSync(logPath, '')
  writeFileSync(argsPath, JSON.stringify(extraArgs) + '\n')
  const logFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(process.execPath, [binPath(), 'web', '--no-open', ...extraArgs], {
      cwd: activeRoot,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, DSH_RUNTIME_ROOT: activeRoot, DSH_WEB_RUNTIME_ROOT: runtimeRoot },
    })
  } finally {
    closeSync(logFd)
  }
  if (child.pid === undefined) throw new Error('Could not start DeepSeek Harness Web')
  writeFileSync(pidPath, `${child.pid}\n`)
  child.unref()
  try {
    const url = await waitForStartup(child.pid)
    console.log('DeepSeek Harness Web started in background (pid ' + child.pid + ')')
    console.log('URL: ' + url)
    console.log('Log: ' + logPath)
    return 0
  } catch (error) {
    if (isAlive(child.pid)) process.kill(child.pid, 'SIGTERM')
    clearPid()
    throw error
  }
}

async function stopUnlocked() {
  const pid = readPid()
  if (pid === undefined || !isAlive(pid)) {
    clearPid()
    console.log('DeepSeek Harness Web is not running.')
    return 0
  }
  process.kill(pid, 'SIGTERM')
  const deadline = Date.now() + 8_000
  while (isAlive(pid) && Date.now() < deadline) await sleep(100)
  if (isAlive(pid)) process.kill(pid, 'SIGKILL')
  clearPid()
  console.log('DeepSeek Harness Web stopped (pid ' + pid + ')')
  return 0
}

function status() {
  const pid = currentPid()
  if (pid === undefined) {
    console.log('DeepSeek Harness Web is stopped.')
    return 0
  }
  console.log('DeepSeek Harness Web is running (pid ' + pid + ')')
  const url = announcedUrl()
  if (url !== undefined) console.log('URL: ' + url)
  console.log('Log: ' + logPath)
  return 0
}

/** Run one background lifecycle command from the stable runtime entrypoint. */
export async function run(command, extraArgs = []) {
  try {
    if (command === 'start') return await withLock(() => startUnlocked(extraArgs))
    if (command === 'stop') return await withLock(() => stopUnlocked())
    if (command === 'status') return status()
    throw new Error('Unknown command ' + JSON.stringify(command) + '. Use start, stop, or status.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv[2] ?? 'status', process.argv.slice(3))
}
