import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { compareVersions, downloadBytes, releaseVersion, expectedChecksum } from './web-runtime-update.mjs'

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

test('aborts a download whose response body stops arriving', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200)
    response.write('partial')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.notEqual(typeof address, 'string')
  try {
    await assert.rejects(
      downloadBytes('http://127.0.0.1:' + String(address.port) + '/archive', 1_000),
      /update download timed out after 1000ms/,
    )
  } finally {
    server.close()
    await once(server, 'close')
  }
})
