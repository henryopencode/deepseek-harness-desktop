# `@deepseek-ai/dsh-client-ui-runtime-update`

English | [中文](README.zh.md)

Loopback Web UI for the managed runtime updater. The plugin checks the Host release feed after the shell mounts and stays invisible when the deployment has no update feed, is offline, or is opened from a non-loopback authority. When a newer `dsh-v<version>` release is available, it opens a localized modal with explicit **Later** and **Update now** actions.

Installation is user-confirmed and guarded against duplicate clicks. The Host starts the verified updater, which stops and restarts the managed service. The browser tolerates the restart window, polls `host.describe` until the expected version answers, and only then reloads the page. A failed check is silent; a failed install remains visible and can be retried.

## Model Experience

None. The feature is a host lifecycle control and does not add model-visible input, tool output, or session events.

## Known Limitations

- The release feed is GitHub Releases and requires the runtime's update configuration.
- The browser waits for a bounded restart window; a service that takes longer needs a manual refresh.
