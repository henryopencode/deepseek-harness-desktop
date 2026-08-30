# Agent Note: Version the desktop Harness runtime separately from the shell

Status: implemented

English | [中文](2026-08-28-versioned-desktop-runtime.zh.md)

## Problem

The Electron shell and the Harness runtime were released as one replace-only installation unit. A change to Harness packages or the frontend therefore required reinstalling the desktop application even though the shell process and its window behavior were unchanged.

## Decision

The desktop application carries one validated initial runtime under `resources/runtime`. That directory contains `manifest.json`, the platform-matched Node executable, and the staged Harness dependency tree. The launcher resolves a user-selected runtime from `~/.dsh/runtimes/current.json` before falling back to the bundled runtime. A selection is accepted only when its version directory, manifest schema, platform, architecture, Node executable, and Harness directory are valid; invalid or incomplete selections are ignored.

The desktop packager emits a matching standalone runtime archive. The archive includes its own Node executable, `runtime.mjs`, and `activate-runtime.mjs`; the latter installs an extracted runtime into `~/.dsh/runtimes/<version>` and atomically replaces `current.json` only after validation and copying finish. Existing settings, credentials, sessions, profiles, and the Electron installation are outside this operation. The runtime directory format is versioned by `manifest.json` so a future downloader can use the same installer and activation functions.

## Alternatives considered

**Require a separate Node installation.** Rejected because the supported native dependencies need a known Node ABI and users may not have a compatible Node version or package manager.

**Download each update into the Electron application directory.** Rejected because application directories are protected or replaced by platform installers; user-managed runtime versions belong under the shared Harness home and can survive shell upgrades.

**Replace the active runtime files in place.** Rejected because an interrupted copy could leave the next launch without a complete executable or dependency tree. Version directories and an atomic pointer provide an intact fallback.

## Consequences

The first install remains a single macOS DMG, Windows installer, or Linux archive and starts without a network update. Later Harness releases can publish only a platform-matched runtime archive; switching versions does not reinstall Electron or modify user data. The shell still needs a normal application release when its Electron code or native shell behavior changes, and runtime archives remain platform- and architecture-specific because they include Node native dependencies and Whisper binaries.
