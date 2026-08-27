# @deepseek-ai/dsh-sprout-widget

A small, **draggable sprout status widget** for the DeepSeek Harness Web
surface. It follows the harness agent session turn lifecycle and renders:

- **working** (an agent turn is open, `turn/start` → `turn/end`) → the sprout
  **turns green and gently grows**;
- **idle** → the sprout **greys and sways**;
- mouse hover shows a `Harness 工作中 / 空闲` tooltip; a plain **click** polls
  the status again;
- **draggable** — grab it and move it anywhere; the position is remembered in
  `localStorage`, and it stays clamped inside the window.

## How it works

This is a node-side **bundle plugin**, following the same shape as
`@deepseek-ai/dsh-web-app`:

- `package.json` declares `dsh.bundle.patch` → `./cordis.patch.yml`, inserting a
  single row (`sprout-widget`) into the profile.
- `src/index.ts` (`inject: ['webServer']`, `apply(ctx)`) does three things:
  1. subscribes to the session event feed (`session/event`, `turn/start` /
     `turn/end`) and keeps a global open-turn counter — `> 0` means working;
  2. `ctx.webServer.register` serves `/dsh-sprout/widget.js` (the client
     sprite) and `/dsh-sprout/state` (the status JSON);
  3. `ctx.webServer.tapIndex` injects
     `<script defer src="/dsh-sprout/widget.js"></script>` into the served
     `index.html`.

The client sprite is a self-contained vanilla-JS + inline-SVG component that
polls `/dsh-sprout/state` once per second.

## Building / publishing

`lib/` is a build artifact (gitignored); `src/index.ts` is the committed source.
Build the package with the repository root build (`pnpm run build`), which also
type-checks it.

## Icon / design note

The sprout is drawn with inline SVG and animated purely in CSS — no image
assets, no network fetches beyond the status poll.

## License

MIT
