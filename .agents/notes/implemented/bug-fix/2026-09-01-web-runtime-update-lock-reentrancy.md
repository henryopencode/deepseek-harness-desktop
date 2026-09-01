# Agent Note: Web runtime updater reuses the lifecycle lock during restart

Status: implemented

English | [中文](2026-09-01-web-runtime-update-lock-reentrancy.zh.md)

## Problem

The managed Web updater owns the lifecycle lock while it switches runtime versions and restarts the background service. Calling the public `start.mjs` entrypoint from that critical section makes the child manager try to acquire the same lock, so a confirmed update can download and stage successfully but fail during restart and roll back.

## Decision

The manager exposes lock-free start and stop operations for callers that already own its lifecycle lock. The updater imports the start operation directly and awaits it during activation and rollback. The Web runtime packager includes the manager under its canonical module name as well as the public `manage.mjs` entry, so the packaged updater can resolve that import. Public `start.mjs` and `stop.mjs` continue to acquire the lock before calling those operations, so concurrent user lifecycle commands remain serialized.

## Alternatives considered

**Release the lock before restarting.** This would allow another lifecycle command to observe or alter the half-switched state between writing `current.json` and confirming startup.

**Make the updater invoke a public entrypoint in a separate process.** A separate process cannot safely re-enter the lock and adds another failure point without improving isolation, because the updater already controls the same runtime root.

**Remove lifecycle locking.** Without the lock, concurrent updates, starts, and stops could replace the active version or PID file while another operation is using it.

## Consequences

Confirmed updates can restart the managed service while retaining one lock owner for the whole switch. The packaged updater can import the same internal operation as source builds. The lock-free operations are internal coordination hooks and are not exposed through the browser RPC surface.

## Testing

The updater unit tests and syntax checks pass. A packaged `rc.13` instance successfully checks the GitHub Release feed and stages `rc.14`; the first real activation exposed this lock re-entry defect, after which the test instance was restored to `rc.13` and restarted successfully. A subsequent release will exercise the corrected activation path end to end.
