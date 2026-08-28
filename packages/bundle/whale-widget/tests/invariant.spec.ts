import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as WhaleInvariant from '../src/invariant.ts'

describe('whale widget invariant companion', () => {
  it('registers the stateless package under its package name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(WhaleInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
