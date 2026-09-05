// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SpeechInput } from '../src/client/SpeechInput.tsx'
import type { SpeechInputProps } from '../src/client/SpeechInput.tsx'
import { zh } from '../src/client/locales.ts'

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(type: string): boolean {
    return type === 'audio/webm;codecs=opus'
  }

  readonly mimeType: string
  state: RecordingState = 'inactive'

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super()
    this.mimeType = options?.mimeType ?? 'audio/webm'
  }

  start(): void {
    this.state = 'recording'
  }

  stop(): void {
    this.state = 'inactive'
    const data = Object.assign(new Event('dataavailable'), {
      data: new Blob(['recorded audio'], { type: this.mimeType }),
    })
    this.dispatchEvent(data)
    this.dispatchEvent(new Event('stop'))
  }
}

class FakeAudioContext {
  readonly sampleRate = 48_000

  createAnalyser(): AnalyserNode {
    return {
      fftSize: 64,
      getByteTimeDomainData(samples: Uint8Array) { samples.fill(128) },
    } as unknown as AnalyserNode
  }

  createMediaStreamSource(): MediaStreamAudioSourceNode {
    return { connect: () => undefined, disconnect: () => undefined } as unknown as MediaStreamAudioSourceNode
  }

  createScriptProcessor(): ScriptProcessorNode {
    const processor = {
      onaudioprocess: null as ScriptProcessorNode['onaudioprocess'],
      connect: () => {
        const handler = processor.onaudioprocess
        handler?.call(processor as unknown as ScriptProcessorNode, {
          inputBuffer: { getChannelData: () => new Float32Array([0, 0.25, -0.25, 0]) },
        } as unknown as AudioProcessingEvent)
      },
      disconnect: () => undefined,
    }
    return processor as unknown as ScriptProcessorNode
  }

  createGain(): GainNode {
    return {
      gain: { value: 1 },
      connect: () => undefined,
      disconnect: () => undefined,
    } as unknown as GainNode
  }

  resume(): Promise<void> {
    return Promise.resolve()
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

const stopTrack = vi.fn()
const getUserMediaMock = vi.fn()
const mediaStream = {
  getTracks: () => [{ stop: stopTrack }],
} as unknown as MediaStream

const t = ((key: keyof typeof zh, params?: Record<string, string>) => {
  const source = zh[key]
  return params === undefined
    ? source
    : Object.entries(params).reduce((text, [name, value]) => text.replace(`{{${name}}}`, value), source)
}) as SpeechInputProps['t']

function props(overrides: Partial<SpeechInputProps> = {}) {
  const setDraft = vi.fn()
  const value = {
    sessionId: 'speech-session',
    session: { removed: false, subagent: null },
    input: {
      draft: '已有文字',
      imageIds: [],
      draftRev: 0,
      phase: 'plain',
      occurrences: [],
      queue: [],
    },
    inputActions: {
      setDraft,
      addImages: () => true,
      removeImage: () => {},
      pruneImages: () => {},
      submit: () => {},
    },
    describe: vi.fn().mockResolvedValue({
      model: 'base',
      maxAudioBytes: 1024,
      maxAudioDurationMs: 60_000,
      modelReady: true,
    }),
    transcribe: vi.fn().mockResolvedValue({
      ok: true,
      value: { text: '转写结果', model: 'base' },
    }),
    t,
    ...overrides,
  } as unknown as SpeechInputProps
  return { value, setDraft }
}

beforeEach(() => {
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: getUserMediaMock.mockResolvedValue(mediaStream) },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Codex-style speech input', () => {
  it('records, shows the full-width controls, and appends recognized text', async () => {
    const { value, setDraft } = props()
    render(<SpeechInput {...value} />)

    fireEvent.click(screen.getByRole('button', { name: '开始语音输入' }))
    expect(await screen.findByRole('group', { name: '正在录音' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '取消录音' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '停止并转写' }))

    await waitFor(() => { expect(value.transcribe).toHaveBeenCalledTimes(1) })
    expect(value.transcribe).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'audio/wav' }))
    await waitFor(() => { expect(setDraft).toHaveBeenCalledWith('已有文字 转写结果') })
    expect(screen.getByRole('button', { name: '开始语音输入' })).not.toBeNull()
    expect(stopTrack).toHaveBeenCalled()
  })

  it('cancels without calling the transcription Remote', async () => {
    const { value } = props()
    render(<SpeechInput {...value} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音输入' }))
    fireEvent.click(await screen.findByRole('button', { name: '取消录音' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: '开始语音输入' })).not.toBeNull() })
    expect(value.transcribe).not.toHaveBeenCalled()
  })

  it('announces first-use model preparation while transcription is pending', async () => {
    let settle: ((value: unknown) => void) | undefined
    const transcribe = vi.fn(() => new Promise((resolve) => { settle = resolve }))
    const { value } = props({
      describe: vi.fn().mockResolvedValue({
        model: 'base', maxAudioBytes: 1024, maxAudioDurationMs: 60_000, modelReady: false,
      }),
      transcribe,
    } as Partial<SpeechInputProps>)
    render(<SpeechInput {...value} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音输入' }))
    fireEvent.click(await screen.findByRole('button', { name: '停止并转写' }))
    expect(await screen.findByText('首次使用：正在准备本地语音识别（base）…')).not.toBeNull()
    settle?.({ ok: true, value: { text: '完成', model: 'base' } })
  })

  it('maps microphone permission rejection to product copy', async () => {
    getUserMediaMock.mockRejectedValueOnce(
      new DOMException('denied', 'NotAllowedError'),
    )
    const { value } = props()
    render(<SpeechInput {...value} />)
    fireEvent.click(screen.getByRole('button', { name: '开始语音输入' }))
    expect(await screen.findByText('没有麦克风权限，请在系统设置中允许后重试。')).not.toBeNull()
  })

  it('requests microphone access before waiting for Host recording limits', async () => {
    let resolveDescription: ((value: Awaited<ReturnType<SpeechInputProps['describe']>>) => void) | undefined
    const describe = vi.fn(() => new Promise<Awaited<ReturnType<SpeechInputProps['describe']>>>((resolve) => {
      resolveDescription = resolve
    }))
    const { value } = props({ describe } as Partial<SpeechInputProps>)
    render(<SpeechInput {...value} />)

    fireEvent.click(screen.getByRole('button', { name: '开始语音输入' }))
    await waitFor(() => { expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true }) })
    resolveDescription?.({ model: 'base', maxAudioBytes: 1024, maxAudioDurationMs: 60_000, modelReady: true })
    expect(await screen.findByRole('group', { name: '正在录音' })).not.toBeNull()
  })

  it('disables recording while the composer input transaction is busy', () => {
    const { value } = props({
      input: { draft: '', phase: 'submitting' },
    } as unknown as Partial<SpeechInputProps>)
    render(<SpeechInput {...value} />)
    expect(screen.getByRole('button', { name: '开始语音输入' }).hasAttribute('disabled')).toBe(true)
  })

  it('disables recording when an addressed child has no available parent', () => {
    const { value } = props({
      session: { removed: false, subagent: { parentAvailable: false } },
    } as unknown as Partial<SpeechInputProps>)
    render(<SpeechInput {...value} />)
    expect(screen.getByRole('button', { name: '开始语音输入' }).hasAttribute('disabled')).toBe(true)
  })
})
