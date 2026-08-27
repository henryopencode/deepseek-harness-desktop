# DeepSeek Harness Desktop 仓库说明

[English](DESKTOP_REPOSITORY.md) | 中文

这个仓库是定制版 DeepSeek Harness 桌面应用的独立产品仓库，不是 GitHub Fork。`master` 保存产品改动和发布配置；`official` 保存 `deepseek-ai/deepseek-harness:master` 的官方源码镜像。官方更新先进入 `official`，检查后再合并到 `master`。

## 远程仓库和分支

本地检出使用以下远程仓库：

```text
origin       https://github.com/henryopencode/deepseek-harness-desktop.git
upstream     https://github.com/deepseek-ai/deepseek-harness.git
legacy-fork  https://github.com/henryopencode/deepseek-harness.git
```

产品仓库只使用 `origin/master` 和 `origin/official`。`legacy-fork` 仅保留为旧 Fork 的参考，不作为新改动的推送目标。

## 同步官方更新

请在干净的工作区执行。`official` 是镜像分支，不要在这个分支直接写产品代码。

```sh
git fetch upstream master
git switch master
git branch -f official upstream/master
git push origin official --force-with-lease
git merge official
# 解决冲突并完成测试后提交合并提交。
git push origin master
```

合并后检查 `git diff ORIG_HEAD..HEAD`。产品改动始终放在 `master`；如果官方更新影响桌面端打包或生命周期约定，同时更新桌面端 README 和 Agent Note。

## 本地打包桌面应用

先安装 Node 22.19 或更高版本、pnpm 和仓库依赖：

```sh
pnpm install
pnpm run build
```

必须在目标操作系统上打包，以保证原生依赖匹配目标平台：

```sh
# macOS Apple Silicon
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform darwin --arch arm64

# Linux x64
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform linux --arch x64

# Windows x64（在 PowerShell 或 cmd 中执行）
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform win32 --arch x64
```

产物写入 `release/`。Windows 打包需要 NSIS（`makensis.exe`）。如果无法在本机重新编译原生组件，Windows 打包脚本可以复用已经验证过的 x64 Node runtime 和预构建 Whisper 目录：

```powershell
$env:DSH_DESKTOP_NODE_RUNTIME = 'C:\path\to\node-runtime'
$env:DSH_DESKTOP_WHISPER_DIRECTORY = 'C:\path\to\whisper.cpp\build\bin\Release'
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform win32 --arch x64
```

Node runtime 目录必须包含 `node.exe`，Whisper 目录必须包含 `whisper-cli.exe`。这些变量只用于本地打包，不要提交到仓库。

## 发布和验证

发布前运行这些针对性检查：

```sh
node --check apps/desktop/main.mjs
node --check apps/desktop/scripts/package.mjs
node --test apps/desktop/scripts/package-links.test.mjs
pnpm run build
pnpm run doc-sync
```

`Desktop Packages` workflow 可以在 GitHub Actions 上构建原生产物。本地打包时，只上传当前提交生成的产物，并核对 SHA256。当前可安装产物为 Windows 的 `DeepSeek-Harness-Setup-x64.exe` 和 Apple Silicon macOS 的 `DeepSeek-Harness-macos-arm64.dmg`。Windows 安装器目前没有 Authenticode 签名，在配置签名证书前，Windows SmartScreen 可能显示信任警告。
