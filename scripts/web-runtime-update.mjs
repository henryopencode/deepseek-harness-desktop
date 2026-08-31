import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const runtimeRoot = resolve(process.env.DSH_WEB_RUNTIME_ROOT ?? dirname(fileURLToPath(import.meta.url)))
const stateRoot = join(runtimeRoot, '.dsh-runtime')
const versionsRoot = join(runtimeRoot, 'versions')
const currentPath = join(runtimeRoot, 'current.json')
const configPath = join(runtimeRoot, 'update-config.json')
const lockPath = join(stateRoot, '.operation.lock')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function activeVersion() {
  if (!existsSync(currentPath)) throw new Error('Runtime is not installed. Run node install.mjs first.')
  const version = readJson(currentPath).version
  if (typeof version !== 'string' || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('current.json has no valid runtime version')
  }
  return version.slice(1)
}

export function compareVersions(left, right) {
  const parse = value => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value)
    if (match === null) throw new Error('unsupported version ' + JSON.stringify(value))
    return [Number(match[1]), Number(match[2]), Number(match[3]), match[4]?.split('.')]
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index]
  if (a[3] === b[3]) return 0
  if (a[3] === undefined) return 1
  if (b[3] === undefined) return -1
  const length = Math.max(a[3].length, b[3].length)
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = a[3][index]
    const rightIdentifier = b[3][index]
    if (leftIdentifier === undefined) return -1
    if (rightIdentifier === undefined) return 1
    const leftNumeric = /^\d+$/u.test(leftIdentifier)
    const rightNumeric = /^\d+$/u.test(rightIdentifier)
    if (leftNumeric && rightNumeric) {
      const difference = Number(leftIdentifier) - Number(rightIdentifier)
      if (difference !== 0) return difference
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1
    } else if (leftIdentifier !== rightIdentifier) {
      return leftIdentifier < rightIdentifier ? -1 : 1
    }
  }
  return 0
}

function updateApiBase() {
  return (process.env.DSH_UPDATE_API_BASE_URL ?? 'https://api.github.com').replace(/\/$/u, '')
}

function releaseConfig() {
  const config = readJson(configPath)
  if (typeof config.repository !== 'string' || !/^[^/]+\/[^/]+$/.test(config.repository)) {
    throw new Error('update-config.json has no valid repository')
  }
  return {
    repository: config.repository,
    apiBaseUrl: typeof config.apiBaseUrl === 'string' ? config.apiBaseUrl.replace(/\/$/u, '') : updateApiBase(),
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'deepseek-harness-web-runtime' },
  })
  if (!response.ok) throw new Error('update server returned HTTP ' + response.status)
  return response.json()
}

export function releaseVersion(tag) {
  return /^dsh-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag)?.[1]
}

export async function checkForUpdate() {
  const config = releaseConfig()
  const current = activeVersion()
  const releases = await fetchJson(config.apiBaseUrl + '/repos/' + config.repository + '/releases?per_page=30')
  if (!Array.isArray(releases)) throw new Error('update server returned an invalid release list')
  const candidates = releases
    .map(release => ({ release, version: releaseVersion(release?.tag_name) }))
    .filter(candidate => candidate.version !== undefined)
    .sort((left, right) => compareVersions(right.version, left.version))
  const candidate = candidates[0]
  if (candidate === undefined) throw new Error('update server has no dsh-v<version> release')
  const latest = candidate.version
  const release = candidate.release
  const available = compareVersions(latest, current) > 0
  const prefix = 'deepseek-harness-web-v' + latest
  const assets = Array.isArray(release.assets) ? release.assets : []
  const archive = assets.find(asset => asset?.name === prefix + '.tar.gz')
  const checksum = assets.find(asset => asset?.name === prefix + '.tar.gz.sha256')
  if (available && (archive?.browser_download_url === undefined || checksum?.browser_download_url === undefined)) {
    throw new Error('latest release is missing the Web archive or SHA-256 asset')
  }
  return {
    currentVersion: current,
    latestVersion: latest,
    updateAvailable: available,
    releaseUrl: typeof release.html_url === 'string' ? release.html_url : undefined,
    archiveUrl: archive?.browser_download_url,
    checksumUrl: checksum?.browser_download_url,
  }
}

async function downloadBytes(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'deepseek-harness-web-runtime' } })
  if (!response.ok) throw new Error('download returned HTTP ' + response.status)
  return Buffer.from(await response.arrayBuffer())
}

export function expectedChecksum(text, filename) {
  const line = text.trim().split(/\r?\n/u).find(value => value.trim() !== '')
  const match = line?.match(/^([0-9a-f]{64})\s+(?:\*|)(.+)$/i)
  if (match === undefined || match === null || match[2] !== filename) {
    throw new Error('checksum asset has an unexpected format')
  }
  return match[1].toLowerCase()
}

export function assertArchiveEntries(archivePath, topDirectory) {
  const output = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' })
  const entries = output.split(/\r?\n/u).filter(Boolean)
  const prefix = topDirectory + '/'
  if (!entries.includes(prefix)) throw new Error('archive has no expected top-level directory')
  for (const entry of entries) {
    if (!entry.startsWith(prefix) || entry.startsWith('/') || entry.includes('\\0') || entry.split('/').includes('..')) {
      throw new Error('archive contains an unsafe path: ' + entry)
    }
  }
  const detail = execFileSync('tar', ['-tvzf', archivePath], { encoding: 'utf8' })
  if (detail.split(/\r?\n/u).some(line => /^[lh]/u.test(line))) throw new Error('archive contains a link entry')
}

function readPid() {
  const path = join(stateRoot, '.web.pid')
  if (!existsSync(path)) return undefined
  const value = Number.parseInt(readFileSync(path, 'utf8').trim(), 10)
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

async function stopProcess(pid) {
  if (!isAlive(pid)) return
  process.kill(pid, 'SIGTERM')
  const deadline = Date.now() + 8_000
  while (isAlive(pid) && Date.now() < deadline) await new Promise(resolvePromise => setTimeout(resolvePromise, 100))
  if (isAlive(pid)) process.kill(pid, 'SIGKILL')
}

function savedStartArgs() {
  const path = join(stateRoot, '.web.args.json')
  if (!existsSync(path)) return []
  const value = readJson(path)
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : []
}

function writeCurrent(version) {
  const temporary = currentPath + '.tmp-' + process.pid
  writeFileSync(temporary, JSON.stringify({ version: 'v' + version }) + '\n')
  renameSync(temporary, currentPath)
}

function startService(args) {
  const started = spawnSync(process.execPath, [join(runtimeRoot, 'start.mjs'), ...args], {
    cwd: runtimeRoot,
    stdio: 'inherit',
    env: { ...process.env, DSH_WEB_RUNTIME_ROOT: runtimeRoot },
  })
  return started.status === 0
}

/**
 * Confirm that an already staged version can be activated without downloading
 * it again. A prior successful update may leave this version on disk after a
 * later rollback, and replacing it would risk discarding a known-good copy.
 */
function isInstalledVersion(root) {
  return existsSync(join(root, 'package.json'))
    && existsSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
}

async function applyUpdate(info, restart) {
  if (!info.archiveUrl || !info.checksumUrl) throw new Error('update metadata has no verified download URLs')
  const archiveName = 'deepseek-harness-web-v' + info.latestVersion + '.tar.gz'
  const archiveBytes = await downloadBytes(info.archiveUrl)
  const checksumText = (await downloadBytes(info.checksumUrl)).toString('utf8')
  const expected = expectedChecksum(checksumText, archiveName)
  const actual = createHash('sha256').update(archiveBytes).digest('hex')
  if (actual !== expected) throw new Error('SHA-256 verification failed for the downloaded Web archive')

  const workRoot = join(dirname(runtimeRoot), '.dsh-update-' + process.pid + '-' + Date.now())
  const archivePath = join(workRoot, archiveName)
  const extractedRoot = join(workRoot, 'extracted')
  const topDirectory = 'deepseek-harness-web-v' + info.latestVersion
  const archiveRoot = join(extractedRoot, topDirectory)
  const stagedVersionRoot = join(archiveRoot, 'versions', 'v' + info.latestVersion)
  const targetRoot = join(versionsRoot, 'v' + info.latestVersion)
  try {
    mkdirSync(versionsRoot, { recursive: true })
    if (existsSync(targetRoot)) {
      if (!isInstalledVersion(targetRoot)) {
        throw new Error('runtime version ' + info.latestVersion + ' already exists but is incomplete')
      }
    } else {
      mkdirSync(extractedRoot, { recursive: true })
      writeFileSync(archivePath, archiveBytes)
      assertArchiveEntries(archivePath, topDirectory)
      const extracted = spawnSync('tar', ['-xzf', archivePath, '-C', extractedRoot, '--no-same-owner'], { stdio: 'inherit' })
      if (extracted.status !== 0) throw new Error('could not extract the downloaded Web archive')
      if (!existsSync(join(stagedVersionRoot, 'package.json'))) throw new Error('downloaded Web archive is incomplete')
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
      const installed = spawnSync(npm, ['install', '--no-audit', '--no-fund', '--omit=dev'], { cwd: stagedVersionRoot, stdio: 'inherit' })
      if (installed.status !== 0 || !isInstalledVersion(stagedVersionRoot)) {
        throw new Error('could not install dependencies for the downloaded Web archive')
      }
      renameSync(stagedVersionRoot, targetRoot)
    }

    const previous = activeVersion()
    const pid = readPid()
    const wasRunning = pid !== undefined && isAlive(pid)
    const args = savedStartArgs()
    if (wasRunning) await stopProcess(pid)
    writeCurrent(info.latestVersion)
    if (wasRunning && restart && !startService(args)) {
      writeCurrent(previous)
      if (!startService(args)) throw new Error('new Web runtime failed to start; the previous version was restored but could not be restarted')
      throw new Error('new Web runtime failed to start; the previous version was restored')
    }
    console.log('DeepSeek Harness Web updated from ' + info.currentVersion + ' to ' + info.latestVersion)
    if (wasRunning && restart) console.log('The background Web service was restarted.')
  } finally {
    rmSync(workRoot, { recursive: true, force: true })
  }
}

async function promptConfirmation(version) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('update confirmation requires a terminal; pass --yes to confirm explicitly')
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await readline.question('DeepSeek Harness Web ' + version + ' is available. Update now? [y/N] ')
    return /^y(?:es)?$/i.test(answer.trim())
  } finally {
    readline.close()
  }
}

export async function runUpdate(argv = process.argv.slice(2)) {
  const checkOnly = argv.includes('--check')
  const json = argv.includes('--json')
  const yes = argv.includes('--yes')
  const restart = !argv.includes('--no-restart')
  const info = await checkForUpdate()
  if (json) console.log(JSON.stringify(info))
  else if (!info.updateAvailable) console.log('DeepSeek Harness Web is up to date (' + info.currentVersion + ').')
  else console.log('DeepSeek Harness Web update available: ' + info.currentVersion + ' -> ' + info.latestVersion)
  if (checkOnly || !info.updateAvailable) return info
  const confirmed = yes || await promptConfirmation(info.latestVersion)
  if (!confirmed) {
    if (!json) console.log('Update cancelled.')
    return info
  }
  await withLock(() => applyUpdate(info, restart))
  return info
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runUpdate().catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
