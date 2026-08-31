# Agent Note: Authenticated remote Web deployment

Status: implemented

English | [中文](2026-08-31-authenticated-remote-web-update-status.zh.md)

## Problem

The browser Web runtime needs a protected public entry point and a secure browser context for microphone capture. A remote browser must also see release status without being allowed to restart the server.

## Decision

Remote deployments place Nginx in front of the Harness Web server. Nginx terminates HTTPS and applies Basic Authentication to the SPA, HTTP API, and WebSocket upgrades. The Harness process listens only on `127.0.0.1`, so the application port is not directly exposed.

The browser update plugin checks `host.updateCheck` for both loopback and authenticated remote pages when the shell mounts and every five minutes while the page remains open. A page suppresses a release after the user chooses Later, then reopens the notice only when a newer release appears. `host.updateInstall` remains loopback-only at the Connection request fence, and remote pages show the available version with an SSH update instruction. The restriction is enforced before API dispatch, so hiding the button is not the security control.

An IP deployment may use a self-signed certificate with an IP Subject Alternative Name. Browsers require the operator to trust that certificate before granting microphone access; a publicly trusted certificate requires a domain name or a tunnel.

## Consequences

Authenticated remote users can use browser microphone capture and receive update notices. Server upgrades remain an SSH operation, preserving service ownership and avoiding browser-triggered process replacement. The IP certificate produces a first-visit browser warning until it is trusted on each client.

## Alternatives considered

**Expose the Harness port directly.** This leaves the API and WebSocket endpoint without a single authentication and TLS policy, and makes the application port part of the public attack surface.

**Use HTTP with Basic Auth.** Authentication would protect the endpoint, but browsers still treat microphone capture as an insecure context for a raw public IP, so speech input would remain unavailable.

**Allow remote `host.updateInstall`.** A browser-triggered process replacement would give the public client server lifecycle authority and could interrupt active sessions; remote deployments therefore update through SSH.

## Verification

The Connection node-half test asserts that `host.updateInstall` is refused for a declared remote authority while ordinary API requests continue through the bridge. Deployment verification covers Nginx authentication, TLS, WebSocket forwarding, and the browser secure-context requirement.
