import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, releaseVersion, expectedChecksum } from './web-runtime-update.mjs'

test('compares numeric prerelease identifiers numerically', () => {
  assert.equal(compareVersions('0.1.0-rc.10', '0.1.0-rc.9') > 0, true)
  assert.equal(compareVersions('0.1.0-rc.9', '0.1.0-rc.10') < 0, true)
})

test('ranks prerelease identifiers and stable releases according to SemVer', () => {
  assert.equal(compareVersions('0.1.0-beta.2', '0.1.0-rc.1') < 0, true)
  assert.equal(compareVersions('0.1.0', '0.1.0-rc.99') > 0, true)
  assert.equal(compareVersions('0.1.0-rc', '0.1.0-rc.1') < 0, true)
})

test('parses only dsh release tags', () => {
  assert.equal(releaseVersion('dsh-v0.1.0-rc.8'), '0.1.0-rc.8')
  assert.equal(releaseVersion('v0.1.0'), undefined)
})

test('accepts the generated checksum asset format', () => {
  const checksum = 'a'.repeat(64)
  assert.equal(expectedChecksum(`${checksum}  archive.tar.gz\n`, 'archive.tar.gz'), checksum)
  assert.throws(() => expectedChecksum(`${checksum}  other.tar.gz\n`, 'archive.tar.gz'), /unexpected format/)
})
