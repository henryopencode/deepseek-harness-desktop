# @deepseek-ai/dsh-sprout-widget

[English](README.md) | 中文

这是一个可选的、可拖拽的小嫩芽状态挂件，显示在 DeepSeek Harness 浏览器界面上。只要有一个智能体回合处于打开状态，它会显示为绿色；所有回合结束后会变为灰色。

## 启用

```sh
dsh plugin --profile web add @deepseek-ai/dsh-sprout-widget
dsh plugin --profile desktop add @deepseek-ai/dsh-sprout-widget
```

Web 和 desktop profile 默认都不会加入此插件。

## 行为

Node 插件统计实时 `session/event` 中的 `turn/start` 和 `turn/end` 事件，在 `/dsh-sprout/state` 提供当前布尔状态，并注入同源浏览器脚本。浏览器脚本每秒轮询一次，显示当前状态，并将拖拽位置保存在浏览器 `localStorage` 中。

## 模型体验

### 浏览器覆盖层

#### 模型可见内容

`/dsh-sprout/*` 浏览器路由不增加提示词、工具 schema、结果或会话记录。

#### Token 影响

挂件不增加请求 token。

#### KV Cache 影响

挂件不增加可缓存的请求前缀。

## 已知限制与延期工作

- **状态仅存在于当前进程**：Harness 重启会重置打开回合计数；挂件会显示为空闲，直到新的实时回合开始。
