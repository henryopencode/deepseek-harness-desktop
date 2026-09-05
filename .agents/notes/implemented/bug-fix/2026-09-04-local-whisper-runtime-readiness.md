# Agent Note: Local Whisper runtime readiness

Status: implemented

English | [中文](2026-09-04-local-whisper-runtime-readiness.zh.md)

## Problem

The local speech provider delegated executable discovery to `nodejs-whisper`. When its bundled `whisper-cli` was absent, that dependency started CMake configuration and C++ compilation inside the first recording request. Build failures were collapsed into the same message as model or network failures, and concurrent recordings could race through model preparation.

## Decision

The provider checks the installed `nodejs-whisper` package for a usable `whisper-cli` before invoking the dependency and fails immediately when runtime installation has not prepared it. Native compilation remains owned by the Web runtime installer, which reports its existing installation milestones. Model preparation uses a per-path promise lock, downloads to a unique temporary file, validates the GGML header, and atomically renames only a valid file into the model directory. `describe()` reports readiness only when both the selected model and the executable are usable. Provider diagnostics retain the underlying error in the Host log while the browser receives stable runtime-not-ready copy.

## Alternatives considered

**Keep `nodejs-whisper`'s implicit build in the recording request.** Rejected because a microphone action could unexpectedly spend minutes compiling native code, and failures could not be distinguished from download failures.

**Build the executable in every provider instance.** Rejected because multiple services could race to mutate the installed dependency, and runtime installation already owns dependency and native preparation.

**Accept any non-empty downloaded model file.** Rejected because an interrupted download or an HTML error response can be non-empty while remaining unreadable by whisper.cpp; the GGML header is a cheap format guard before atomic activation.

## Consequences

The first recording no longer launches an unbounded native build. An incomplete runtime fails with an actionable reinstall message, and a valid model cannot be replaced by a partial download. Multiple requests share model preparation, while transcription itself remains serialized by the existing busy guard. Source deployments must run the runtime installer with CMake and a native toolchain before using local speech.

## Verification

Provider tests use a valid GGML header fixture, cover malformed model downloads, disabled auto-download, missing executable rejection, and existing transcription behavior. The runtime package is type-checked and the focused speech provider tests are run with the repository's Node 22 runtime.
