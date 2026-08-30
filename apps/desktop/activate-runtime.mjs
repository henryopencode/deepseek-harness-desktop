import { resolve } from 'node:path'
import { installDesktopRuntime } from './runtime.mjs'

const args = new Map(process.argv.slice(2).flatMap((value, index, all) =>
  value.startsWith('--') ? [[value.slice(2), all[index + 1]]] : []))
const source = args.get('source')
const home = args.get('home') ?? process.env.HOME ?? process.env.USERPROFILE
if (source === undefined || home === undefined) {
  throw new Error('usage: node activate-runtime.mjs --source <runtime-directory> [--home <home-directory>]')
}

const runtime = await installDesktopRuntime({
  homeDirectory: home,
  sourceDirectory: resolve(source),
  platform: process.platform,
  arch: process.arch,
})
process.stdout.write(`desktop runtime activated: ${runtime.version}\n`)
