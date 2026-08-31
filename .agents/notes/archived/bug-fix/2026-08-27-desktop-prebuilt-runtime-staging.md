# Agent Note: Stage verified desktop runtime binaries for a local cross-build

Status: implemented
Archived: 2026-08-30

English | [中文](2026-08-27-desktop-prebuilt-runtime-staging.zh.md)

## Problem

A local Windows package rebuild can run on a host whose Node architecture or native toolchain does not match the x64 application payload. Rebuilding `whisper-cli` with that host would embed an incompatible executable, and copying the host Node runtime would do the same.

## Decision

The desktop packager accepts two optional local-build inputs: `DSH_DESKTOP_NODE_RUNTIME` names a Windows Node runtime directory, and `DSH_DESKTOP_WHISPER_DIRECTORY` names a directory containing a verified platform-matching Whisper executable with its libraries. When supplied for a Windows package, the script copies those files into the staged product and verifies `node.exe` and `whisper-cli.exe` before continuing. Vendored runtime packages are copied with their links dereferenced so a Windows package does not require developer-mode symbolic-link privileges. Without either input, every official CI build retains its normal host-runtime copy and native Whisper compilation.

## Alternatives considered

- **Cross-compile Whisper from any host architecture.** Rejected because it requires a complete compiler, SDK, and linker configuration for every local host, while the application already carries a verified matching runtime.
- **Ship host-built binaries without checking architecture.** Rejected because the resulting installer can launch but local transcription or the embedded server then fails at runtime.

## Consequences

- A local x64 Windows rebuild can reuse known-good x64 runtime artifacts without changing the released runtime protocol.
- The override variables are explicit local build inputs; production CI remains self-contained and does not depend on a prior installed application.
