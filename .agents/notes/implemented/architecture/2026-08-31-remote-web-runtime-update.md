# Agent Note: Opt-in remote Web runtime installation

Status: implemented

English | [中文](2026-08-31-remote-web-runtime-update.zh.md)

## Problem

The Web runtime can learn that a newer managed package is available while the browser page is reached through a server address. Restricting installation to loopback forces an administrator to leave the page and use SSH for every confirmed update, but allowing every non-loopback request to start the updater would expose a host-side process replacement to anyone who can reach the port. The browser-trust fence identifies serving authorities but is deliberately not an authentication layer.

## Decision

`host.updateCheck` returns an optional `installAvailable` flag. `ApiProxyService` sets it only when `allowRemoteUpdate` is true and a managed `update.mjs` exists under `webRuntimeRoot`. The Web bundle maps `DSH_WEB_ALLOW_REMOTE_UPDATE=1` to that setting; the default is false.

The connection node half keeps `host.updateInstall` in its privileged method set. When the opt-in is enabled, this one method may pass the fence for a loopback request or a request whose authority is listed in `trustedHosts`; all other privileged methods continue to require loopback. The deployment remains responsible for authentication in its reverse proxy or another outer layer before enabling the setting. The updater path is still resolved from the configured runtime root, never from browser input, and the existing updater verifies the downloaded package before replacing and restarting the service.

The browser update notice uses `installAvailable` together with the local loopback fact: it offers **Update now** for loopback pages and for authenticated remote deployments that advertise the capability, otherwise it reports that the server administrator must update through the deployment's management path.

## Verification

Connection tests prove that the default denies a trusted non-loopback `host.updateInstall` request and that the opt-in admits only the declared authority before RPC dispatch. API proxy tests execute a temporary managed updater check script and assert the `installAvailable` value for both settings. Browser tests cover explicit remote capability enabled and disabled states, including the install button and status message.

## Alternatives considered

**Keep remote installation SSH-only.** This preserves the smallest remote attack surface but makes the browser's update notification check-only and requires a separate administration step for every release.

**Add authentication to the connection package.** This would duplicate deployment identity, session, and credential policy inside a transport package that currently provides only Host/Origin reachability checks. External authentication remains the deployment concern, and the opt-in is safe only when that layer is present.

**Allow every trusted Host to install.** This would turn a serving-authority declaration into a process-management grant and would make a typo or broad allowlist materially more dangerous. The explicit setting and the single-method exception keep the default and the other privileged APIs unchanged.

## Consequences

Remote users can confirm and wait for a managed Web runtime restart from the same page when the deployment explicitly opts in and its outer authentication protects the route. Deployments that do not opt in retain the previous SSH-only installation workflow while still receiving update availability. Operators must set `DSH_WEB_ALLOW_REMOTE_UPDATE=1` only with the correct `trustedHosts` authority and reverse-proxy authentication; the connection package cannot enforce that external identity itself.
