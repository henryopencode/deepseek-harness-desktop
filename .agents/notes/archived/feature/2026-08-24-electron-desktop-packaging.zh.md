# Agent Note: Electron 桌面包

Status: implemented
Archived: 2026-08-30

[English](2026-08-24-electron-desktop-packaging.md) | 中文

## Problem

浏览器 profile 需要一个拥有本地 Web 进程、且可在 macOS、Linux 与 Windows 发布的原生应用。现有 Swift 启动器只能运行在 macOS 上，并依赖检出目录本地安装的 Node。

## Decision

`apps/desktop` 提供一个 Electron 主进程：它保留私有 loopback 端口，在共享 Harness home 下初始化空的 `desktop` profile，写入用于关闭默认浏览器交接的最终运行时 patch，在保留平台用户目录和临时目录变量的干净环境中启动打包后的 `dsh` CLI，在沙箱化 `BrowserWindow` 中渲染本地 URL，只向该 loopback 页面授予麦克风权限，并在退出时终止它拥有的进程树。子进程将 stdout 和 stderr 直接写入诊断日志文件；在 macOS 上，Node 通过受管进程组中的转义 `/bin/sh` 子进程启动，使 Finder 启动不会在 Node 加载 Harness 前卡住。独立 profile 排除 CLI 的 `web` profile 插件，同时共享设置、凭据、会话和工作区。产品名称为 `DeepSeek Harness`；打包后的 macOS／Windows 图标均使用与 Web 应用一致的官方黑鲸标记。外壳只显示产品菜单与中文「显示」菜单，不显示通用「编辑」菜单。

打包脚本先从桌面依赖根以 pnpm 的 hoisted node linker 运行 `pnpm deploy`。随后会把 pnpm 否则会保留为构建机器链接的两个 vendored runtime 包实体化，在 Electron resources 下生成平台匹配、自包含的运行时闭包，也不会保留 Windows 资源管理器无法解压的深层虚拟仓库路径。包还携带匹配的 Node 可执行文件与预编译的平台原生 `whisper-cli`；每个 macOS Whisper 二进制都会写入 `@loader_path` runpath，使动态库在安装后仍能正确解析。模型数据仍保存在用户本地，并在首次使用时下载。浏览器听写会把 16 kHz 单声道 PCM WAV 直接提交给 Whisper，因此安装包不携带 FFmpeg 或 FFprobe。macOS 会提供 ARM64 ZIP 和拖拽安装 DMG；Linux 将 x64 可执行文件夹归档为 `.tar.gz`；Windows 归档包含 `.exe` 的 x64 文件夹，并将其打包为当前用户安装的 NSIS 安装程序，创建桌面和开始菜单快捷方式并登记到 Windows 已安装的应用。GitHub `Desktop Packages` workflow 在各自原生 runner 上构建三个平台，使用短 Windows 暂存路径，验证 Windows 归档路径不超过 220 个字符，先解压便携包再探测包内 Whisper 可执行文件，检查 macOS 相对 runpath 与 DMG，安装和卸载 Windows 安装程序并检查快捷方式和安装登记，然后将全部产物上传到桌面 Release。

同一个打包 runtime 也会作为独立的带版本归档发布；其选择和原子激活规则见[版本化桌面 runtime 说明](../architecture/2026-08-28-versioned-desktop-runtime.md)。

## Alternatives considered

**保留 Swift 启动器。** 拒绝，因为 AppKit 实现无法生成 Linux 或 Windows 可执行文件。

**复制检出目录及其 `node_modules`。** 拒绝，因为工作区链接可能包含构建机器的绝对路径，无法生成可携带归档。

**使用 Electron 的 Node runtime 运行 Harness 子进程。** 拒绝，因为原生模块必须匹配打包后的 Node ABI；启动器改为携带构建暂存依赖闭包的 Node runtime。

## Consequences

桌面归档体积较大，因为它有意包含 Harness runtime 与 Node 可执行文件。构建在原生 macOS ARM64、Linux x64 和 Windows x64 runner 上进行，因此每个归档都包含匹配的原生 addon。发布 workflow 会缓存各平台 Electron 下载文件，但每个包仍需暂存并压缩自包含 runtime。仓库没有 Developer ID、Linux 包签名或 Authenticode 签名凭证，所以下载归档和 Windows 安装程序首次启动时可能触发平台信任警告。
