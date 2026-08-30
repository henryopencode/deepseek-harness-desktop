/** Memory-aware model resolution for the local Whisper provider. */

import { totalmem } from 'node:os'
import type { SpeechToTextModel, SpeechToTextModelPreference } from './types.ts'

/** Four GiB is the supported low-memory deployment threshold. */
const LOW_MEMORY_BYTES = 4 * 1024 ** 3

/**
 * Read the process memory constraint when Node exposes one, else physical memory.
 * @returns process-visible memory capacity in bytes.
 */
export function availableMemoryBytes(): number {
  const constrained = process.constrainedMemory()
  // Linux can report an unsigned unlimited cgroup sentinel, which exceeds
  // JavaScript's safe-integer range and is not an actual memory limit.
  return Number.isSafeInteger(constrained) && constrained > 0 ? constrained : totalmem()
}

/**
 * Resolve `auto` before execution so one service life uses one explicit model.
 * @param preference - configured model preference.
 * @param memoryBytes - process-visible memory capacity.
 * @returns `base` at or below 4 GiB, otherwise `small`.
 */
export function resolveSpeechToTextModel(
  preference: SpeechToTextModelPreference,
  memoryBytes: number,
): SpeechToTextModel {
  if (!Number.isSafeInteger(memoryBytes) || memoryBytes < 1) {
    throw new TypeError(`speech-to-text-local: memoryBytes must be a positive safe integer, got ${String(memoryBytes)}`)
  }
  return preference === 'auto' ? (memoryBytes <= LOW_MEMORY_BYTES ? 'base' : 'small') : preference
}
