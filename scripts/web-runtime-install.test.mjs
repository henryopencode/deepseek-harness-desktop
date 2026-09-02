import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installRuntimeDependencies } from './web-runtime-install.mjs'

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
          writeFileSync(whisperExecutable(root), '')
        }
        return 0
      },
    })
    assert.deepEqual(steps, ['dependencies', 'whisper-configuring', 'whisper-building', 'verifying-runtime'])
    assert.deepEqual(calls.map(call => call.command), [process.execPath, 'cmake', 'cmake'])
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
    writeFileSync(whisperExecutable(root), '')
    await installRuntimeDependencies(root, {
      onStep: step => { steps.push(step) },
      runCommand: async () => 0,
    })
    assert.deepEqual(steps, ['dependencies', 'verifying-runtime'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
