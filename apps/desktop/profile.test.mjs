import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { desktopProfileBundles, prepareDesktopProfile } from './profile.mjs'

async function withHome(run) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-desktop-profile-'))
  try {
    await run(home)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
}

async function readManifest(home) {
  return JSON.parse(await readFile(join(home, '.dsh', 'profiles', 'desktop', 'package.json'), 'utf8'))
}

test('prepareDesktopProfile initializes the base web desktop profile', async () => {
  await withHome(async (home) => {
    await prepareDesktopProfile(home)

    const manifest = await readManifest(home)
    assert.deepEqual(manifest.dsh.profile.bundles, desktopProfileBundles)
  })
})

test('prepareDesktopProfile removes the installation-owned widget bundle list', async () => {
  await withHome(async (home) => {
    const directory = join(home, '.dsh', 'profiles', 'desktop')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'package.json'), JSON.stringify({
      name: 'dsh-profile-desktop',
      private: true,
      custom: 'preserved',
      dsh: { profile: { bundles: [
        '@deepseek-ai/dsh-base',
        '@deepseek-ai/dsh-web-app',
        '@deepseek-ai/dsh-sprout-widget',
        '@deepseek-ai/dsh-whale-widget',
      ] } },
    }))

    await prepareDesktopProfile(home)

    const manifest = await readManifest(home)
    assert.equal(manifest.custom, 'preserved')
    assert.deepEqual(manifest.dsh.profile.bundles, desktopProfileBundles)
  })
})

test('prepareDesktopProfile preserves a user-modified bundle list', async () => {
  await withHome(async (home) => {
    const directory = join(home, '.dsh', 'profiles', 'desktop')
    await mkdir(directory, { recursive: true })
    const customBundles = ['@deepseek-ai/dsh-base', '@example/custom-desktop']
    await writeFile(join(directory, 'package.json'), JSON.stringify({
      name: 'dsh-profile-desktop',
      private: true,
      dsh: { profile: { bundles: customBundles } },
    }))

    await prepareDesktopProfile(home)

    const manifest = await readManifest(home)
    assert.deepEqual(manifest.dsh.profile.bundles, customBundles)
  })
})
