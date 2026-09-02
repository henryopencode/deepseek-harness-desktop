# Agent Note: Bounded Web runtime update installation

Status: implemented

English | [中文](2026-09-01-web-runtime-update-install-wait.zh.md)

## Problem

The managed Web updater installs dependencies and may compile the local Whisper executable before it stops and restarts the service. The browser received an immediate accepted response and treated a 15-second polling limit as a restart failure even though installation was still in progress. Download requests without a deadline could also hold the lifecycle lock indefinitely when the release host stopped responding.

## Decision

The updater applies one validated network timeout to release metadata, archive, and checksum requests. `update-config.json` may set `networkTimeoutMs`, and `DSH_UPDATE_NETWORK_TIMEOUT_MS` overrides it for a deployment; the default is five minutes. A timed-out request aborts its response body and reports the operation and duration before the lifecycle lock is released.

The browser waits up to ten minutes at one-second intervals for `host.describe` to report the target version, covering download, dependency installation, Whisper compilation, and restart. During that window it may also display the persisted phase and percentage described by [Web runtime update progress reporting](2026-09-02-web-runtime-update-progress.md). The in-progress message names the installation work and warns that a first update may take several minutes. Reaching the bound reports that the update may still be running and leaves the notice available for a later refresh instead of claiming that service restart failed.

## Verification

Updater tests exercise SemVer and checksum behavior plus an unresponsive HTTP download that must abort with its bounded diagnostic. Browser tests cover the extended default polling budget and preserve the retry, dismissal, remote capability, and successful reload behavior.

## Alternatives considered

**Keep the 15-second browser bound.** This reports normal first-install work as a failure and makes the user retry while the updater may still own the lifecycle lock.

**Wait without a deadline.** This hides a permanently stalled release connection and can retain the lifecycle lock indefinitely; a validated bound makes the failure recoverable and diagnosable.

**Expose installer progress as model- or session-visible state.** This would add a second durable protocol to a detached updater whose product outcome is the active version. The read-only Host status described by [Web runtime update progress reporting](2026-09-02-web-runtime-update-progress.md) remains outside model and session state.

## Consequences

First updates can remain in the browser's busy state for several minutes while the managed runtime is prepared. A slow or stalled network request now terminates within the configured bound, while an installation that exceeds the browser window is described as pending rather than failed. Operators can tune the network bound per runtime without changing the browser's installation budget.
