/** Package-owned invariant companion for `@deepseek-ai/dsh-sprout-widget`. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-sprout-widget'

/** Cordis companion plugin name. */
export const name = 'sprout-widget-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: this optional browser adornment derives its transient
// state from session events and owns no durable or cross-service relation.
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
