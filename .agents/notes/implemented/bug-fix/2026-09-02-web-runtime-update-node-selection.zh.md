# Agent Note: 使用选定的 Node 运行时执行 Web 更新

Status: implemented

[English](2026-09-02-web-runtime-update-node-selection.md) | 中文

## Problem

受管 Web 更新器从 `PATH` 启动 npm。因此，即使服务由受支持的新版本 Node 启动，更新器仍可能调用 shebang 指向另一个 Node 的旧 npm，导致依赖安装在激活新运行时前失败。

## Decision

Web 运行时安装器会定位 `process.execPath` 旁边的 npm CLI，并通过同一个 Node 可执行文件调用它。实现同时支持 Unix 和 Windows Node 发行版使用的 npm 目录布局。如果选定的 Node 安装没有附带 npm CLI，安装器会回退到平台 npm 命令，以保留精简 Node 发行版的现有行为。子进程包的 postinstall 辅助脚本通过 `createRequire` 解析 `node-pty`，让旧更新器可以先安装下一个运行时，再使用新的 Node 感知安装器。

## Verification

安装器测试创建代表性的 Node/npm 目录布局，并验证 npm 通过选定的 Node 路径调用，而不是执行 PATH 中的 shebang。子进程 postinstall 辅助脚本在不支持 `import.meta.resolve` 的 Node 版本上仍可解析。修复后的受管更新路径会升级本地 Web 服务，并检查活动版本和 HTTP 响应。

## Alternatives considered

**继续从 `PATH` 调用 npm。** 这会让无关的旧 Node 安装控制依赖安装，即使归档已经成功下载，也可能在安装阶段失败。

**在每个 Web 归档中附带 npm。** 这会增加运行包体积，并产生需要维护的第二套包管理器发行物；受支持环境中的 Node 安装本身已经拥有 npm。

**使用 pnpm 或 Corepack 执行更新。** 运行包通过 npm 安装，并且必须支持未启用 Corepack 的主机；更换包管理器会增加不必要的前置条件。

## Consequences

更新会使用启动更新器的同一 Node 版本，避免 npm shebang 漂移导致激活失败。下一个运行时在一次版本过渡期间仍可由旧更新器安装。没有附带 npm 的 Node 主机会继续使用原来的 PATH 回退方式，并承担相应的环境要求。
