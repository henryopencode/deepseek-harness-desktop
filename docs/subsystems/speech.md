# Local Speech Transcription

English | [中文](speech.zh.md)

[`@deepseek-ai/dsh-speech-to-text-local`](../../packages/speech/speech-to-text-local) converts one bounded browser recording into an editable human draft. The audio and provisional transcript never enter the Session log; the ordinary composer owns the later decision to submit recognized text to a model.

Source: [`packages/speech/speech-to-text-local/src/types.ts`](../../packages/speech/speech-to-text-local/src/types.ts)

## Public types

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

## Admission and execution

`model: auto` resolves once at service construction from Node's constrained memory when available, otherwise physical memory. A capacity through 4 GiB chooses multilingual `base`; a larger capacity chooses multilingual `small`. Explicit configuration bypasses this choice. The shipped Web composition explicitly selects `base` to avoid choosing the slower `small` model on higher-memory Macs. Model files remain under the configured root, while each request receives a fresh temporary directory removed after settlement.

The Host admits only canonical base64 16 kHz mono PCM WAV audio. It rejects decoded byte overflow and malformed WAV headers before writing the recording, then enforces duration from the WAV data length and byte rate. One private admission flag rejects concurrent work. It resolves `nodejs-whisper` only after writing an accepted recording, then runs it as a finite process, so application startup does not launch Whisper and model memory is released when the process exits.

## Browser consumer

[`@deepseek-ai/dsh-client-ui-speech-input`](../../packages/client/ui-speech-input) occupies `conversation.input.right`. It immediately requests microphone access while reading `describe()` under a deadline, captures mono PCM through Web Audio, and sends a 16 kHz WAV recording. It displays a rolling amplitude history, stops at the Host duration bound, and submits only after the human presses stop or the bound expires. Success appends text to the latest draft without sending it. Cancel and unmount close every media track and AudioContext before any Remote upload.

## Boundaries and limitations

- First use may download the selected model and compile the bundled whisper.cpp source when no executable was shipped; the provider requires the writable installation described in its package README.
- Browser cancellation applies before upload. The current `nodejs-whisper` dependency exposes no abort signal for an active transcription process.
- The browser appends recognized text to the draft end because sibling composer plugins do not receive textarea selection state.

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

Source: [`packages/speech/speech-to-text-local/src/index.ts:168`](../../packages/speech/speech-to-text-local/src/index.ts)
<!-- END GENERATED cordis-surface -->
