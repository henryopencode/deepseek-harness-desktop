import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

/** Current on-disk format for a desktop runtime manifest. */
export const desktopRuntimeManifestVersion = 1

/** Name of the runtime directory under the shared Harness home. */
export const desktopRuntimeDirectoryName = 'runtimes'

function isSafeVersion(version) {
  return typeof version === 'string'
    && version.length > 0
    && version !== '.'
    && version !== '..'
    && !version.includes('/')
    && !version.includes('\\')
    && !version.includes('..')
}

function isRelativePath(path) {
  if (typeof path !== 'string' || path === '') return false
  if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) return false
  return !path.split(/[\\/]/).includes('..')
}

function runtimeRoot(homeDirectory) {
  if (typeof homeDirectory !== 'string' || homeDirectory === '') {
    throw new Error('DeepSeek Harness cannot resolve the current user home directory.')
  }
  return join(homeDirectory, '.dsh', desktopRuntimeDirectoryName)
}

function validateManifest(manifest, expectedPlatform, expectedArch) {
  if (manifest === null || typeof manifest !== 'object') throw new Error('runtime manifest must be an object')
  if (manifest.schemaVersion !== desktopRuntimeManifestVersion) {
    throw new Error(`unsupported desktop runtime manifest version: ${String(manifest.schemaVersion)}`)
  }
  if (!isSafeVersion(manifest.version)) throw new Error('runtime manifest has an unsafe version')
  if (typeof manifest.platform !== 'string' || typeof manifest.arch !== 'string') {
    throw new Error('runtime manifest must declare platform and arch')
  }
  if (manifest.platform !== expectedPlatform || manifest.arch !== expectedArch) {
    throw new Error(`runtime platform mismatch: ${manifest.platform}/${manifest.arch}`)
  }
  if (!isRelativePath(manifest.nodePath) || !isRelativePath(manifest.harnessPath)) {
    throw new Error('runtime manifest paths must be relative')
  }
  return manifest
}

async function readRuntimeDirectory(directory, expectedPlatform, expectedArch, expectedVersion) {
  const manifest = validateManifest(
    JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
    expectedPlatform,
    expectedArch,
  )
  if (expectedVersion !== undefined && manifest.version !== expectedVersion) {
    throw new Error(`runtime version mismatch: directory ${expectedVersion}, manifest ${manifest.version}`)
  }
  const nodeExecutable = join(directory, manifest.nodePath)
  const harnessDirectory = join(directory, manifest.harnessPath)
  const [nodeInfo, harnessInfo] = await Promise.all([stat(nodeExecutable), stat(harnessDirectory)])
  if (!nodeInfo.isFile()) throw new Error('runtime Node path is not a file')
  if (!harnessInfo.isDirectory()) throw new Error('runtime Harness path is not a directory')
  return {
    directory,
    version: manifest.version,
    nodeExecutable,
    harnessDirectory,
    manifest,
  }
}

/** Return the path containing user-managed desktop runtime versions. */
export function desktopRuntimeRoot(homeDirectory) {
  return runtimeRoot(homeDirectory)
}

/** Create the manifest written into one packaged runtime directory. */
export function createDesktopRuntimeManifest({ version, platform, arch, nodePath, harnessPath = 'harness' }) {
  const manifest = {
    schemaVersion: desktopRuntimeManifestVersion,
    version,
    platform,
    arch,
    nodePath,
    harnessPath,
  }
  validateManifest(manifest, platform, arch)
  return manifest
}

/**
 * Resolve the runtime used by the desktop launcher.
 * User-managed versions win when `current.json` points to a complete matching
 * runtime; a missing or invalid selection falls back to the bundled runtime.
 */
export async function resolveDesktopRuntime({ homeDirectory, bundledRuntimeDirectory, platform, arch }) {
  const root = runtimeRoot(homeDirectory)
  const currentPath = join(root, 'current.json')
  try {
    const current = JSON.parse(await readFile(currentPath, 'utf8'))
    if (!isSafeVersion(current?.version)) throw new Error('current runtime selection has an unsafe version')
    const selected = await readRuntimeDirectory(join(root, current.version), platform, arch, current.version)
    return { ...selected, source: 'user' }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      process.stderr.write(`desktop runtime: ignoring invalid current selection: ${error instanceof Error ? error.message : String(error)}\n`)
    }
  }
  const bundled = await readRuntimeDirectory(bundledRuntimeDirectory, platform, arch)
  return { ...bundled, source: 'bundled' }
}

/** Atomically select an already-installed user runtime version. */
export async function activateDesktopRuntime({ homeDirectory, version, platform, arch }) {
  if (!isSafeVersion(version)) throw new Error('runtime version is unsafe')
  const root = runtimeRoot(homeDirectory)
  const selected = await readRuntimeDirectory(join(root, version), platform, arch, version)
  const temporary = join(root, `.current-${process.pid}-${randomUUID()}.json`)
  await mkdir(root, { recursive: true })
  try {
    await writeFile(temporary, `${JSON.stringify({ version: selected.version }, undefined, 2)}\n`, 'utf8')
    await rename(temporary, join(root, 'current.json'))
  } finally {
    await rm(temporary, { force: true })
  }
  return selected
}

/** Install a validated runtime directory and make it the active version. */
export async function installDesktopRuntime({ homeDirectory, sourceDirectory, platform, arch }) {
  const root = runtimeRoot(homeDirectory)
  await mkdir(root, { recursive: true })
  const staging = join(root, `.staging-${process.pid}-${randomUUID()}`)
  await cp(sourceDirectory, staging, { recursive: true, dereference: true })
  try {
    const staged = await readRuntimeDirectory(staging, platform, arch)
    const target = join(root, staged.version)
    try {
      const existing = await readRuntimeDirectory(target, platform, arch, staged.version)
      if (existing.version !== staged.version) throw new Error('installed runtime version does not match its directory')
      await rm(staging, { recursive: true, force: true })
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      await rename(staging, target)
    }
    return activateDesktopRuntime({ homeDirectory, version: staged.version, platform, arch })
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
