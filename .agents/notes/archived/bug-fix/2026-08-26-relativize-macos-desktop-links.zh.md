# Agent Note: 将 macOS 桌面应用链接改为相对链接

Status: implemented
Archived: 2026-08-30

[English](2026-08-26-relativize-macos-desktop-links.md) | 中文

## Problem

Electron 框架别名可能把构建暂存目录写入绝对符号链接目标。归档后的应用只能在该本机构建目录仍存在时运行；安装到另一台 Mac 的 DMG 会在 Electron 主进程加载前失败。

## Decision

`apps/desktop/scripts/package-links.mjs` 会在应用签名和归档前，将目标仍在 macOS 应用包内的每个绝对符号链接改写为相对链接。目标位于应用包外的链接会使打包失败。可移植链接断言会扫描完整的 macOS 应用包和暂存的 Harness 文件。

macOS 发布任务会对链接改写执行单元测试，在解压 ZIP 后拒绝绝对链接、验证应用签名，并以 Node 模式启动打包后的 Electron 可执行文件。Whisper 可执行文件和 DMG 检查仍是独立的验收证据。

## Alternatives considered

- **复制框架目标而不保留框架别名。** 未采用，因为 Electron 框架布局将别名作为预期应用包结构的一部分。相对别名既保留该布局，也不将应用包绑定到构建主机。
- **只检查 DMG 映像元数据。** 未采用，因为有效的磁盘映像仍可能包含无法加载可执行文件的应用。解压、签名验证和可执行文件启动能观察到已安装产物所需的运行路径。

## Consequences

- macOS ZIP 和 DMG 产物中的链接会在已安装应用包内解析。
- 如果 Electron 或其他已打包组件保留构建主机绝对链接，发布前会失败。
- macOS 打包在归档解压后增加轻量的 Electron 可执行文件启动检查。
