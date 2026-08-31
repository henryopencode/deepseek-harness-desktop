# Agent Note: Mount bundled widgets in the desktop profile

Status: implemented
Archived: 2026-08-30

English | [中文](2026-08-28-desktop-widgets-not-mounted.zh.md)

## Problem

The desktop package contained the sprout and whale widget modules, but its generated `desktop` profile mounted only the base and web-app bundles, so the packaged widgets never appeared.

## Decision

The Electron launcher owns the desktop profile bundle list. New profiles include both widgets after the base and web-app layers. An existing profile is upgraded only when its bundle list is exactly the previous installation-owned default; custom bundle lists remain unchanged. The profile initialization is isolated in `apps/desktop/profile.mjs` and covered by Node tests for first initialization, legacy upgrade, and custom-list preservation.

## Alternatives considered

**Require users to run `dsh plugin` after installation.** Rejected because the desktop package already carries the modules and its product composition should be complete on first launch.

**Append the widgets to every existing profile.** Rejected because user-authored profile composition must remain authoritative.

## Consequences

Desktop launches now show both bundled widgets by default. Web and other profiles remain opt-in, and an existing custom desktop profile is never rewritten. The desktop package version advances to `0.2.9` so the corrected composition is distinguishable from the prior release.
