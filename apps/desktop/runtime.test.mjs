import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  activateDesktopRuntime,
  createDesktopRuntimeManifest,
  desktopRuntimeRoot,
  installDesktopRuntime,
  resolveDesktopRuntime,
} from './runtime.mjs'

async function withDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-desktop-runtime-'))
  try {
    await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function makeRuntime(directory, version) {
  await mkdir(join(directory, 'harness'), { recursive: true })
  await mkdir(join(directory, 'node'), { recursive: true })
  await writeFile(join(directory, 'node', 'node'), '')
  await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(createDesktopRuntimeManifest({
    version,
    platform: 'darwin',
    arch: 'arm64',
    nodePath: 'node/node',
  }), undefined, 2)}\n`)
}

test('resolveDesktopRuntime uses the bundled runtime until a user version is activated', async () => {
  await withDirectory(async (directory) => {
    const bundled = join(directory, 'bundled')
    const source = join(directory, 'source')
    await makeRuntime(bundled, '0.2.9')
    await makeRuntime(source, '0.3.0')

    const first = await resolveDesktopRuntime({
      homeDirectory: directory,
      bundledRuntimeDirectory: bundled,
      platform: 'darwin',
      arch: 'arm64',
    })
    assert.equal(first.version, '0.2.9')
    assert.equal(first.source, 'bundled')

    await installDesktopRuntime({ homeDirectory: directory, sourceDirectory: source, platform: 'darwin', arch: 'arm64' })
    const selected = await resolveDesktopRuntime({
      homeDirectory: directory,
      bundledRuntimeDirectory: bundled,
      platform: 'darwin',
      arch: 'arm64',
    })
    assert.equal(selected.version, '0.3.0')
    assert.equal(selected.source, 'user')
    assert.equal(JSON.parse(await readFile(join(desktopRuntimeRoot(directory), 'current.json'), 'utf8')).version, '0.3.0')
  })
})

test('activateDesktopRuntime switches back to an earlier installed version', async () => {
  await withDirectory(async (directory) => {
    const bundled = join(directory, 'bundled')
    const sourceA = join(directory, 'source-a')
    const sourceB = join(directory, 'source-b')
    await makeRuntime(bundled, '0.2.9')
    await makeRuntime(sourceA, '0.3.0')
    await makeRuntime(sourceB, '0.3.1')
    await installDesktopRuntime({ homeDirectory: directory, sourceDirectory: sourceA, platform: 'darwin', arch: 'arm64' })
    await installDesktopRuntime({ homeDirectory: directory, sourceDirectory: sourceB, platform: 'darwin', arch: 'arm64' })
    const selected = await activateDesktopRuntime({ homeDirectory: directory, version: '0.3.0', platform: 'darwin', arch: 'arm64' })
    assert.equal(selected.version, '0.3.0')
  })
})

test('resolveDesktopRuntime ignores an incomplete current selection', async () => {
  await withDirectory(async (directory) => {
    const bundled = join(directory, 'bundled')
    await makeRuntime(bundled, '0.2.9')
    await mkdir(desktopRuntimeRoot(directory), { recursive: true })
    await writeFile(join(desktopRuntimeRoot(directory), 'current.json'), '{"version":"missing"}\n')
    const selected = await resolveDesktopRuntime({
      homeDirectory: directory,
      bundledRuntimeDirectory: bundled,
      platform: 'darwin',
      arch: 'arm64',
    })
    assert.equal(selected.version, '0.2.9')
    assert.equal(selected.source, 'bundled')
  })
})

test('installDesktopRuntime copies the source tree before activation', async () => {
  await withDirectory(async (directory) => {
    const source = join(directory, 'source')
    await makeRuntime(source, '0.3.0')
    await installDesktopRuntime({ homeDirectory: directory, sourceDirectory: source, platform: 'darwin', arch: 'arm64' })
    assert.equal(await readFile(join(desktopRuntimeRoot(directory), '0.3.0', 'node', 'node'), 'utf8'), '')
  })
})
