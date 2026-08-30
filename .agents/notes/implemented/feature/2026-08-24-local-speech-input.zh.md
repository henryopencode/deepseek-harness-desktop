# Agent Note: 本地语音输入

Status: implemented

[English](2026-08-24-local-speech-input.md) | 中文

## 问题

Web 输入框接受键入文字与图片／文件输入，但没有麦克风路径。浏览器 `SpeechRecognition` 无法满足产品要求，因为可用性、引擎位置和隐私行为因浏览器而异；云端转写 API 则会让本地听写依赖凭证，并上传私人音频。

## 决策

`@deepseek-ai/dsh-speech-to-text-local` 持有 direct `speechToTextLocal` Host Remote。它接受一段规范 base64 编码的 16 kHz 单声道 PCM WAV 浏览器录音，校验解码字节数与 WAV 头时长，直接从 whisper.cpp 模型发布源下载缺失的已配置 ggml 模型，把执行串行限制为一个请求，通过 `nodejs-whisper` 转写，并在结算后删除生成的临时目录。配置负责模型目录、下载策略、语言、字节与时长限制以及 GPU 使用。

提供方在服务构造时只解析一次 `model: auto`。它优先读取 Node 的 constrained memory 值，否则回退到物理内存：4 GiB 及以下选择多语言 `base`，更大值选择多语言 `small`。明确配置 `base` 或 `small` 会绕过该选择。随附 Web 组合明确选择 `base`，并且只在 macOS 启用 GPU 路径，因为该桌面包携带 Metal 后端；Windows 和 Linux 使用 CPU。服务只会在写入已准入录音后解析 `nodejs-whisper`，每个请求运行一个有限生命周期的 whisper.cpp 进程，不会在转写后继续占用模型内存。

`@deepseek-ai/dsh-client-ui-speech-input` 通过 API Remote 组合消费生成的 Remote，并占用 `conversation.input.right`。空闲麦克风会立即请求媒体流，同时在截止时间内读取 Host 限制；活跃状态用取消、滚动振幅历史与停止覆盖现有工具行，同时保留 textarea 与主发送圆钮。浏览器经 Web Audio 采集单声道 PCM，生成 16 kHz WAV，不再依赖 WebKit 的 `MediaRecorder` 分段文件；到达时长限制时停止，在取消或卸载时关闭媒体资源，并把成功文字追加到最新草稿而不提交。

音频和暂定文字都不是 Session 事件或附件。只有普通输入框提交才会让已接受文字对模型可见并持久化。这让本地听写与 [Web 多模态图片输入和持久附件](2026-07-22-web-multimodal-image-input-and-durable-attachments.md)中的持久多模态附件生命周期保持分离。

## 考虑过的替代方案

**浏览器 `SpeechRecognition`。** 拒绝，因为支持它的浏览器和引擎位置不一致，部分实现会使用远端服务，而打包的浏览器表层需要一条可预测的本地路径。

**云端转写 API。** 拒绝，因为所需默认路径必须无需凭证运行，且音频不离开 Host。未来可以添加云端提供方，而不改变输入框 slot。

**持久音频附件与 Session 事件。** 拒绝，因为模型不会看到录音；人类会先审阅可编辑文字。记录临时音频会增加存储、保留、回放、遥测与模型能力义务，却没有消费者。

**在第一个提供方之前建立提供方注册表。** 拒绝，因为当前能力只有一个 Host 实现和一个浏览器消费者。Host Remote 与 UI 已能独立演进；只有第二个活跃转写提供方需要运行时选择时，注册表才有价值。

## 后果

该功能在 4 GiB 部署上使用 `base` 模型运行，内存更多时优先使用 `small`。随附 Web 把单段录音限制为 4 MiB 与 60 秒，同时只准入一个转写。首次使用可能下载模型，因此启用自动下载时需要网络；源码部署只在没有随附可执行文件时编译 whisper.cpp。桌面包携带预编译 Whisper 可执行文件。浏览器的 WAV 路径不需要音频转换和外部媒体工具。`nodejs-whisper` 不公开运行中转写的 abort signal；取消仍是上传前的录音操作。

聚焦测试固定了内存选择、wire 准入、WAV 头时长强制、单操作并发、Loader 组合、Remote carrier 处理、PCM/WAV 媒体清理、草稿追加行为、slot 卸载与只用 token 的样式。浏览器验证固定了组装后控件的几何与活跃录音状态。
