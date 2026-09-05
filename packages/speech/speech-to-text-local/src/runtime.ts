/** Explicit local Whisper executable discovery for the installed runtime. */

import { constants, existsSync, statSync } from 'node:fs'
import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const EXECUTABLE_NAME = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'

/**
 * Return the installed nodejs-whisper package directory used by its command builder.
 * @returns the package directory containing the bundled whisper.cpp checkout.
 */
export function whisperPackageRoot(): string {
  return dirname(dirname(require.resolve('nodejs-whisper')))
}

/**
 * Return the native executable path used by nodejs-whisper's command builder.
 * @param packageRoot - installed nodejs-whisper package directory.
 * @returns the first supported executable location, whether or not it exists.
 */
export function whisperExecutablePath(packageRoot = whisperPackageRoot()): string {
  const sourceRoot = join(packageRoot, 'cpp', 'whisper.cpp')
  const candidates = [
    join(sourceRoot, 'build', 'bin', EXECUTABLE_NAME),
    join(sourceRoot, 'build', 'bin', 'Release', EXECUTABLE_NAME),
    join(sourceRoot, 'build', EXECUTABLE_NAME),
    join(sourceRoot, EXECUTABLE_NAME),
  ]
  return candidates.find(path => existsSync(path) && isRegularFile(path))
    ?? join(sourceRoot, 'build', 'bin', EXECUTABLE_NAME)
}

function isRegularFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/**
 * Return whether an executable exists and can be launched by the current user.
 * @param packageRoot - installed nodejs-whisper package directory.
 * @returns whether the package's whisper-cli passes the executable access check.
 */
export async function isWhisperExecutableReady(packageRoot = whisperPackageRoot()): Promise<boolean> {
  const executable = whisperExecutablePath(packageRoot)
  try {
    await access(executable, constants.X_OK)
    return isRegularFile(executable)
  } catch {
    return false
  }
}

/**
 * Require the CLI prepared by runtime installation before transcription starts.
 * @param packageRoot - Installed nodejs-whisper directory; defaults to the active package.
 * @returns completion when the executable is ready for nodejs-whisper.
 */
export async function requireWhisperExecutable(packageRoot = whisperPackageRoot()): Promise<void> {
  if (await isWhisperExecutableReady(packageRoot)) return
  throw new Error(
    'The local Whisper executable is not installed. Run the runtime install command to prepare whisper-cli, then retry.',
  )
}
