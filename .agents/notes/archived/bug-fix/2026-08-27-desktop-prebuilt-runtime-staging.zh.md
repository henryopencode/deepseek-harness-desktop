# Agent Note: 为本地交叉构建暂存已验证的桌面运行时二进制文件

Status: implemented
Archived: 2026-08-30

[English](2026-08-27-desktop-prebuilt-runtime-staging.md) | 中文

## Problem

本地 Windows 打包可能运行在 Node 架构或原生工具链与 x64 应用载荷不匹配的主机上。使用该主机重新构建 `whisper-cli` 会嵌入不兼容的可执行文件，复制主机 Node runtime 也会产生同样问题。

## Decision

桌面打包器接受两个可选的本地构建输入：`DSH_DESKTOP_NODE_RUNTIME` 指向 Windows Node runtime 目录，`DSH_DESKTOP_WHISPER_DIRECTORY` 指向含有已验证、平台匹配的 Whisper 可执行文件及其库的目录。为 Windows 包提供它们时，脚本会将文件复制到暂存产品中，并在继续前验证 `node.exe` 和 `whisper-cli.exe`。vendor runtime 包会在复制时解引用链接，因此 Windows 包不需要开发者模式的符号链接权限。未提供任一输入时，所有官方 CI 构建仍沿用普通的宿主 runtime 复制和原生 Whisper 编译。

## Alternatives considered

- **从任意主机架构交叉编译 Whisper。** 未采用，因为这需要为每种本地主机准备完整的编译器、SDK 和链接器配置，而应用已经携带经过验证的匹配 runtime。
- **不检查架构，直接发布宿主构建的二进制文件。** 未采用，因为安装器也许能够启动，但本地转写或嵌入式服务会在运行时失败。

## Consequences

- 本地 x64 Windows 重建可复用已知可用的 x64 runtime 工件，不改变已发布运行时协议。
- 覆盖变量是显式的本地构建输入；生产 CI 保持自包含，不依赖于先前安装的应用。
