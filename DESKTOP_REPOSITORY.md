# DeepSeek Harness Desktop repository

English | [中文](DESKTOP_REPOSITORY.zh.md)

This repository is the independent product repository for the customized DeepSeek Harness desktop app. It is not a GitHub fork. The `master` branch contains the product changes and release configuration; the `official` branch mirrors `deepseek-ai/deepseek-harness:master` and is kept separate so upstream updates can be reviewed before they are merged into the product branch.

## Remotes and branches

The local checkout uses these remotes:

```text
origin       https://github.com/henryopencode/deepseek-harness-desktop.git
upstream     https://github.com/deepseek-ai/deepseek-harness.git
legacy-fork  https://github.com/henryopencode/deepseek-harness.git
```

Only `origin/master` and `origin/official` are product-repository branches. `legacy-fork` is retained as a reference to the former fork and is not a push target for new work.

## Sync official changes

Run this from a clean checkout. The `official` branch is a mirror branch, so do not make product edits there.

```sh
git fetch upstream master
git switch master
git branch -f official upstream/master
git push origin official --force-with-lease
git merge official
# Resolve and test conflicts, then commit the merge.
git push origin master
```

Review `git diff ORIG_HEAD..HEAD` after the merge. Keep product changes on `master`, and update the desktop README and Agent Note when an upstream change alters the packaging or lifecycle contract.

## Build the desktop packages locally

Install Node 22.19 or newer, pnpm, and the repository dependencies first:

```sh
pnpm install
pnpm run build
```

Build on the target operating system so native dependencies match the package:

```sh
# macOS Apple Silicon
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform darwin --arch arm64

# Linux x64
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform linux --arch x64

# Windows x64 (run in PowerShell or cmd)
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform win32 --arch x64
```

The output is written to `release/`. Each platform build emits both the installable shell artifact and a matching `DeepSeek-Harness-runtime-<platform>-<arch>` archive for later runtime updates. Windows packaging needs NSIS (`makensis.exe`). The Windows build script can reuse a verified x64 Node runtime and a prebuilt x64 Whisper directory when a native rebuild is unavailable:

```powershell
$env:DSH_DESKTOP_NODE_RUNTIME = 'C:\path\to\node-runtime'
$env:DSH_DESKTOP_WHISPER_DIRECTORY = 'C:\path\to\whisper.cpp\build\bin\Release'
pnpm --filter @deepseek-ai/dsh-desktop run package -- --platform win32 --arch x64
```

The runtime directory must contain `node.exe`; the Whisper directory must contain `whisper-cli.exe`. These overrides are for local packaging only and are not committed to the repository.

## Release and verification

Run the focused checks before publishing:

```sh
node --check apps/desktop/main.mjs
node --check apps/desktop/scripts/package.mjs
node --check apps/desktop/runtime.mjs
node --check apps/desktop/activate-runtime.mjs
node --test apps/desktop/runtime.test.mjs apps/desktop/profile.test.mjs apps/desktop/scripts/package-links.test.mjs
pnpm run build
pnpm run doc-sync
```

The `Desktop Packages` workflow can build native artifacts on GitHub Actions. For a local build, upload only artifacts produced by the current commit and verify their SHA256 values. The expected installable artifacts are `DeepSeek-Harness-Setup-x64.exe` for Windows and `DeepSeek-Harness-macos-arm64.dmg` for Apple Silicon macOS; the matching runtime archives are optional update payloads. The Windows installer is currently unsigned, so Windows SmartScreen may show a trust warning until an Authenticode certificate is configured.
