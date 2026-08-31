import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const DSH_BIN_PATH = ['node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js']
const WHISPER_CPP_PATH = ['node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp']

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
  return candidates.find(existsSync)
}

/**
 * Run one CMake command and name a missing CMake installation explicitly.
 * @param {string} sourceRoot - Bundled whisper.cpp source directory.
 * @param {string[]} args - CMake arguments.
 */
function runCmake(sourceRoot, args) {
  const result = spawnSync('cmake', args, { cwd: sourceRoot, stdio: 'inherit' })
  if (result.error?.code === 'ENOENT') {
    throw new Error('Local speech transcription requires CMake and a native C/C++ build toolchain. Install them, then run node install.mjs again.')
  }
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Could not build the local Whisper executable.')
}

/**
 * Build the native Whisper CLI beside nodejs-whisper when the package install did not supply it.
 * @param {string} runtimeRoot - Installed version directory.
 */
export function ensureWhisperCli(runtimeRoot) {
  if (whisperExecutablePath(runtimeRoot) !== undefined) return
  const sourceRoot = join(runtimeRoot, ...WHISPER_CPP_PATH)
  if (!existsSync(sourceRoot)) throw new Error('Runtime dependency nodejs-whisper is incomplete after installation.')
  runCmake(sourceRoot, ['-B', 'build'])
  runCmake(sourceRoot, ['--build', 'build', '--target', 'whisper-cli', '--config', 'Release'])
  if (whisperExecutablePath(runtimeRoot) === undefined) throw new Error('Whisper build completed without a whisper-cli executable.')
}

/**
 * Install JavaScript dependencies and their required local Whisper executable.
 * @param {string} runtimeRoot - Installed version directory.
 */
export function installRuntimeDependencies(runtimeRoot) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npm, ['install', '--no-audit', '--no-fund', '--omit=dev'], { cwd: runtimeRoot, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Could not install runtime dependencies.')
  if (!existsSync(join(runtimeRoot, ...DSH_BIN_PATH))) throw new Error('Runtime dependency installation did not provide the dsh executable.')
  ensureWhisperCli(runtimeRoot)
}

/**
 * Report whether a version has both its dsh entry point and local Whisper executable.
 * @param {string} runtimeRoot - Installed version directory.
 * @returns {boolean} Whether the runtime can start local speech transcription.
 */
export function isRuntimeInstalled(runtimeRoot) {
  return existsSync(join(runtimeRoot, ...DSH_BIN_PATH)) && whisperExecutablePath(runtimeRoot) !== undefined
}
