import { lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** Dedicated profile name owned by the Electron shell. */
export const desktopProfileName = 'desktop'

/** Installation-owned bundle order for the desktop product. */
export const desktopProfileBundles = Object.freeze([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
])

const legacyDesktopProfileBundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-sprout-widget',
  '@deepseek-ai/dsh-whale-widget',
]

const removedDesktopProfileBundles = [
  '@deepseek-ai/dsh-sprout-widget',
  '@deepseek-ai/dsh-whale-widget',
]

const desktopProfileManifest = JSON.stringify({
  name: 'dsh-profile-desktop',
  private: true,
  dependencies: {},
  dsh: { profile: { bundles: desktopProfileBundles } },
}, undefined, 2) + '\n'
const desktopProfilePatch = '# The desktop profile is reserved for the Electron shell.\n[]\n'
const desktopProfileWorkspace = 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n'

/** Report whether a single-writer profile initialization found its expected file. */
function isAlreadyExists(error) {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST'
}

/** Write one desktop profile file without replacing user-owned contents. */
async function writeIfAbsent(path, content) {
  try {
    await writeFile(path, content, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if (!isAlreadyExists(error)) throw error
  }
}

/** Keep one installation-owned profile fallback link pointed at the active runtime. */
async function ensureRuntimeBundleLink(link, target) {
  try {
    const info = await lstat(link)
    if (!info.isSymbolicLink()) {
      throw new Error(`desktop profile fallback ${link} exists and is not a symlink`)
    }
    if (await readlink(link) === target) return
    await unlink(link)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  await symlink(target, link, 'junction')
}

/** Remove fallback links for bundles that are no longer part of the desktop profile. */
async function removeRuntimeBundleLinks(homeDirectory, bundles) {
  const modulesDirectory = join(homeDirectory, '.dsh', 'profiles', 'node_modules')
  for (const packageName of removedDesktopProfileBundles) {
    if (bundles.includes(packageName)) continue
    const link = join(modulesDirectory, packageName)
    try {
      const info = await lstat(link)
      if (!info.isSymbolicLink()) continue
      await unlink(link)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
}

/** Link desktop-only bundles into the profile fallback used by Node module resolution. */
async function linkRuntimeBundles(homeDirectory, runtimeHarnessDirectory) {
  const modulesDirectory = join(homeDirectory, '.dsh', 'profiles', 'node_modules')
  for (const packageName of desktopProfileBundles) {
    const target = join(runtimeHarnessDirectory, 'node_modules', packageName)
    const link = join(modulesDirectory, packageName)
    await lstat(target)
    await mkdir(dirname(link), { recursive: true })
    await ensureRuntimeBundleLink(link, target)
  }
}

/** Return whether two bundle lists contain the same values in the same order. */
function sameBundles(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Initialize the desktop profile and upgrade only the installation-owned legacy bundle list.
 * User-modified bundle lists and every other manifest field remain unchanged.
 */
export async function prepareDesktopProfile(homeDirectory, runtimeHarnessDirectory) {
  if (homeDirectory === undefined) {
    throw new Error('DeepSeek Harness cannot resolve the current user home directory.')
  }
  const profileDirectory = join(homeDirectory, '.dsh', 'profiles', desktopProfileName)
  await mkdir(profileDirectory, { recursive: true })
  const manifestPath = join(profileDirectory, 'package.json')
  await Promise.all([
    writeIfAbsent(manifestPath, desktopProfileManifest),
    writeIfAbsent(join(profileDirectory, 'cordis.patch.yml'), desktopProfilePatch),
    writeIfAbsent(join(profileDirectory, 'pnpm-workspace.yaml'), desktopProfileWorkspace),
  ])

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const bundles = manifest?.dsh?.profile?.bundles
  const hadLegacyDesktopBundles = Array.isArray(bundles) && sameBundles(bundles, legacyDesktopProfileBundles)
  if (hadLegacyDesktopBundles) {
    manifest.dsh.profile.bundles = [...desktopProfileBundles]
    await writeFile(manifestPath, JSON.stringify(manifest, undefined, 2) + '\n', 'utf8')
  }
  if (Array.isArray(manifest.dsh?.profile?.bundles)) {
    await removeRuntimeBundleLinks(homeDirectory, manifest.dsh.profile.bundles)
  }
  if (runtimeHarnessDirectory !== undefined) await linkRuntimeBundles(homeDirectory, runtimeHarnessDirectory)
}
