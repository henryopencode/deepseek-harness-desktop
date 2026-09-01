# 本地语音转写

[English](speech.md) | 中文

[`@deepseek-ai/dsh-speech-to-text-local`](../../packages/speech/speech-to-text-local)把一段有界浏览器录音转换为人类可编辑草稿。音频和暂定转写不会进入 Session 日志；普通输入框负责之后是否把识别文字提交给模型。

来源：[`packages/speech/speech-to-text-local/src/types.ts`](../../packages/speech/speech-to-text-local/src/types.ts)

## 公开类型

```ts type-equiv
/** Deployment preference before the Host resolves available memory. */
type SpeechToTextModelPreference = 'auto' | 'base' | 'small'
```

```ts type-equiv
/** Multilingual Whisper models supported by this local provider. */
type SpeechToTextModel = Exclude<SpeechToTextModelPreference, 'auto'>
```

```ts type-equiv
/** Browser-recorded audio submitted as canonical base64. */
interface SpeechTranscriptionRequest {
  /** Canonical base64 audio bytes without a data-URL prefix. */
  readonly audio: string
  /** Browser-declared audio media type, including an optional codec parameter. */
  readonly mediaType: string
}
```

```ts type-equiv
/** Resolved deployment limits and model readiness. */
interface SpeechToTextDescription {
  readonly model: SpeechToTextModel
  readonly maxAudioBytes: number
  readonly maxAudioDurationMs: number
  /** Whether the selected model file already exists; false means the first transcription may download it. */
  readonly modelReady: boolean
}
```

```ts type-equiv
/** Stable business failures returned to the recording control. */
type SpeechTranscriptionFailure =
  | { readonly code: 'busy'; readonly message: string }
  | { readonly code: 'invalid-audio'; readonly message: string }
  | { readonly code: 'audio-too-large'; readonly message: string; readonly maxBytes: number }
  | { readonly code: 'audio-too-long'; readonly message: string; readonly maxDurationMs: number }
  | { readonly code: 'no-speech'; readonly message: string }
  | { readonly code: 'transcription-failed'; readonly message: string }
```

```ts type-equiv
/** Successful local transcription or an explicit user-visible rejection. */
type SpeechTranscriptionResult =
  | { readonly ok: true; readonly value: { readonly text: string; readonly model: SpeechToTextModel } }
  | { readonly ok: false; readonly error: SpeechTranscriptionFailure }
```

## 准入与执行

`model: auto` 会在服务构造时从 Node constrained memory 解析一次；不可用时读取物理内存。容量不超过 4 GiB 时选择多语言 `base`，更大时选择多语言 `small`。明确配置会绕过该选择。随附 Web 组合明确选择 `base`，避免在内存较大的 Mac 上选到更慢的 `small` 模型。模型文件保留在配置的根目录；每个请求使用一个新临时目录，并在结算后删除。

Host 只准入规范 base64 编码的 16 kHz 单声道 PCM WAV 音频。它在写入录音前拒绝解码字节溢出和异常 WAV 头，再从 WAV 数据长度与字节率强制时长限制。一个私有准入标记会拒绝并发工作。它只会在写入已准入录音后解析 `nodejs-whisper`，然后运行有限生命周期的进程，因此应用启动时不会启动 Whisper，进程退出后会释放模型内存。

## 浏览器消费方

[`@deepseek-ai/dsh-client-ui-speech-input`](../../packages/client/ui-speech-input)占用 `conversation.input.right`。它会立即请求麦克风，同时在截止时间内读取 `describe()`，通过 Web Audio 采集单声道 PCM 并发送 16 kHz WAV 录音。它展示滚动振幅历史，在达到 Host 时长限制时停止，并且只在人类按停止或达到限制后提交。成功结果会追加到最新草稿而不发送。取消和卸载会在任何 Remote 上传前关闭全部媒体轨道与 AudioContext。

## 边界与限制

- 首次使用可能下载所选模型，并且只在未随附可执行文件时编译随附的 whisper.cpp 源码；提供方需要其包 README 中说明的可写安装。
- 浏览器取消只在上传前生效。当前 `nodejs-whisper` 依赖不公开活跃转写进程的 abort signal。
- 浏览器会把识别文字追加到草稿末尾，因为同级输入框插件拿不到 textarea selection 状态。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxspeechtotextlocal--speechtotextlocalservice"></a>

### `ctx.speechToTextLocal` — `SpeechToTextLocalService`

Local Whisper Remote; one process-wide model operation runs at a time.

```ts cordis-catalog
/**
 * Describe the resolved model and authoritative recording limits.
 * @returns immutable limits plus whether the first-use download is already complete.
 */
@Remote('describe') async describe(): Promise<SpeechToTextDescription>

/**
 * Validate, probe, and transcribe one browser recording locally.
 * @param request - canonical base64 audio and its browser media type.
 * @returns recognized text or a stable admission/provider failure.
 */
@Remote('transcribe') async transcribe(request: SpeechTranscriptionRequest): Promise<SpeechTranscriptionResult>
```

Source: [`packages/speech/speech-to-text-local/src/index.ts:167`](../../packages/speech/speech-to-text-local/src/index.ts)
<!-- END GENERATED cordis-surface -->
