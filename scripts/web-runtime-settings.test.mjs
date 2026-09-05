import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { load } from 'js-yaml'
import { installSettingsTemplate, resolveRuntimeSettingsPath } from './web-runtime-install.mjs'

const templatePath = new URL('../apps/cli/config/settings.example.yaml', import.meta.url)
const templateFilename = fileURLToPath(templatePath)

test('ships the configured vision-capable Codex relay without a credential value', () => {
  const text = readFileSync(templatePath, 'utf8')
  const config = load(text)
  assert.deepEqual(config['agent-default-model'], { provider: 'codex-relay', model: 'gpt-5.6-sol' })
  const profile = config['llm-pi-ai'].providers['codex-relay']
  assert.equal(profile.apiKeyEnv, 'CODEX_RELAY_API_KEY')
  assert.equal(profile.api, 'openai-responses')
  assert.equal(profile.baseURL, 'https://sub2.neurix.cn')
  assert.deepEqual(profile.models.map(model => model.input), [['text', 'image'], ['text', 'image']])
  assert.doesNotMatch(text, /^\s*apiKey:\s*\S+/mu)
  assert.doesNotMatch(text, /(?:cfut_|sk-[A-Za-z0-9])/u)
})

test('creates settings once and never overwrites an existing document', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-web-settings-'))
  try {
    const expectedPath = join(home, 'settings.yaml')
    assert.equal(resolveRuntimeSettingsPath(home), expectedPath)
    assert.deepEqual(installSettingsTemplate(templateFilename, { dshHome: home }), {
      path: expectedPath,
      created: true,
    })
    const template = readFileSync(expectedPath, 'utf8')
    assert.deepEqual(installSettingsTemplate(templateFilename, { dshHome: home }), {
      path: expectedPath,
      created: false,
    })
    assert.equal(readFileSync(expectedPath, 'utf8'), template)

    writeFileSync(expectedPath, '')
    assert.equal(installSettingsTemplate(templateFilename, { dshHome: home }).created, false)
    assert.equal(readFileSync(expectedPath, 'utf8'), '')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
