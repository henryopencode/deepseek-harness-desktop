# DeepSeek Harness 桌面端

[English](README.md) | 中文

这个 Electron 外壳拥有一个私有 `dsh web` 子进程，把匹配的 Node runtime 和已构建 Harness 一起嵌入，然后在原生窗口展示该 loopback 服务。它会在共享的 Harness home 下初始化独立的 `desktop` profile，使 CLI 的 `web` profile 插件不会拖慢桌面端启动，同时继续共享设置、凭据、会话和工作区。由桌面端拥有的最终 Web 覆盖层会关闭默认浏览器交接。关闭窗口会停止它拥有的子进程树。

## 构建安装包

先运行 `pnpm run build`，再构建当前平台：

```sh
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform darwin --arch arm64
```

打包脚本会在 `release/` 下生成可直接运行的归档。它支持 `darwin/arm64`、`linux/x64` 与 `win32/x64`；每个包都必须在对应操作系统上构建，确保暂存的 Node 原生依赖匹配平台。Linux x64 归档解压后是一个可执行文件夹；在解压目录运行 `./DeepSeek\ Harness-linux-x64/DeepSeek\ Harness`。GitHub `Desktop Packages` workflow 会构建三个原生产物。

Windows 用户应下载 `DeepSeek-Harness-Setup-x64.exe`。它会安装到当前用户的本地程序目录、创建桌面和开始菜单快捷方式、显示在 Windows 已安装的应用中，并提供卸载程序。macOS 用户应下载 `DeepSeek-Harness-macos-arm64.dmg`，把应用拖到其中的 Applications 别名，再从应用程序中打开。ZIP 仅作为便携版备用。仓库未提供 Developer ID、Linux 包签名或 Authenticode 证书，因此下载归档首次启动时可能出现平台信任警告。macOS 可按住 Control 点击 → 打开，Windows 可选择更多信息 → 仍要运行，Linux 桌面环境可能需要将解压后的可执行文件标为受信任。

浏览器会录制 16 kHz 单声道 PCM WAV，桌面包内置平台原生的 `whisper-cli`；本地转写不需要宿主机安装 FFmpeg、FFprobe、CMake 或 C/C++ 工具链。所选 Whisper 模型会在首次使用时下载到 Harness home。

仓库分支职责、官方同步、本地 Windows runtime 暂存参数、打包命令和发布验证见[桌面仓库说明](../../DESKTOP_REPOSITORY.md)。
