# @deepseek-ai/dsh-whale-widget

A small, **draggable whale balance widget** for the DeepSeek Harness Web
surface. It lives in the bottom-right corner of the DSH interface and shows:

- the **DeepSeek API balance** (60s auto-refresh, click the whale to refresh, with
  a rolling number animation);
- **today's usage** in two modes — the default **ledger** mode (the whale
  records balance deltas locally, no token needed) or the optional **realtime
  token** mode;
- **per-turn consumption** (DEEPSEEK_API_KEY only, no platform token required),
  shown as a bubble after each finished turn.

The whale is interactive: it is **draggable/snapping**, flips horizontally when
snapped left, has a squishy **press/bounce** effect, optional **sounds**, a
hamburger **settings menu** (size, sound, usage mode, bubble toggles), and
**random lines** on tap.

> Upstream source and design: [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) (MIT).

## How it works

This is a node-side **bundle plugin**, following the same shape as
`@deepseek-ai/dsh-web-app` and `@deepseek-ai/dsh-sprout-widget`:

- `package.json` declares `dsh.bundle.patch` → `./cordis.patch.yml`, inserting a
  single row (`whale-widget`) into the profile.
- `lib/index.js` (`inject: ['webServer', 'credentials']`, `apply(ctx)`) does
  three things:
  1. serves the whale assets and the balance/usage/status JSON under `/dsh-whale/`;
  2. resolves `DEEPSEEK_API_KEY` (and optionally `DEEPSEEK_PLATFORM_TOKEN`) through
     the `credentials` service;
  3. `ctx.webServer.tapIndex` injects `<script defer src="/dsh-whale/widget.js"></script>`
     into the served `index.html`.

The client is a self-contained vanilla-JS + inline-SVG component that polls the
whale endpoints.

## Notes / credentials

- `DEEPSEEK_API_KEY` is required to read the balance.
- `DEEPSEEK_PLATFORM_TOKEN` is optional; without it the widget uses the built-in
  ledger usage mode.
- The ledger and size memory files default to `$DSH_HOME` (e.g.
  `~/.dsh/.dshw-usage.json`), so they survive plugin updates.

## License

MIT
