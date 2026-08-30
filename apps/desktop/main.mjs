import electron from 'electron'
import { createServer } from 'node:net'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { desktopProfileName, prepareDesktopProfile } from './profile.mjs'
import { resolveDesktopRuntime } from './runtime.mjs'

const { app, BrowserWindow, Menu, session, shell, systemPreferences } = electron
const productName = 'DeepSeek Harness'

app.setName(productName)
if (process.platform === 'win32') app.setAppUserModelId('ai.deepseek.harness.desktop')
const hasSingleInstanceLock = app.requestSingleInstanceLock()

const appDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryDirectory = resolve(appDirectory, '../..')
const bundledRuntimeDirectory = join(process.resourcesPath, 'runtime')
const developmentNodeExecutable = process.env.DSH_DESKTOP_NODE ?? process.env.npm_node_execpath ?? process.execPath
const inheritedEnvironment = process.env
const homeDirectory = inheritedEnvironment.HOME ?? inheritedEnvironment.USERPROFILE
const temporaryDirectory = inheritedEnvironment.TMPDIR ?? inheritedEnvironment.TEMP ?? inheritedEnvironment.TMP
const proxyEnvironment = Object.fromEntries(['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'].flatMap(name => {
  const value = inheritedEnvironment[name] ?? inheritedEnvironment[name.toLowerCase()]
  return value === undefined || value === '' ? [] : [[name, value]]
}))
function childEnvironment(nodeExecutable) {
  const childPath = process.platform === 'win32'
    ? [dirname(nodeExecutable), `${inheritedEnvironment.SystemRoot ?? 'C:\\Windows'}\\System32`, inheritedEnvironment.SystemRoot ?? 'C:\\Windows'].join(';')
    : [dirname(nodeExecutable), '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':')
  return Object.fromEntries([
    ['HOME', homeDirectory],
    ['USER', inheritedEnvironment.USER ?? inheritedEnvironment.USERNAME],
    ['LOGNAME', inheritedEnvironment.LOGNAME ?? inheritedEnvironment.USERNAME],
    ['LANG', inheritedEnvironment.LANG ?? 'en_US.UTF-8'],
    ['TMPDIR', temporaryDirectory],
    ['PATH', childPath],
    ['NODE_USE_ENV_PROXY', Object.keys(proxyEnvironment).length > 0 ? '1' : inheritedEnvironment.NODE_USE_ENV_PROXY],
    ...process.platform === 'win32' ? [
      ['APPDATA', inheritedEnvironment.APPDATA],
      ['ComSpec', inheritedEnvironment.ComSpec],
      ['HOMEDRIVE', inheritedEnvironment.HOMEDRIVE],
      ['HOMEPATH', inheritedEnvironment.HOMEPATH],
      ['LOCALAPPDATA', inheritedEnvironment.LOCALAPPDATA],
      ['PATHEXT', inheritedEnvironment.PATHEXT],
      ['SystemRoot', inheritedEnvironment.SystemRoot],
      ['TEMP', inheritedEnvironment.TEMP],
      ['TMP', inheritedEnvironment.TMP],
      ['USERPROFILE', inheritedEnvironment.USERPROFILE],
      ['WINDIR', inheritedEnvironment.WINDIR],
    ] : [],
    ...Object.entries(proxyEnvironment),
  ].filter(([, value]) => value !== undefined && value !== ''))
}

let mainWindow
let harnessProcess
let harnessPort
let harnessLog
let harnessLogHandle

/** Focus the one application window when a second launch requests the product. */
function focusMainWindow() {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const desktopWebRuntimePatch = `# The desktop shell owns the local page and never hands it to an external browser.
- id: web-runtime
  config:
    openBrowser: false
    printUrl: false
    surfaceContext: true
    trustedHosts: []
`
/** Escape one diagnostic value before rendering it into the local status page. */
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character])
}

/** Render a small local launcher status page before Harness has its own UI. */
async function showStatus(title, detail) {
  await mainWindow.loadURL(`data:text/html,${encodeURIComponent(`<!doctype html>
<meta charset="utf-8">
<style>
  html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
  body { background: #fff; color: #202124; }
  main { box-sizing: border-box; display: grid; place-items: center; width: 100%; height: 100%; padding: 24px; font: 16px -apple-system, BlinkMacSystemFont, sans-serif; }
  section { max-width: 560px; text-align: center; }
</style>
<main>
  <section>
    <h1>${escapeHtml(title)}</h1>
    <p style="color:#5f6368;line-height:1.6">${escapeHtml(detail)}</p>
  </section>
</main>`)} `)
}

/** Close the child's diagnostic handle after its process tree has stopped. */
function closeHarnessLog() {
  const handle = harnessLogHandle
  harnessLogHandle = undefined
  if (handle !== undefined) void handle.close().catch(() => {
    // A closed diagnostic file never changes the child process outcome.
  })
}

/** Quote one literal for the POSIX shell that owns the packaged macOS child process. */
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

/** Write the final web-runtime overlay that keeps the private page inside Electron. */
async function writeDesktopWebRuntimePatch() {
  const stateDirectory = app.getPath('userData')
  await mkdir(stateDirectory, { recursive: true })
  const patch = join(stateDirectory, 'desktop-web-runtime.patch.yml')
  await writeFile(patch, desktopWebRuntimePatch, 'utf8')
  return patch
}

/** Reserve one loopback port before the owned child starts its web listener. */
async function reservePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('could not reserve a loopback port'))
        return
      }
      const { port } = address
      server.close((error) => error === undefined ? resolvePort(port) : reject(error))
    })
  })
}

/** Wait for the private Harness server to return its first successful response. */
async function waitForHarness(url) {
  const deadline = Date.now() + 60_000
  let lastError = 'server did not respond'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 350))
  }
  throw new Error(`DeepSeek Harness did not start: ${lastError}`)
}

/** Stop the child process and all children it owns. */
function stopHarness() {
  if (harnessProcess?.pid === undefined) return
  const { pid } = harnessProcess
  harnessProcess = undefined
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true }).unref()
    return
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    // The child already exited, so there is no owned process group left to stop.
  }
}

/** Start the packaged CLI as an owned private loopback server. */
async function startHarness() {
  harnessPort = await reservePort()
  const runtime = app.isPackaged
    ? await resolveDesktopRuntime({
      homeDirectory,
      bundledRuntimeDirectory,
      platform: process.platform,
      arch: process.arch,
    })
    : {
      harnessDirectory: repositoryDirectory,
      nodeExecutable: developmentNodeExecutable,
      source: 'development',
    }
  await prepareDesktopProfile(homeDirectory, runtime.harnessDirectory)
  console.info(`[desktop] using ${runtime.source} runtime${runtime.version === undefined ? '' : ` ${runtime.version}`}`)
  const logDirectory = join(app.getPath('userData'), 'logs')
  await mkdir(logDirectory, { recursive: true })
  harnessLog = join(logDirectory, 'harness.log')
  harnessLogHandle = await open(harnessLog, 'a')
  const runtimePatch = await writeDesktopWebRuntimePatch()
  const cli = app.isPackaged
    ? join(runtime.harnessDirectory, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    : join(runtime.harnessDirectory, 'apps', 'cli', 'lib', 'bin.js')
  const harnessArgs = [
    cli,
    '--profile', desktopProfileName,
    '--patch', runtimePatch,
    '--no-open',
    '--port', String(harnessPort),
  ]
  const useWindowsLauncher = process.platform === 'win32'
  harnessProcess = spawn(
    useWindowsLauncher ? runtime.nodeExecutable : '/bin/sh',
    useWindowsLauncher ? harnessArgs : ['-c', `${[runtime.nodeExecutable, ...harnessArgs].map(shellQuote).join(' ')} & wait $!`],
    {
    cwd: runtime.harnessDirectory,
    detached: process.platform !== 'win32',
    windowsHide: true,
    // Electron exposes pipe output as Unix sockets on macOS. A packaged Node
    // child can stall before loading its modules on those descriptors, so the
    // child's own stdout and stderr go straight to its diagnostic file.
    stdio: ['ignore', harnessLogHandle.fd, harnessLogHandle.fd],
    env: childEnvironment(runtime.nodeExecutable),
    },
  )
  harnessProcess.on('error', error => {
    closeHarnessLog()
    console.error(`[harness] ${error.message}`)
  })
  harnessProcess.on('exit', (code, signal) => {
    closeHarnessLog()
    if (harnessProcess === undefined || mainWindow?.isDestroyed()) return
    void showStatus('DeepSeek Harness 已停止', `code: ${String(code)}，signal: ${String(signal)}。日志：${harnessLog ?? '不可用'}`)
  })
  await waitForHarness(`http://127.0.0.1:${String(harnessPort)}/`)
}

/** Create the shell window and attach it to the locally owned Harness server. */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: productName,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${String(harnessPort)}/`)) return { action: 'deny' }
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { editFlags } = params
    const template = []
    if (params.isEditable) {
      if (editFlags.canUndo) template.push({ label: '撤销', click: () => mainWindow?.webContents.undo() })
      if (editFlags.canRedo) template.push({ label: '重做', click: () => mainWindow?.webContents.redo() })
      if (editFlags.canUndo || editFlags.canRedo) template.push({ type: 'separator' })
      if (editFlags.canCut) template.push({ label: '剪切', click: () => mainWindow?.webContents.cut() })
      if (editFlags.canCopy) template.push({ label: '复制', click: () => mainWindow?.webContents.copy() })
      if (editFlags.canPaste) template.push({ label: '粘贴', click: () => mainWindow?.webContents.paste() })
      if (editFlags.canCut || editFlags.canCopy || editFlags.canPaste) template.push({ type: 'separator' })
    } else if (params.editFlags.canCopy && params.selectionText.trim() !== '') {
      template.push({ label: '复制', click: () => mainWindow?.webContents.copy() })
    }
    if (editFlags.canSelectAll) template.push({ label: '全选', click: () => mainWindow?.webContents.selectAll() })
    if (params.linkURL !== '') {
      if (template.length > 0) template.push({ type: 'separator' })
      template.push({ label: '在浏览器中打开链接', click: () => void shell.openExternal(params.linkURL) })
    }
    if (template.length === 0) return
    const contextMenu = Menu.buildFromTemplate(template)
    contextMenu.popup({ window: mainWindow })
  })
  await showStatus(`正在启动 ${productName}…`, '正在准备本地服务。')
  await startHarness()
  await mainWindow.loadURL(`http://127.0.0.1:${String(harnessPort)}/`)
  focusMainWindow()
}

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowed = permission === 'media'
      && details.mediaTypes?.includes('audio') === true
      && webContents.getURL() === `http://127.0.0.1:${String(harnessPort)}/`
    callback(allowed)
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: productName,
      submenu: [
        { label: `关于 ${productName}`, role: 'about' },
        { label: `隐藏 ${productName}`, role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '显示',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换全屏', role: 'togglefullscreen' },
      ],
    },
  ]))
  try {
    await createWindow()
    if (process.platform === 'darwin') void systemPreferences.askForMediaAccess('microphone')
  } catch (error) {
    console.error(error)
    if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
      await showStatus('DeepSeek Harness 启动失败', error instanceof Error ? error.message : String(error))
    }
  }
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', stopHarness)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  else focusMainWindow()
})

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)
}
