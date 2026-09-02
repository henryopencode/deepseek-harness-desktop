# Agent Note: Web runtime update progress reporting

Status: implemented

English | [中文](2026-09-02-web-runtime-update-progress.zh.md)

## Problem

The browser could confirm an update and then remain busy while the managed updater downloaded an archive, installed dependencies, compiled local Whisper, and restarted the service. Version polling identified completion but gave no indication whether the operation was advancing or stalled.

## Decision

The managed updater atomically writes `update-progress.json` under `.dsh-runtime` with a phase, percentage, versions, optional byte counts, and a failure diagnostic. The Host exposes this file through the read-only `host.updateStatus` RPC, validating the phase and numeric fields before returning it. The browser polls that RPC during installation and renders the reported phase and percentage; bounded version polling remains the completion guard for service restart. Activation copies the current lifecycle scripts to the runtime root so a successful update also installs the status-aware updater used by subsequent requests.

## Verification

The browser and Host API tests cover status polling, progress rendering, failure reporting, and the new RPC contract. The updater tests cover byte-progress callbacks, persisted phases, and completion. A packaged Web runtime is upgraded through the real release feed and checked for the active version, HTTP readiness, and visible progress state.

## Alternatives considered

**Show only a static busy message.** This leaves a long first update indistinguishable from a stalled process and gives the user no useful diagnostic.

**Stream progress directly from the detached updater.** A stream would be lost across browser or service reconnects; the atomic status file keeps the latest fact available through the same Host lifecycle that owns the update.

**Parse updater logs in the browser.** Log text is an unstable presentation channel and cannot provide typed phases, percentages, or validated failure fields.

## Consequences

The runtime keeps one transient progress file whose latest valid record is safe to read while an update is active. Download progress is byte-based when the server supplies a length and phase percentages remain coarse for dependency installation and restart. Older archives without the status-aware updater continue to complete through version polling, while newly activated archives expose detailed progress.
