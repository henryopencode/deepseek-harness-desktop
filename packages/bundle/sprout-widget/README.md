# @deepseek-ai/dsh-sprout-widget

English | [中文](README.zh.md)

An opt-in draggable sprout status widget for the DeepSeek Harness browser surface. It turns green while at least one agent turn is open and greys once every turn has ended.

## Enable

```sh
dsh plugin --profile web add @deepseek-ai/dsh-sprout-widget
dsh plugin --profile desktop add @deepseek-ai/dsh-sprout-widget
```

The Web and desktop profiles do not add this plugin by default.

## Behavior

The node plugin counts live `session/event` `turn/start` and `turn/end` events, serves the current boolean state at `/dsh-sprout/state`, and injects a same-origin browser script. The script polls once per second, displays the current state, and retains its drag position in browser `localStorage`.

## Model Experience

### Browser overlay

#### What the model sees

The `/dsh-sprout/*` browser routes contribute no prompt, tool schema, result, or session record.

#### Token effect

The widget adds no request tokens.

#### KV Cache effect

The widget adds no cacheable request prefix.

## Known Limitations and Deferred Work

- **The state is process-local** — restarting the Harness resets the open-turn count and the widget resumes as idle until the next live turn starts.
