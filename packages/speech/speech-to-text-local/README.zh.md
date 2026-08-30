# `@deepseek-ai/dsh-speech-to-text-local`

[English](README.md) | 中文

面向浏览器录音的 Host 本地 Whisper 转写 Remote。`speechToTextLocal.describe()` 返回解析后的多语言模型、权威字节／时长限制，以及对应 ggml 文件是否已经存在。`speechToTextLocal.transcribe({ audio, mediaType })` 接受规范 base64 编码的 16 kHz 单声道 PCM WAV 音频，从 WAV 头读取时长，直接从 whisper.cpp 模型发布源下载缺失的已配置 ggml 模型，只允许一个请求执行，调用 `nodejs-whisper`，并在结算后删除临时录音。

## 配置

| 字段 | 含义 |
|---|---|
| `model` | `auto`、`base` 或 `small`；`auto` 在可用时读取 `process.constrainedMemory()`，4 GiB 及以下选择 `base`，高于 4 GiB 选择 `small`。 |
| `modelRootPath` | `ggml-base.bin` 或 `ggml-small.bin` 所在目录。 |
| `autoDownload` | 模型缺失时从 whisper.cpp 发布源下载所选模型。 |
| `language` | Whisper 语言选择器；`auto` 自动检测口语语言。 |
| `maxAudioBytes` | 解码后录音的最大字节数。 |
| `maxAudioDurationMs` | 从 WAV 头读取后允许的最大时长。 |
| `useGpu` | 允许 whisper.cpp 使用可用的 GPU 后端；随附 Web 配置仅在 macOS 启用。 |

随附的 Web 组合明确选择 `base`，允许 4 MiB 与 60 秒，把模型下载到 Harness home，并且只在 macOS 启用 GPU 加速。Windows 和 Linux 使用随附的 CPU 后端。浏览器始终提供 whisper.cpp 所需的 PCM WAV。服务只有在接纳并写入录音后才解析 `nodejs-whisper`，所以桌面启动不会启动 Whisper。源码部署在 `autoDownload` 为 true 时需要网络；仅在没有 `whisper-cli` 时，`nodejs-whisper` 才会编译其随附的 whisper.cpp checkout。桌面包会提供平台原生的可执行文件，因此首次转写只下载所选模型。

## 失败与生命周期行为

异常 base64、不支持的媒体类型、异常 WAV 头、过大的录音、过长的媒体和并发请求都会返回明确的业务失败。提供方、构建和模型错误统一折叠为 `transcription-failed`，Host 日志保留底层错误。服务只会写入一个生成的临时目录和 `modelRootPath`；无论成功还是失败都会删除临时目录。每次转写启动一个有限生命周期的 whisper.cpp 进程，因此进程退出后会释放模型内存。

## 模型体验

无，因为该服务只把文字返回人类持有的浏览器草稿，不会追加 Session 事件或模型消息。

#### KV Cache 影响

无；只有人类之后通过普通输入框提交已接受文字，才会把它放入模型历史。

## 已知限制与延期工作

- **首次使用可能较慢**：模型下载，以及源码部署未随附可执行文件时的 whisper.cpp 编译，都没有进度通道，浏览器只能显示准备状态。
- **运行中的转写无法取消**：浏览器取消会在上传前结束录音，但 Remote 启动后，`nodejs-whisper` 不公开 abort signal。
- **提供方需要可写的已安装包文件**：`nodejs-whisper` 会在自身已安装包目录中构建随附的 C++ 源码；只读安装必须预构建或替换该提供方。
