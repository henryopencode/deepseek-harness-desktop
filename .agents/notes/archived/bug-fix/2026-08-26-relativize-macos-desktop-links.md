# Agent Note: Relativize macOS desktop application links

Status: implemented
Archived: 2026-08-30

English | [中文](2026-08-26-relativize-macos-desktop-links.zh.md)

## Problem

Electron framework aliases can carry the build-stage directory as an absolute symbolic-link target. An archived application then works only while that local build directory remains present; a DMG installation on another Mac fails before the Electron main process loads.

## Decision

`apps/desktop/scripts/package-links.mjs` rewrites every absolute symbolic link whose destination remains inside the macOS application bundle to a relative link before the application is signed and archived. Links whose destinations escape the bundle fail packaging. The portable-link assertion scans the entire macOS application bundle as well as the staged Harness files.

The macOS release job unit-tests the link rewrite, rejects absolute links after extracting the ZIP, verifies the application signature, and starts the packaged Electron executable in Node mode. The Whisper executable and DMG checks remain separate acceptance evidence.

## Alternatives considered

- **Copy framework targets instead of retaining framework aliases.** Rejected because the Electron framework layout uses aliases as part of its expected bundle structure. Relative aliases preserve that layout without binding the bundle to the build host.
- **Check only the DMG image metadata.** Rejected because a valid disk image can still contain an application whose executable cannot load. Extraction, signature verification, and executable startup observe the installed artifact's required runtime path.

## Consequences

- macOS ZIP and DMG artifacts contain links that resolve within the installed application bundle.
- A package fails before release if Electron or another bundled component retains a build-host absolute link.
- macOS packaging adds a lightweight Electron executable startup check after archive extraction.
