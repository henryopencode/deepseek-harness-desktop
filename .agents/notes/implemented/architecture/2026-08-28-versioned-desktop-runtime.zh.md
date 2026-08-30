# Agent Note: Version the desktop Harness runtime separately from the shell

Status: implemented

[English](2026-08-28-versioned-desktop-runtime.md) | 中文

## Problem

Electron 外壳和 Harness runtime 作为一个只能整体替换的安装单元发布。Harness 包或前端发生变化时，即使窗口进程和外壳行为没有变化，也必须重新安装桌面应用。

## Decision

桌面应用在 `resources/runtime` 下携带一个经过校验的初始 runtime。该目录包含 `manifest.json`、平台匹配的 Node 可执行文件和暂存后的 Harness 依赖树。启动器会先从 `~/.dsh/runtimes/current.json` 解析用户选中的 runtime，失败时回退到包内 runtime。只有版本目录、manifest schema、平台、架构、Node 可执行文件和 Harness 目录都有效时，选中项才会生效；缺失或不完整的选中项会被忽略。

桌面打包器同时生成对应的独立 runtime 归档。归档自带 Node 可执行文件、`runtime.mjs` 和 `activate-runtime.mjs`；后者会把解压后的 runtime 安装到 `~/.dsh/runtimes/<version>`，并且只在校验和复制完成后原子替换 `current.json`。现有设置、凭据、会话、profile 和 Electron 安装都不在此操作范围内。runtime 目录格式由 `manifest.json` 版本化，未来的下载器可以复用同一套安装和激活函数。

## Alternatives considered

**要求用户单独安装 Node。** 否决，因为受支持的原生依赖需要已知的 Node ABI，而用户不一定有兼容版本的 Node 或包管理器。

**把每次更新下载到 Electron 应用目录。** 否决，因为应用目录可能受平台保护或被安装器替换；用户管理的 runtime 版本应放在共享 Harness home 下，并可跨外壳升级保留。

**直接原地替换活动 runtime 文件。** 否决，因为复制中断可能让下一次启动缺少完整的可执行文件或依赖树。版本目录和原子指针可以提供完整的回退版本。

## Consequences

首次安装仍然是一个 macOS DMG、Windows 安装程序或 Linux 归档，并且无需联网更新即可启动。后续 Harness 发布可以只提供平台匹配的 runtime 归档；切换版本不会重新安装 Electron，也不会修改用户数据。Electron 代码或原生外壳行为变化时仍需要正常的应用发布；runtime 归档仍然必须区分平台和架构，因为其中包含 Node 原生依赖和 Whisper 二进制文件。
