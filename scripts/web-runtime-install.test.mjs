import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { isRuntimeInstalled, resolveNpmInvocation, whisperExecutablePath } from './web-runtime-install.mjs'

test('recognizes the CMake output path and complete runtime', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-runtime-install-'))
  try {
    const executableName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
    const executable = join(root, 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp', 'build', 'bin', executableName)
    mkdirSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    mkdirSync(join(root, 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp', 'build', 'bin'), { recursive: true })
    writeFileSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '')
    writeFileSync(executable, '')
    assert.equal(whisperExecutablePath(root), executable)
    assert.equal(isRuntimeInstalled(root), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('uses the npm CLI installed beside the selected Node executable', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-runtime-node-'))
  try {
    const nodePath = join(root, 'bin', 'node')
    const npmCli = join(root, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
    mkdirSync(join(root, 'bin'), { recursive: true })
    mkdirSync(join(root, 'lib', 'node_modules', 'npm', 'bin'), { recursive: true })
    writeFileSync(nodePath, '')
    writeFileSync(npmCli, '')
    assert.deepEqual(resolveNpmInvocation(nodePath, 'darwin'), { command: nodePath, args: [npmCli] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
