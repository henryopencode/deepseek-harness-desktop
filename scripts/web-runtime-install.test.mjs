import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installRuntimeDependencies, isRuntimeInstalled, resolveNpmInvocation, whisperExecutablePath } from './web-runtime-install.mjs'

const WHISPER_CPP_PATH = ['node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp']

function whisperExecutable(root) {
  return join(root, ...WHISPER_CPP_PATH, 'build', 'bin', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')
}

function dshExecutable(root) {
  return join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

test('reports each first-install milestone while commands run asynchronously', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-web-runtime-install-'))
  const steps = []
  const calls = []
  try {
    mkdirSync(join(root, ...WHISPER_CPP_PATH), { recursive: true })
    await installRuntimeDependencies(root, {
      onStep: step => { steps.push(step) },
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd })
        if (args.includes('install')) {
          mkdirSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
          writeFileSync(dshExecutable(root), '')
        }
        if (command === 'cmake' && args[0] === '--build') {
          mkdirSync(join(cwd, 'build', 'bin'), { recursive: true })
          writeFileSync(whisperExecutable(root), '', { mode: 0o755 })
        }
        return 0
      },
    })
    assert.deepEqual(steps, ['dependencies', 'whisper-configuring', 'whisper-building', 'verifying-runtime'])
    assert.deepEqual(calls.map(call => call.command), [resolveNpmInvocation().command, 'cmake', 'cmake'])
    assert.ok(calls[0]?.args.includes('--legacy-peer-deps'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('skips native build milestones when the packaged Whisper executable exists', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-web-runtime-install-existing-'))
  const steps = []
  try {
    mkdirSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    mkdirSync(join(root, ...WHISPER_CPP_PATH, 'build', 'bin'), { recursive: true })
    writeFileSync(dshExecutable(root), '')
    writeFileSync(whisperExecutable(root), '', { mode: 0o755 })
    await installRuntimeDependencies(root, {
      onStep: step => { steps.push(step) },
      runCommand: async () => 0,
    })
    assert.deepEqual(steps, ['dependencies', 'verifying-runtime'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('does not accept a directory at the Whisper executable path as an installed runtime', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-web-runtime-install-invalid-executable-'))
  try {
    mkdirSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    mkdirSync(join(root, ...WHISPER_CPP_PATH, 'build', 'bin'), { recursive: true })
    writeFileSync(dshExecutable(root), '')
    mkdirSync(whisperExecutable(root))
    await assert.rejects(
      installRuntimeDependencies(root, { runCommand: async () => 0 }),
      /Could not install runtime dependencies|local Whisper executable|Whisper build completed/u,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('accepts only a regular executable file as a ready runtime', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-web-runtime-install-readiness-'))
  try {
    mkdirSync(join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib'), { recursive: true })
    mkdirSync(join(root, ...WHISPER_CPP_PATH, 'build', 'bin'), { recursive: true })
    writeFileSync(dshExecutable(root), '')
    assert.equal(whisperExecutablePath(root), undefined)
    assert.equal(isRuntimeInstalled(root), false)

    writeFileSync(whisperExecutable(root), '')
    if (process.platform !== 'win32') {
      assert.equal(whisperExecutablePath(root), undefined)
      assert.equal(isRuntimeInstalled(root), false)
    }

    chmodSync(whisperExecutable(root), 0o755)
    assert.equal(whisperExecutablePath(root), whisperExecutable(root))
    assert.equal(isRuntimeInstalled(root), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
