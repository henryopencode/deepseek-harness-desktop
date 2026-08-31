# Agent Note: 统一跨平台 Web 运行包

Status: implemented

[English](2026-08-30-unified-web-runtime.md) | 中文

## Problem

维护 Electron 外壳会产生分平台安装包、重复发布工作和大型桌面专用代码面，而产品体验本身是浏览器 Web UI。

## Decision

产品发布一个跨平台 `tar.gz` Web 运行包，不再发布 Electron 应用。归档包含构建好的 dsh 包、Web 前端、vendored runtime tarball、Landlock 入口包和 Node 启动脚本。目标机器安装 Node.js 22.19 或更高版本并运行 `node install.mjs`，npm 按目标机器的操作系统和架构解析可选原生依赖，然后由 CMake 构建 nodejs-whisper 随附的 `whisper-cli`。`node run.mjs web` 在前台启动浏览器服务器；`node start.mjs`、`node status.mjs` 和 `node stop.mjs` 在所有支持的操作系统上用同一组命令管理一个后台 Web 服务器。现有 Web profile 和本地 Whisper 语音模型继续保留。

归档不包含用户设置、凭据、会话、工作区或 Whisper 模型数据。这些数据保存在正常的 Harness home 中，并可用 `DSH_HOME` 重定向。`pnpm run release:web` 会执行官方构建并写出单一归档；GitHub 发布流程发布这个 Web 运行包产物。Electron 源码和分平台桌面包不再属于产品发布内容。

## Alternatives considered

**保留 Electron 外壳。** 放弃，因为它需要分平台安装包，并且会为浏览器体验携带一份大型重复运行时。

**把构建机的 `node_modules` 放进一个归档。** 放弃，因为原生可选依赖与平台有关，workspace link 也不具备可移植性；安装时必须由目标机器解析依赖。

**改为要求托管 Web 服务。** 放弃，因为本地运行包可以保留本地会话、凭据、工作区和 Whisper 数据，不要求远程部署。

## Consequences

用户在任一支持的操作系统下载并解压同一个归档，再完成一次依赖安装。代价是需要 Node.js、CMake 和本机 C/C++ 构建工具链、可写的安装目录和首次 npm 安装时的网络；Windows 用户还需要能解压 tar.gz 的工具。由于用户数据和本地 Whisper 模型位于归档之外，替换运行包不会影响它们。
