import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const DSH_BIN_PATH = ['node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js']
const WHISPER_CPP_PATH = ['node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp']

/** Resolve the settings document used by a Web runtime installation. */
export function resolveRuntimeSettingsPath(dshHome = process.env.DSH_HOME) {
  const selectedHome = typeof dshHome === 'string' && dshHome.trim().length > 0
    ? dshHome
    : join(homedir(), '.dsh')
  const expandedHome = selectedHome === '~'
    ? homedir()
    : selectedHome.startsWith('~/') || selectedHome.startsWith('~\\')
      ? join(homedir(), selectedHome.slice(2))
      : selectedHome
  return join(resolve(expandedHome), 'settings.yaml')
}

/**
 * Create the user's settings document from a release template when absent.
 *
 * The exclusive create preserves an existing document, including an empty
 * document, and makes concurrent installers converge without overwriting one
 * another's settings.
 * @param {string} templatePath - Release-provided settings template.
 * @param {{ dshHome?: string; settingsPath?: string }} [options] - Optional test or deployment paths.
 * @returns {{ path: string; created: boolean }} The target and whether it was created.
 */
export function installSettingsTemplate(templatePath, options = {}) {
  const settingsPath = resolve(options.settingsPath ?? resolveRuntimeSettingsPath(options.dshHome))
  const template = readFileSync(templatePath, 'utf8')
  if (template.trim().length === 0) throw new Error('settings template is empty')
  mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 })
  try {
    writeFileSync(settingsPath, template, { flag: 'wx', mode: 0o600 })
    return { path: settingsPath, created: true }
  } catch (error) {
    if (error?.code === 'EEXIST') return { path: settingsPath, created: false }
    throw error
  }
}

/**
 * Return the CMake-produced Whisper executable for this operating system.
 * @param {string} runtimeRoot - Installed version directory.
 * @returns {string | undefined} Executable path when the native build exists.
 */
export function whisperExecutablePath(runtimeRoot) {
  const executable = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
  const sourceRoot = join(runtimeRoot, ...WHISPER_CPP_PATH)
  const candidates = [
    join(sourceRoot, 'build', 'bin', executable),
    join(sourceRoot, 'build', 'bin', 'Release', executable),
    join(sourceRoot, 'build', 'bin', 'Debug', executable),
    join(sourceRoot, 'build', executable),
    join(sourceRoot, executable),
  ]
  return candidates.find(path => {
    if (!existsSync(path)) return false
    try {
      accessSync(path, constants.X_OK)
      return statSync(path).isFile()
    } catch {
      return false
    }
  })
}

/**
 * Run one external command without blocking the updater's event loop.
 * @param {string} command - Executable name or path.
 * @param {string[]} args - Executable arguments.
 * @param {string} cwd - Working directory for the command.
 * @returns {Promise<number | null>} Process exit status.
 */
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(command, args, { cwd, stdio: 'inherit' })
    } catch (error) {
      reject(error)
      return
    }
    child.once('error', reject)
    child.once('close', resolve)
  })
}

/**
 * Run one CMake command and name a missing CMake installation explicitly.
 * @param {string} sourceRoot - Bundled whisper.cpp source directory.
 * @param {string[]} args - CMake arguments.
 * @param {(command: string, args: string[], cwd: string) => Promise<number | null>} command - Process runner.
 * @returns {Promise<void>} Resolves after CMake exits successfully.
 */
async function runCmake(sourceRoot, args, command) {
  let result
  try {
    result = await command('cmake', args, sourceRoot)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('Local speech transcription requires CMake and a native C/C++ build toolchain. Install them, then run node install.mjs again.')
    }
    throw error
  }
  if (result !== 0) throw new Error('Could not build the local Whisper executable.')
}

/**
 * Installation milestone reported by the package installer.
 * @typedef {'dependencies' | 'whisper-configuring' | 'whisper-building' | 'verifying-runtime'} RuntimeInstallStep
 */

/**
 * Build the native Whisper CLI beside nodejs-whisper when the package install did not supply it.
 * @param {string} runtimeRoot - Installed version directory.
 * @param {{ onStep?: (step: RuntimeInstallStep) => void; runCommand?: (command: string, args: string[], cwd: string) => Promise<number | null> }} [options] - Installation callbacks.
 * @returns {Promise<void>} Resolves when the executable exists.
 */
export async function ensureWhisperCli(runtimeRoot, options = {}) {
  if (whisperExecutablePath(runtimeRoot) !== undefined) return
  const sourceRoot = join(runtimeRoot, ...WHISPER_CPP_PATH)
  if (!existsSync(sourceRoot)) throw new Error('Runtime dependency nodejs-whisper is incomplete after installation.')
  const command = options.runCommand ?? runCommand
  options.onStep?.('whisper-configuring')
  await runCmake(sourceRoot, ['-B', 'build'], command)
  options.onStep?.('whisper-building')
  await runCmake(sourceRoot, ['--build', 'build', '--target', 'whisper-cli', '--config', 'Release'], command)
  if (whisperExecutablePath(runtimeRoot) === undefined) {
    throw new Error('Whisper build completed without a whisper-cli executable.')
  }
}

/**
 * Select a working npm invocation for the current Node.js installation.
 * @param {string} [nodePath] - Node.js executable path.
 * @param {NodeJS.Platform} [platform] - Operating-system platform.
 * @returns {{ command: string; args: string[] }} npm process invocation.
 */
export function resolveNpmInvocation(nodePath = process.execPath, platform = process.platform) {
  const nodeDirectory = dirname(nodePath)
  const candidates = platform === 'win32'
    ? [join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js')]
    : [
        join(nodeDirectory, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        join(nodeDirectory, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      ]
  const npmCli = candidates.find(existsSync)
  if (npmCli !== undefined) return { command: nodePath, args: [npmCli] }
  return { command: platform === 'win32' ? 'npm.cmd' : 'npm', args: [] }
}

/**
 * Install JavaScript dependencies and their required local Whisper executable.
 * @param {string} runtimeRoot - Installed version directory.
 * @param {{ onStep?: (step: RuntimeInstallStep) => void; runCommand?: (command: string, args: string[], cwd: string) => Promise<number | null> }} [options] - Installation callbacks.
 * @returns {Promise<void>} Resolves after the runtime passes its executable checks.
 */
export async function installRuntimeDependencies(runtimeRoot, options = {}) {
  const command = options.runCommand ?? runCommand
  const npm = resolveNpmInvocation()
  options.onStep?.('dependencies')
  const result = await command(
    npm.command,
    [...npm.args, 'install', '--legacy-peer-deps', '--no-audit', '--no-fund', '--omit=dev'],
    runtimeRoot,
  )
  if (result !== 0) throw new Error('Could not install runtime dependencies.')
  if (!existsSync(join(runtimeRoot, ...DSH_BIN_PATH))) throw new Error('Runtime dependency installation did not provide the dsh executable.')
  await ensureWhisperCli(runtimeRoot, { onStep: options.onStep, runCommand: command })
  options.onStep?.('verifying-runtime')
  if (!isRuntimeInstalled(runtimeRoot)) throw new Error('Runtime dependency installation did not provide the local Whisper executable.')
}

/**
 * Report whether a version has both its dsh entry point and local Whisper executable.
 * @param {string} runtimeRoot - Installed version directory.
 * @returns {boolean} Whether the runtime can start local speech transcription.
 */
export function isRuntimeInstalled(runtimeRoot) {
  return existsSync(join(runtimeRoot, ...DSH_BIN_PATH)) && whisperExecutablePath(runtimeRoot) !== undefined
}
