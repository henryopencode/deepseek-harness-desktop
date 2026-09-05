/**
 * Host-local speech transcription over whisper.cpp. The Remote accepts one
 * bounded browser recording at a time, validates its decoded media duration,
 * and removes every temporary recording after the subprocess settles.
 * @module @deepseek-ai/dsh-speech-to-text-local
 */

import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, open, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { availableMemoryBytes, resolveSpeechToTextModel } from './model.ts'
import { isWhisperExecutableReady, requireWhisperExecutable } from './runtime.ts'
import type {
  SpeechToTextDescription, SpeechToTextModel, SpeechToTextModelPreference,
  SpeechTranscriptionFailure, SpeechTranscriptionRequest, SpeechTranscriptionResult,
} from './types.ts'

export type * from './types.ts'

/** Local model, admission, and executable policy. */
export interface Config {
  /** `auto` selects base at or below 4 GiB and small above it. */
  readonly model: SpeechToTextModelPreference
  /** Directory holding downloaded ggml model files. */
  readonly modelRootPath: string
  /** Download the selected model on its first use when absent. */
  readonly autoDownload: boolean
  /** Whisper language selector; `auto` performs language detection. */
  readonly language: string
  /** Maximum decoded recording bytes admitted from the browser. */
  readonly maxAudioBytes: number
  /** Maximum duration admitted from the browser-generated WAV header. */
  readonly maxAudioDurationMs: number
  /** Allow whisper.cpp to use its available GPU backend. */
  readonly useGpu: boolean
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    speechToTextLocal: SpeechToTextLocalService
  }
}

const MODEL_FILES: Record<SpeechToTextModel, string> = {
  base: 'ggml-base.bin',
  small: 'ggml-small.bin',
}
const WHISPER_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'
const GGML_HEADER_BYTES = 16
const GGML_MAGIC = Buffer.from('lmgg')
const modelLocks = new Map<string, Promise<void>>()

/** Return one explicit failure branch. */
function rejected(error: SpeechTranscriptionFailure): SpeechTranscriptionResult {
  return { ok: false, error }
}

/** Decode a bounded canonical base64 payload without first allocating an oversized buffer. */
function decodeAudio(data: string, maxBytes: number): Buffer | SpeechTranscriptionResult {
  const maxEncodedLength = Math.ceil(maxBytes / 3) * 4
  if (data.length > maxEncodedLength) {
    return rejected({
      code: 'audio-too-large',
      message: 'The recording exceeds the configured local transcription size limit.',
      maxBytes,
    })
  }
  const decoded = Buffer.from(data, 'base64')
  if (data.length === 0 || decoded.toString('base64') !== data) {
    return rejected({ code: 'invalid-audio', message: 'The recording is not canonical base64 audio.' })
  }
  if (decoded.byteLength > maxBytes) {
    return rejected({
      code: 'audio-too-large',
      message: 'The recording exceeds the configured local transcription size limit.',
      maxBytes,
    })
  }
  return decoded
}

/** Return the duration of a 16-bit, mono, 16 kHz PCM WAV browser recording. */
function wavDurationMs(audio: Buffer): number | undefined {
  if (audio.byteLength < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    return undefined
  }
  let offset = 12
  let byteRate: number | undefined
  let dataBytes: number | undefined
  while (offset + 8 <= audio.byteLength) {
    const id = audio.toString('ascii', offset, offset + 4)
    const size = audio.readUInt32LE(offset + 4)
    const dataOffset = offset + 8
    const end = dataOffset + size
    if (end > audio.byteLength) return undefined
    if (id === 'fmt ' && size >= 16) {
      const format = audio.readUInt16LE(dataOffset)
      const channels = audio.readUInt16LE(dataOffset + 2)
      const sampleRate = audio.readUInt32LE(dataOffset + 4)
      const declaredByteRate = audio.readUInt32LE(dataOffset + 8)
      const blockAlign = audio.readUInt16LE(dataOffset + 12)
      const bitsPerSample = audio.readUInt16LE(dataOffset + 14)
      if (
        format !== 1 || channels !== 1 || sampleRate !== 16_000 || declaredByteRate !== 32_000
        || blockAlign !== 2 || bitsPerSample !== 16
      ) return undefined
      byteRate = declaredByteRate
    }
    if (id === 'data' && dataBytes === undefined) dataBytes = size
    offset = end + size % 2
  }
  if (byteRate === undefined || dataBytes === undefined || dataBytes === 0) return undefined
  return Math.ceil(dataBytes * 1_000 / byteRate)
}

/** Remove whisper.cpp timestamp prefixes and empty-audio markers from stdout. */
function transcriptText(stdout: string): string {
  return stdout.split(/\r?\n/u)
    .map(line => line.replace(/^\s*\[[\d:.]+\s+-->\s+[\d:.]+\]\s*/u, '').trim())
    .filter(line => line !== '' && line !== '[BLANK_AUDIO]')
    .join(' ')
    .trim()
}

/** Require a non-empty operator-controlled string at plugin load. */
function requireConfigString(name: string, value: string): string {
  if (value.trim() === '') throw new TypeError(`speech-to-text-local: ${name} must not be empty`)
  return value
}

/** Prepare one valid ggml model without asking nodejs-whisper to rebuild whisper.cpp. */
async function ensureModel(
  root: string,
  model: SpeechToTextModel,
  autoDownload: boolean,
): Promise<void> {
  const filename = join(root, MODEL_FILES[model])
  const existing = modelLocks.get(filename)
  if (existing !== undefined) {
    await existing
    if (await usableModel(filename)) return
    return ensureModel(root, model, autoDownload)
  }
  const operation = (async () => {
    if (await usableModel(filename)) return
    if (!autoDownload) throw new Error(`Whisper model ${MODEL_FILES[model]} is missing or invalid.`)

    const temporary = join(root, `.${MODEL_FILES[model]}.${randomUUID()}.part`)
    try {
      const response = await fetch(`${WHISPER_MODEL_URL}/${MODEL_FILES[model]}`)
      if (!response.ok) throw new Error(`Whisper model download failed with HTTP ${response.status}.`)
      if (response.body === null) throw new Error('Whisper model download returned no body.')
      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeReadableStream),
        createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
      )
      if (!(await usableModel(temporary))) throw new Error(`Whisper model ${MODEL_FILES[model]} is invalid.`)
      await rename(temporary, filename)
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
  })()
  modelLocks.set(filename, operation)
  try {
    await operation
  } finally {
    if (modelLocks.get(filename) === operation) modelLocks.delete(filename)
  }
}

/** Reject empty, partial, or non-Whisper downloads before they reach whisper.cpp. */
async function usableModel(filename: string): Promise<boolean> {
  let handle
  try {
    const file = await open(filename, 'r')
    handle = file
    const metadata = await file.stat()
    if (!metadata.isFile() || metadata.size < GGML_HEADER_BYTES) return false
    const header = Buffer.alloc(GGML_HEADER_BYTES)
    const result = await file.read(header, 0, header.byteLength, 0)
    if (result.bytesRead !== header.byteLength || !header.subarray(0, GGML_MAGIC.byteLength).equals(GGML_MAGIC)) return false
    const vocabulary = header.readUInt32LE(4)
    const audioContext = header.readUInt32LE(8)
    return vocabulary > 0 && vocabulary <= 1_000_000 && audioContext > 0
  } catch {
    return false
  } finally {
    await handle?.close().catch(() => {
      // The readiness check has already determined the result; no resource remains to recover.
    })
  }
}

/** Local Whisper Remote; transcription is serialized and model preparation is shared by path. */
export class SpeechToTextLocalService extends TypertRemoteService {
  static Config: z<Config> = z.object({
    model: z.union([z.const('auto'), z.const('base'), z.const('small')]).required(),
    modelRootPath: z.string().required(),
    autoDownload: z.boolean().required(),
    language: z.string().required(),
    maxAudioBytes: z.natural().min(1).required(),
    maxAudioDurationMs: z.natural().min(1).required(),
    useGpu: z.boolean().required(),
  })

  private readonly model: SpeechToTextModel
  private readonly modelRootPath: string
  private readonly language: string
  private busy = false

  /**
   * @param ctx - Host context used for logging and the generated Remote namespace.
   * @param config - explicit model, admission, and executable policy.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'speechToTextLocal')
    this.model = resolveSpeechToTextModel(config.model, availableMemoryBytes())
    this.modelRootPath = requireConfigString('modelRootPath', config.modelRootPath)
    this.language = requireConfigString('language', config.language)
  }

  /**
   * Describe the resolved model and authoritative recording limits.
   * @returns immutable limits plus whether the first-use download is already complete.
   */
  @Remote('describe')
  async describe(): Promise<SpeechToTextDescription> {
    const modelReady = await usableModel(join(this.modelRootPath, MODEL_FILES[this.model]))
      && await isWhisperExecutableReady()
    return {
      model: this.model,
      maxAudioBytes: this.config.maxAudioBytes,
      maxAudioDurationMs: this.config.maxAudioDurationMs,
      modelReady,
    }
  }

  /**
   * Validate, probe, and transcribe one browser recording locally.
   * @param request - canonical base64 audio and its browser media type.
   * @returns recognized text or a stable admission/provider failure.
   */
  @Remote('transcribe')
  async transcribe(request: SpeechTranscriptionRequest): Promise<SpeechTranscriptionResult> {
    if (this.busy) {
      return rejected({ code: 'busy', message: 'Another local transcription is already running.' })
    }
    if (request.mediaType !== 'audio/wav') {
      return rejected({ code: 'invalid-audio', message: `Unsupported recording media type: ${request.mediaType}` })
    }
    const decoded = decodeAudio(request.audio, this.config.maxAudioBytes)
    if (!Buffer.isBuffer(decoded)) return decoded
    const durationMs = wavDurationMs(decoded)
    if (durationMs === undefined) {
      return rejected({ code: 'invalid-audio', message: 'The recording is not the expected 16 kHz mono PCM WAV audio.' })
    }
    if (durationMs > this.config.maxAudioDurationMs) {
      return rejected({
        code: 'audio-too-long',
        message: 'The recording exceeds the configured local transcription duration limit.',
        maxDurationMs: this.config.maxAudioDurationMs,
      })
    }

    this.busy = true
    let workingDirectory: string | undefined
    try {
      await mkdir(this.modelRootPath, { recursive: true })
      await requireWhisperExecutable()
      await ensureModel(this.modelRootPath, this.model, this.config.autoDownload)
      workingDirectory = await mkdtemp(join(tmpdir(), 'dsh-speech-to-text-'))
      const inputPath = join(workingDirectory, 'recording.wav')
      await writeFile(inputPath, decoded)
      const { nodewhisper } = await import('nodejs-whisper')
      const output = await nodewhisper(inputPath, {
        modelName: this.model,
        modelRootPath: this.modelRootPath,
        removeWavFileAfterTranscription: false,
        whisperOptions: {
          language: this.language,
          noGpu: !this.config.useGpu,
        },
        logger: {
          debug: (...args: unknown[]) => { this.ctx.logger.debug(args.map(String).join(' ')) },
          log: (...args: unknown[]) => { this.ctx.logger.info(args.map(String).join(' ')) },
          error: (...args: unknown[]) => {
            console.error('speech-to-text-local:', ...args)
            this.ctx.logger.warn(args.map(String).join(' '))
          },
        },
      })
      const text = transcriptText(output)
      if (text === '') {
        return rejected({ code: 'no-speech', message: 'No speech was recognized in the recording.' })
      }
      return { ok: true, value: { text, model: this.model } }
    } catch (error) {
      console.error('speech-to-text-local: transcription failed:', error)
      this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      return rejected({
        code: 'transcription-failed',
        message: 'Local transcription is not ready. Retry once; if it continues, reinstall the runtime so Whisper can be prepared.',
      })
    } finally {
      this.busy = false
      if (workingDirectory !== undefined) await rm(workingDirectory, { recursive: true, force: true })
    }
  }
}

export default SpeechToTextLocalService
