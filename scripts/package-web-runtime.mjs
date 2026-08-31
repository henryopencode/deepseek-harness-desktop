import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliManifest = JSON.parse(readFileSync(join(root, 'apps/cli/package.json'), 'utf8'))
const version = cliManifest.version
if (typeof version !== 'string' || version.length === 0) throw new Error('apps/cli/package.json must declare a version')

const required = [
  join(root, 'apps/cli/lib/bin.js'),
  join(root, 'apps/web/dist/index.html'),
  join(root, '.dsh-build/client-build-environment.json'),
]
for (const path of required) if (!existsSync(path)) throw new Error('missing official build artifact: ' + path)

const releaseRoot = resolve(root, 'release')
const stagingName = 'deepseek-harness-web-v' + version
const staging = join(releaseRoot, stagingName)
const activeVersion = 'v' + version
const versionRoot = join(staging, 'versions', activeVersion)
const npmDir = join(versionRoot, 'npm')
const vendorDir = join(versionRoot, 'npm-vendor')
const landlockDir = join(versionRoot, 'npm-landlock')
const tarballDir = join(versionRoot, 'tarballs')
rmSync(staging, { recursive: true, force: true })
mkdirSync(npmDir, { recursive: true })
mkdirSync(vendorDir, { recursive: true })
mkdirSync(landlockDir, { recursive: true })
mkdirSync(tarballDir, { recursive: true })

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })
}

run('pnpm', ['run', 'release:pack', '--family', 'dsh', '--out', 'release/' + stagingName + '/versions/' + activeVersion + '/npm'])
run('pnpm', ['run', 'release:pack', '--family', 'vendor', '--out', 'release/' + stagingName + '/versions/' + activeVersion + '/npm-vendor'])
run('pnpm', ['--dir', 'native/landlock-run', 'run', 'build:ts'])
run('pnpm', ['--dir', join(root, 'native/landlock-run/packages/entry'), 'pack', '--pack-destination', landlockDir])

for (const directory of [npmDir, vendorDir, landlockDir]) {
  for (const filename of readdirSync(directory).filter(name => name.endsWith('.tgz'))) {
    copyFileSync(join(directory, filename), join(tarballDir, filename))
  }
}

function packedIdentity(tarball) {
  const manifest = JSON.parse(execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' }))
  if (typeof manifest.name !== 'string') throw new Error(tarball + ' has no package name')
  return manifest.name
}

const dependencies = {}
for (const filename of readdirSync(tarballDir).filter(name => name.endsWith('.tgz')).sort()) {
  const tarball = join(tarballDir, filename)
  const name = packedIdentity(tarball)
  if (dependencies[name] !== undefined) throw new Error('duplicate packed package ' + name)
  dependencies[name] = 'file:./tarballs/' + filename
}

writeFileSync(join(versionRoot, 'package.json'), JSON.stringify({
  name: 'deepseek-harness-web-runtime-' + version,
  version,
  private: true,
  description: 'Portable Web runtime for DeepSeek Harness',
  dependencies,
}, null, 2) + '\n')

writeFileSync(join(staging, 'current.json'), JSON.stringify({ version: activeVersion }) + '\n')

function releaseRepository() {
  const configured = process.env.DSH_UPDATE_REPOSITORY
  if (configured !== undefined) {
    if (!/^[^/]+\/[^/]+$/.test(configured)) throw new Error('DSH_UPDATE_REPOSITORY must use the owner/repository form')
    return configured
  }
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim()
    const match = /(?:github\.com[:/])([^/]+\/[^/#]+?)(?:\.git)?$/u.exec(remote)
    if (match !== null) return match[1]
  } catch {}
  throw new Error('Set DSH_UPDATE_REPOSITORY=owner/repository when packaging the Web runtime')
}

writeFileSync(join(staging, 'update-config.json'), JSON.stringify({ repository: releaseRepository() }, null, 2) + '\n')

writeFileSync(join(staging, 'install.mjs'), [
  "import { existsSync, readFileSync } from 'node:fs'",
  "import { dirname, join } from 'node:path'",
  "import { fileURLToPath } from 'node:url'",
  "import { isRuntimeInstalled } from './web-runtime-install.mjs'",
  "import { installRuntimeDependencies } from './web-runtime-install.mjs'",
  "const webRuntimeRoot = dirname(fileURLToPath(import.meta.url))",
  "const current = JSON.parse(readFileSync(join(webRuntimeRoot, 'current.json'), 'utf8'))",
  "if (typeof current.version !== 'string') throw new Error('The extracted runtime has no active version')",
  "const runtimeRoot = join(webRuntimeRoot, 'versions', current.version)",
  "if (!existsSync(join(runtimeRoot, 'package.json'))) throw new Error('The extracted runtime is incomplete')",
  'installRuntimeDependencies(runtimeRoot)',
].join('\n') + '\n')

copyFileSync(join(root, 'scripts/web-runtime-manager.mjs'), join(staging, 'manage.mjs'))
copyFileSync(join(root, 'scripts/web-runtime-update.mjs'), join(staging, 'update.mjs'))
copyFileSync(join(root, 'scripts/web-runtime-install.mjs'), join(staging, 'web-runtime-install.mjs'))

for (const [entry, command] of [['start.mjs', 'start'], ['stop.mjs', 'stop'], ['status.mjs', 'status']]) {
  writeFileSync(join(staging, entry), [
    "import { run } from './manage.mjs'",
    "process.exitCode = await run('" + command + "', process.argv.slice(2))",
  ].join('\n') + '\n')
}

writeFileSync(join(staging, 'run.mjs'), [
  "import { spawn } from 'node:child_process'",
  "import { existsSync, readFileSync } from 'node:fs'",
  "import { dirname, join } from 'node:path'",
  "import { fileURLToPath } from 'node:url'",
  "const webRuntimeRoot = dirname(fileURLToPath(import.meta.url))",
  "const current = JSON.parse(readFileSync(join(webRuntimeRoot, 'current.json'), 'utf8'))",
  "if (typeof current.version !== 'string') throw new Error('The extracted runtime has no active version')",
  "const runtimeRoot = join(webRuntimeRoot, 'versions', current.version)",
  "const bin = join(runtimeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')",
  "if (!existsSync(bin) || !isRuntimeInstalled(runtimeRoot)) throw new Error('Runtime is not installed. Run node install.mjs first.')",
  "const args = process.argv.slice(2)",
  "const child = spawn(process.execPath, [bin, ...(args.length === 0 ? ['web'] : args)], { stdio: 'inherit', cwd: runtimeRoot, env: { ...process.env, DSH_RUNTIME_ROOT: runtimeRoot, DSH_WEB_RUNTIME_ROOT: webRuntimeRoot } })",
  "child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exit(code ?? 1) })",
].join('\n') + '\n')

writeFileSync(join(staging, 'README.md'), [
  '# DeepSeek Harness Web Runtime',
  '',
  'This archive is the single cross-platform runtime for the browser Web UI. It contains the built dsh packages and frontend, but no Electron shell and no user data.',
  '',
  '## Install and run',
  '',
  '1. Install Node.js 22.19 or newer (Node.js 24 is recommended).',
  '2. Extract this archive.',
  '3. Run node install.mjs in the extracted directory. It resolves JavaScript dependencies and builds the local Whisper CLI; CMake plus a native C/C++ build toolchain are required for that step.',
  '4. Run node run.mjs web --no-open and open the printed URL. Omit --no-open for a local launch that opens the default browser.',
  '',
  'User settings, credentials, sessions, workspaces, and the local Whisper model stay outside this archive in the normal Harness home. Set DSH_HOME when a separate data directory is required.',
  '',
  'For background operation, run node start.mjs, node status.mjs, and node stop.mjs. The PID file and log stay in .dsh-runtime inside this directory. Pass Web options to start.mjs, for example node start.mjs --port 8080.',
  '',
  'The browser checks the configured GitHub Release feed in the background. When a newer version is available, it asks before downloading, verifying, switching versions, and restarting the background service. You can also run node update.mjs --check or node update.mjs --yes manually. Updates replace only the active runtime version; user settings, credentials, sessions, workspaces, and local Whisper models remain outside this archive.',
  '',
].join('\n'))
writeFileSync(join(staging, 'README.zh.md'), [
  '# DeepSeek Harness Web 运行包',
  '',
  '这是浏览器 Web UI 的统一跨平台运行包。归档包含构建好的 dsh 包和前端，不包含 Electron 外壳，也不包含用户数据。',
  '',
  '## 安装与运行',
  '',
  '1. 安装 Node.js 22.19 或更高版本（推荐 Node.js 24）。',
  '2. 解压归档。',
  '3. 在解压目录运行 node install.mjs。它会解析 JavaScript 依赖并构建本地 Whisper CLI；这一步需要 CMake 和本机 C/C++ 构建工具链。',
  '4. 运行 node run.mjs web --no-open，打开终端打印的 URL。本地启动时省略 --no-open 会自动打开默认浏览器。',
  '',
  '用户设置、凭据、会话、工作区和本地 Whisper 模型保存在归档之外的 Harness home 中。如需独立数据目录，可设置 DSH_HOME。',
  '',
  '如需后台运行，使用 node start.mjs、node status.mjs 和 node stop.mjs。PID 文件和日志保存在本目录的 .dsh-runtime 中。可在 start.mjs 后传入 Web 参数，例如 node start.mjs --port 8080。',
  '',
  '浏览器会在后台检查配置的 GitHub Release；发现新版本后，会先征求确认，再下载、校验、切换版本并重启后台服务。也可以手动运行 node update.mjs --check 或 node update.mjs --yes。更新只替换当前运行版本，用户设置、凭据、会话、工作区和本地 Whisper 模型始终保存在归档之外。',
  '',
].join('\n'))

rmSync(npmDir, { recursive: true, force: true })
rmSync(vendorDir, { recursive: true, force: true })
rmSync(landlockDir, { recursive: true, force: true })

const archive = join(releaseRoot, stagingName + '.tar.gz')
rmSync(archive, { force: true })
run('tar', ['-czf', archive, '-C', releaseRoot, basename(staging)])
const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex')
writeFileSync(archive + '.sha256', checksum + '  ' + basename(archive) + '\n')
console.log('web runtime: ' + archive)
