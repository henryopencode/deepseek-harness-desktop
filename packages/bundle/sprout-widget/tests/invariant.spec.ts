import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as SproutInvariant from '../src/invariant.ts'
import * as WhaleInvariant from '../../whale-widget/src/invariant.ts'

describe('widget invariant companions', () => {
  it('register both stateless widget packages under their package names', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(SproutInvariant).await()).resolves.toBeDefined()
    await expect(ctx.plugin(WhaleInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
