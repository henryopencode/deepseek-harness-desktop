# @deepseek-ai/dsh-whale-widget

English | [中文](README.zh.md)

An opt-in draggable whale widget for the DeepSeek Harness browser surface. It displays the current DeepSeek API balance and refreshes when the user clicks its balance label.

## Enable

```sh
dsh plugin --profile web add @deepseek-ai/dsh-whale-widget
dsh plugin --profile desktop add @deepseek-ai/dsh-whale-widget
```

The Web and desktop profiles do not add this plugin by default.

## Behavior

The browser receives a static widget script and whale image through same-origin routes. The browser never receives API credentials. The node plugin resolves `DEEPSEEK_API_KEY` through `ctx.credentials`, requests `https://api.deepseek.com/user/balance`, and returns only the balance value and currency to the browser. A missing key, upstream failure, or invalid upstream response renders a Chinese error message in the widget.

The widget stores no balance, usage, or API token. Its position lasts only for the current page load.

## Attribution

The bundled whale image is adapted from [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget), which the contributor identifies as MIT-licensed.

## Model Experience

### Browser overlay

#### What the model sees

The `/dsh-whale/*` browser routes contribute no prompt, tool schema, result, or session record.

#### Token effect

The widget adds no request tokens.

#### KV Cache effect

The widget adds no cacheable request prefix.

## Known Limitations and Deferred Work

- **Balance only** — usage and cost estimates remain outside this plugin because they need a versioned provider-pricing source and separate validation.
