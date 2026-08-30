import { totalmem } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { availableMemoryBytes, resolveSpeechToTextModel } from '../src/model.ts'

describe('local speech model resolution', () => {
  it('selects base through 4 GiB and small above it', () => {
    expect(resolveSpeechToTextModel('auto', 4 * 1024 ** 3)).toBe('base')
    expect(resolveSpeechToTextModel('auto', 4 * 1024 ** 3 + 1)).toBe('small')
  })

  it('preserves an explicit model', () => {
    expect(resolveSpeechToTextModel('base', 16 * 1024 ** 3)).toBe('base')
    expect(resolveSpeechToTextModel('small', 2 * 1024 ** 3)).toBe('small')
  })

  it('rejects invalid memory values', () => {
    expect(() => resolveSpeechToTextModel('auto', 0)).toThrow('positive safe integer')
    expect(() => resolveSpeechToTextModel('auto', Number.POSITIVE_INFINITY)).toThrow('positive safe integer')
  })

  it('prefers Node constrained memory over physical memory', () => {
    const constrained = vi.spyOn(process, 'constrainedMemory').mockReturnValue(3 * 1024 ** 3)
    expect(availableMemoryBytes()).toBe(3 * 1024 ** 3)
    constrained.mockRestore()
  })

  it('ignores an unlimited cgroup sentinel that exceeds the safe integer range', () => {
    const constrained = vi.spyOn(process, 'constrainedMemory').mockReturnValue(2 ** 64)
    expect(availableMemoryBytes()).toBe(totalmem())
    constrained.mockRestore()
  })
})
