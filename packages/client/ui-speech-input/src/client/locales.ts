/** `speechInput` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'button.start': '开始语音输入',
  'button.cancel': '取消录音',
  'button.stop': '停止并转写',
  'status.recording': '正在录音',
  'status.transcribing': '正在本地转写…',
  'status.preparing': '首次使用：正在准备本地语音识别（{{model}}）…',
  'error.unsupported': '当前浏览器不支持麦克风录音。',
  'error.permission': '没有麦克风权限，请在系统设置中允许后重试。',
  'error.microphone': '没有找到可用的麦克风。',
  'error.audio-too-large': '录音文件过大，请缩短后重试。',
  'error.audio-too-long': '录音时间过长，请缩短后重试。',
  'error.no-speech': '没有识别到语音，请靠近麦克风并持续说两秒以上后重试。',
  'error.busy': '另一段语音正在转写，请稍后重试。',
  'error.invalid-audio': '录音格式无法识别，请重新录制。',
  'error.transcription-failed': '本地语音识别运行时未准备好，请重新安装运行包后重试。',
  'error.transport': '无法连接本地转写服务，请稍后重试。',
} satisfies Record<string, string>

/** Speech-input dictionary key union. */
export type SpeechInputKey = keyof typeof zh

/** English dictionary, checked complete against the Chinese key set. */
export const en = {
  'button.start': 'Start voice input',
  'button.cancel': 'Cancel recording',
  'button.stop': 'Stop and transcribe',
  'status.recording': 'Recording',
  'status.transcribing': 'Transcribing locally…',
  'status.preparing': 'First use: preparing local speech recognition ({{model}})…',
  'error.unsupported': 'This browser does not support microphone recording.',
  'error.permission': 'Microphone access is blocked. Allow it in system settings and retry.',
  'error.microphone': 'No microphone is available.',
  'error.audio-too-large': 'The recording is too large. Shorten it and retry.',
  'error.audio-too-long': 'The recording is too long. Shorten it and retry.',
  'error.no-speech': 'No speech was recognized. Speak near the microphone for at least two seconds and retry.',
  'error.busy': 'Another recording is being transcribed. Try again shortly.',
  'error.invalid-audio': 'The recording format could not be read. Record it again.',
  'error.transcription-failed': 'The local speech runtime is not ready. Reinstall the runtime and retry.',
  'error.transport': 'The local transcription service is unavailable. Try again shortly.',
} satisfies Record<SpeechInputKey, string>
