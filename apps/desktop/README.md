# DeepSeek Harness Desktop

English | [中文](README.zh.md)

This Electron shell owns one private `dsh web` child process, then displays its loopback server in a native window. The install contains an initial versioned runtime under `resources/runtime`; later runtime packages can be placed under `~/.dsh/runtimes/<version>` and selected through the atomic `current.json` pointer. The shell falls back to its bundled runtime when the selected version is missing, incomplete, or for another platform. It initializes a dedicated `desktop` profile under the shared Harness home with the base and Web bundles, keeps unrelated CLI `web` profile plugins out of desktop startup, and shares settings, credentials, sessions, and workspaces. Closing the window stops the owned child process tree.

## Build packages

Run `pnpm run build` first, then build the current platform:

```sh
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform darwin --arch arm64
```

For a Linux server without Electron, build only the replaceable runtime package:

```sh
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform linux --arch x64 --runtime-only
```

This mode does not download or package Electron. It produces `release/DeepSeek-Harness-runtime-linux-x64.tar.gz`, which can be unpacked into a versioned server directory and selected by the service manager.

The package script writes a directly runnable archive and a standalone runtime archive under `release/`. It supports `darwin/arm64`, `linux/x64`, and `win32/x64`; each package must be built on its matching operating system so the staged Node native dependencies match that platform. The Linux x64 archive extracts to one executable folder; run `./DeepSeek\ Harness-linux-x64/DeepSeek\ Harness` from the extraction directory. The GitHub `Desktop Packages` workflow builds all three native artifacts and their matching runtime archives.

To activate an extracted runtime without reinstalling the shell, run:

```sh
/path/to/DeepSeek-Harness-runtime-darwin-arm64/node/node /path/to/DeepSeek-Harness-runtime-darwin-arm64/activate-runtime.mjs --source /path/to/DeepSeek-Harness-runtime-darwin-arm64
```

The runtime archive includes its own Node executable and activation script, so this command does not require a source checkout, system Node, or pnpm. The source directory must contain `manifest.json`, `node/`, and `harness/`. Activation validates the platform and runtime files, copies the directory into `~/.dsh/runtimes/<version>`, and replaces `current.json` only after the copy is complete. Existing settings, credentials, sessions, and profiles are not changed.

Windows users should download `DeepSeek-Harness-Setup-x64.exe`. It installs the app under the current user's local programs directory, creates desktop and Start Menu shortcuts, appears in Windows Installed apps, and includes an uninstaller. macOS users should download `DeepSeek-Harness-macos-arm64.dmg`, drag the app onto the Applications alias, then open it from Applications. The ZIP is a portable fallback. The artifacts are unsigned because this repository does not carry a Developer ID, Linux package signature, or Authenticode certificate. macOS may require Control-click → Open, Windows may require More info → Run anyway, and Linux desktops may require marking the extracted executable as trusted.

The browser records 16 kHz mono PCM WAV, and desktop packages include a platform-native `whisper-cli`; local transcription does not require host FFmpeg, FFprobe, CMake, or a C/C++ toolchain. The selected Whisper model downloads under the Harness home on first use.

Repository branch roles, upstream synchronization, local Windows runtime overrides, packaging commands, and release verification are documented in [DESKTOP_REPOSITORY.md](../../DESKTOP_REPOSITORY.md).
