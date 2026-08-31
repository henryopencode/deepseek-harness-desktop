/** Package-owned invariant companion. @module @deepseek-ai/dsh-client-ui-runtime-update/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-runtime-update'

/** Cordis companion plugin name. */
export const name = 'client-ui-runtime-update-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** The overlay owns only ephemeral browser state; no cross-plugin invariant is needed. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
