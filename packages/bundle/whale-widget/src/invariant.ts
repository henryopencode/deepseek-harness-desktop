/** Package-owned invariant companion for `@deepseek-ai/dsh-whale-widget`. */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-whale-widget'

/** Cordis companion plugin name. */
export const name = 'whale-widget-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: the widget presents transient balance and turn data;
// its routes and session listeners are effect-owned and publish no durable state.
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
