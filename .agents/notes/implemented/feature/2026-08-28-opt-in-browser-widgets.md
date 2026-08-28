# Agent Note: Opt-in browser status and balance widgets

Status: implemented

English | [中文](2026-08-28-opt-in-browser-widgets.zh.md)

## Problem

The desktop product needs lightweight status and balance indicators without changing default profile composition, exposing credentials to browser code, or making external plugin installation necessary for packaged desktop users.

## Decision

`@deepseek-ai/dsh-sprout-widget` and `@deepseek-ai/dsh-whale-widget` are optional bundle plugins. They are dependencies of `@deepseek-ai/dsh-desktop`, so the packaged runtime can resolve them after a user adds either package to a `web` or `desktop` profile. Neither package appears in a shipped profile's default bundle list.

The sprout widget derives its process-local state from `session/event` turn boundaries and exposes only a same-origin boolean route. The whale widget resolves `DEEPSEEK_API_KEY` on the node side, requests the official balance endpoint, and returns only balance and currency to its same-origin browser script. The whale does not persist a balance, usage ledger, provider token, or pricing table.

## Alternatives considered

**Enable both widgets by default.** Rejected because existing profiles must retain their current page composition and users may not want status adornments or balance requests.

**Resolve DeepSeek credentials in the browser.** Rejected because a browser script must never receive the API key; the node route keeps the credential in the provider-side service.

**Keep the contributed whale usage and pricing implementation.** Rejected because it had no source-plane build or coverage evidence, relied on historical absolute paths, and coupled usage figures to unversioned pricing assumptions.

## Consequences

The widgets add optional user-visible routes and one packaged image asset. They require explicit profile activation and have no model-visible effect. The whale's displayed balance depends on `DEEPSEEK_API_KEY`; without it, the widget reports the missing configuration instead of making an unauthenticated request.
