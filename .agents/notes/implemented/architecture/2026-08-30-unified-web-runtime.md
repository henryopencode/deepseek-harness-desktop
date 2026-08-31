# Agent Note: Unified cross-platform Web runtime

Status: implemented

English | [中文](2026-08-30-unified-web-runtime.zh.md)

## Problem

Maintaining an Electron shell created separate platform packages, duplicated release work, and placed a large desktop-specific surface in the repository even though the product experience is a browser Web UI.

## Decision

The product ships one cross-platform `tar.gz` Web runtime instead of an Electron application. The archive contains the built dsh packages, Web frontend, vendored runtime tarballs, the Landlock entry package, and Node launch scripts. A target machine installs Node.js 22.19 or newer and runs `node install.mjs`; npm resolves optional native dependencies for that machine's operating system and architecture. `node run.mjs web` starts the browser server in the foreground, while `node start.mjs`, `node status.mjs`, and `node stop.mjs` manage one background Web server with the same commands on every supported operating system. The existing Web profile and local Whisper speech model remain available.

The archive never includes user settings, credentials, sessions, workspaces, or Whisper model data. Those remain in the normal Harness home and can be redirected with `DSH_HOME`. `pnpm run release:web` performs the official build and writes the single archive; GitHub release automation publishes that Web runtime artifact. Electron source and platform-specific desktop packages are not part of the product release.

## Alternatives considered

**Keep the Electron shell.** Rejected because it requires platform-specific installers and carries a large duplicate runtime for a browser-based experience.

**Ship one archive with build-machine `node_modules`.** Rejected because native optional dependencies are platform-specific and workspace links are not portable; the target machine must resolve them during installation.

**Require a hosted Web service.** Rejected because the local runtime preserves local sessions, credentials, workspaces, and Whisper data without requiring a remote deployment.

## Consequences

Users download and extract one archive on any supported operating system and complete one dependency-install step. The trade-off is a Node.js prerequisite, a writable install directory, and network access for the first npm install; Windows users also need a tar.gz extraction tool. Existing user data and the local Whisper model survive runtime replacement because they live outside the archive.
