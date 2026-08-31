# Agent Note: Electron desktop packages

Status: implemented
Archived: 2026-08-30

English | [中文](2026-08-24-electron-desktop-packaging.zh.md)

## Problem

The browser profile needs a native application that owns its local web process and can ship on macOS, Linux, and Windows. The existing Swift launcher only runs on macOS and relies on a checkout-local Node installation.

## Decision

`apps/desktop` provides an Electron main process that reserves a private loopback port, initializes an empty `desktop` profile under the shared Harness home, writes a final runtime patch that disables default-browser handoff, starts the packaged `dsh` CLI with a clean environment that retains platform user-profile and temporary-directory variables, renders the local URL in a sandboxed `BrowserWindow`, grants microphone access only to that loopback page, and terminates its owned process tree on quit. The child writes stdout and stderr directly to its diagnostic file rather than Electron pipe sockets, and macOS reaches Node through a quoted `/bin/sh` child in the owned process group; Finder launches therefore do not stall before Node loads the Harness. The dedicated profile excludes CLI `web` profile plugins while sharing settings, credentials, sessions, and workspaces. The product name is `DeepSeek Harness`; the packaged macOS/Windows icons use the same official black whale mark as the Web application. The shell exposes only the product menu and the Chinese `显示` menu; it omits the generic edit menu.

The package script first runs `pnpm deploy` from the desktop dependency root with pnpm's hoisted node linker. It then materializes the two vendored runtime packages that pnpm otherwise leaves as build-machine links, producing a platform-matched, self-contained runtime closure under Electron resources without deep virtual-store paths that Windows Explorer cannot extract. The package also carries a matching Node executable and a precompiled platform-native `whisper-cli`; every macOS Whisper binary receives an `@loader_path` runpath so its dynamic libraries resolve after installation. Model data remains user-local and downloads on first use. Browser dictation submits 16 kHz mono PCM WAV directly to Whisper, so packages do not carry FFmpeg or FFprobe. macOS ships an ARM64 ZIP and a drag-to-install DMG; Linux archives an x64 executable folder as `.tar.gz`; Windows archives an x64 folder containing the `.exe` and packages it into a per-user NSIS installer that creates desktop and Start Menu shortcuts and registers an Installed apps entry. The GitHub `Desktop Packages` workflow uses a short Windows staging path, verifies archive paths stay within 220 characters, extracts the portable archive before it probes the bundled Whisper executable, checks the macOS relative runpath and DMG, installs and uninstalls the Windows installer while checking its shortcuts and registration, and uploads all artifacts to the desktop release.

The same packaged runtime is also published as a standalone versioned archive; selection and atomic activation are defined in [the versioned desktop runtime note](../architecture/2026-08-28-versioned-desktop-runtime.md).

## Alternatives considered

**Keep the Swift launcher.** Rejected because its AppKit implementation cannot produce Linux or Windows executables.

**Copy the checkout and its `node_modules` directory.** Rejected because workspace links can contain absolute build-machine paths and do not produce a portable archive.

**Use Electron's Node runtime for the Harness child.** Rejected because native modules must match the packaged Node ABI; the launcher instead carries the Node runtime that built the staged dependency closure.

## Consequences

The desktop archive is large because it intentionally includes the Harness runtime and Node executable. Builds take place on native macOS ARM64, Linux x64, and Windows x64 runners so each archive includes the matching native addons. The release workflow caches platform Electron downloads, while each package still stages and compresses its self-contained runtime. The repository does not contain Developer ID, Linux package-signing, or Authenticode credentials, so downloaded archives and the Windows installer can trigger platform trust warnings before their first launch.
