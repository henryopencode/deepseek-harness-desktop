# Agent Note: Local speech input

Status: implemented

[中文](2026-08-24-local-speech-input.zh.md)

## Problem

The Web composer accepts typed text and image/file input but has no microphone path. Browser `SpeechRecognition` cannot supply the product requirement because its availability, engine location, and privacy behavior vary by browser, while a cloud transcription API would make local dictation depend on credentials and upload private audio.

## Decision

`@deepseek-ai/dsh-speech-to-text-local` owns a direct `speechToTextLocal` Host Remote. It accepts one canonical-base64 16 kHz mono PCM WAV browser recording, validates its decoded bytes and WAV-header duration, downloads a missing configured ggml model directly from the whisper.cpp model release, serializes execution to one request, transcribes through `nodejs-whisper`, and removes its generated temporary directory after settlement. Configuration owns model root, download policy, language, byte and duration bounds, and GPU use.

The provider resolves `model: auto` once at service construction. It reads Node's constrained-memory value when available and falls back to physical memory: 4 GiB or less selects multilingual `base`, and a larger value selects multilingual `small`. Explicit `base` or `small` configuration bypasses that choice. The shipped Web composition explicitly selects `base` and enables the GPU path only on macOS because its desktop package carries the Metal backend; Windows and Linux use CPU. The service resolves `nodejs-whisper` only after an accepted recording is written, and each request runs a finite whisper.cpp process rather than retaining model memory after transcription.

`@deepseek-ai/dsh-client-ui-speech-input` consumes the generated Remote through the API Remote assembly and occupies `conversation.input.right`. Its idle microphone immediately requests a media stream while it reads Host limits under a deadline. The active state overlays the existing tool row with cancel, a rolling amplitude history, and stop while preserving the textarea and primary send circle. The browser captures mono PCM through Web Audio, produces a 16 kHz WAV instead of relying on a WebKit `MediaRecorder` fragment, stops at the duration bound, closes media resources on cancel or unmount, and appends successful text to the latest draft without submitting it.

Audio and provisional text are not Session events or attachments. Only the ordinary composer submission makes accepted text model-visible and durable. This keeps local dictation separate from the durable multimodal attachment lifecycle in [Web multimodal image input and durable attachments](2026-07-22-web-multimodal-image-input-and-durable-attachments.md).

## Alternatives considered

**Browser `SpeechRecognition`.** Rejected because supported browsers and engine placement vary, some implementations use a remote service, and the packaged browser surface needs one predictable local path.

**Cloud transcription API.** Rejected because the requested default must run without credentials or audio leaving the Host. A cloud provider can be added later without changing the composer slot.

**Durable audio attachments and a Session event.** Rejected because the model never sees the recording; the human reviews editable text first. Logging the transient audio would add storage, retention, replay, telemetry, and model-capability obligations without a consumer.

**A provider registry before the first provider.** Rejected because the current capability has one Host implementation and one browser consumer. The Host Remote and UI already evolve independently; a registry becomes useful when a second active transcription provider needs runtime selection.

## Consequences

The feature runs on 4 GiB deployments with the `base` model and prefers `small` when more memory is available. The shipped Web bounds one recording to 4 MiB and 60 seconds and admits only one transcription at once. First use may download a model and requires network access when automatic download is enabled; a source deployment compiles whisper.cpp only when no executable was shipped. Desktop packages carry a precompiled Whisper executable. The browser's WAV path avoids audio conversion and external media utilities. `nodejs-whisper` exposes no abort signal for a running transcription; cancellation remains a pre-upload recording operation.

Focused tests pin memory selection, wire admission, WAV-header duration enforcement, single-operation concurrency, Loader composition, Remote carrier handling, PCM/WAV media cleanup, draft append behavior, slot disposal, and token-only styles. Browser verification pins the assembled control geometry and active recording state.
