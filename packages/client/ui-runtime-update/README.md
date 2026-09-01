# `@deepseek-ai/dsh-client-ui-runtime-update`

English | [中文](README.zh.md)

Web UI for the managed runtime updater. The plugin checks the Host release feed after the shell mounts and every five minutes while the page remains open, and stays invisible when the deployment has no update feed or is offline. When a newer `dsh-v<version>` release is available, it opens a localized modal with an explicit **Later** action; loopback runtimes and remote deployments that advertise `installAvailable` offer **Update now**. Choosing **Later** suppresses that release for the current page and a later release opens the modal again.

Installation is user-confirmed and guarded against duplicate clicks. The Host starts the verified updater, which stops and restarts the managed service. The browser tolerates the restart window, polls `host.describe` until the expected version answers, and only then reloads the page. A failed check is silent; a failed install remains visible and can be retried.

## Model Experience

None, as the browser UI checks and controls Host runtime lifecycle without adding model-visible input, tool output, or session events.

#### KV Cache effect

None; the plugin neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The release feed is GitHub Releases and requires the runtime's update configuration.
- Remote deployments expose update status after the reverse proxy authenticates the page; installation is available only when the Host deployment enables `allowRemoteUpdate` and declares the serving authority in `trustedHosts`.
- The browser waits for a bounded restart window; a service that takes longer needs a manual refresh.
