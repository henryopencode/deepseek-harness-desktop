# Agent Note: Use the selected Node runtime for Web updates

Status: implemented

English | [中文](2026-09-02-web-runtime-update-node-selection.zh.md)

## Problem

The managed Web updater runs npm from `PATH`. A service started with a supported Node release can therefore invoke an older npm whose shebang points at a different Node binary, causing dependency installation to fail before the new runtime is activated.

## Decision

The Web runtime installer resolves npm's CLI beside `process.execPath` and invokes that CLI through the same Node executable. It supports the npm layout used by Unix and Windows Node distributions. If the selected Node installation does not contain a bundled npm CLI, the installer falls back to the platform npm command so minimal Node distributions retain their existing behavior. The subprocess postinstall helper resolves `node-pty` through `createRequire`, which keeps an older updater able to install the next runtime before it can use the newer Node-aware installer.

## Verification

The installer test creates a representative Node/npm layout and verifies that the selected Node path is used to invoke npm rather than a PATH shebang. The subprocess postinstall helper remains resolvable on Node versions that do not implement `import.meta.resolve`. The managed update path is exercised by upgrading the local Web service after the fix and checking the active version and HTTP response.

## Alternatives considered

**Continue invoking `npm` from `PATH`.** This allows an unrelated older Node installation to control dependency installation and can fail after a valid archive has already been downloaded.

**Bundle npm in every Web archive.** This increases the runtime package and creates a second package-manager distribution to maintain; the Node installation already owns npm in supported environments.

**Use pnpm or Corepack for updates.** The runtime package is installed with npm and must work on hosts that do not enable Corepack, so changing package managers would add an unnecessary prerequisite.

## Consequences

Updates use the same Node version that launched the updater, preventing npm shebang drift from breaking activation. The next runtime remains installable by an older updater during one release transition. Hosts with a Node binary that omits npm still receive the prior PATH-based fallback and its corresponding environment requirement.
