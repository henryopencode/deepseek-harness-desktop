# Agent Note: 将桌面状态页限制在视口内

Status: implemented
Archived: 2026-08-30

[English](2026-08-27-viewport-bound-desktop-status-page.md) | 中文

## Problem

桌面外壳状态文档只给 `main` 元素设置了 `100vh` 高度。文档根节点仍保留浏览器默认边距，使总文档高度超过 BrowserWindow 视口，并在启动时显示不必要的纵向滚动条。

## Decision

内联状态文档会重置 `html` 和 `body` 的尺寸与边距，隐藏文档溢出，并让居中的 `main` 元素以 border-box 内边距填满完整视口。状态文本仍限制在原有的可读宽度内，不需要页面滚动。

## Alternatives considered

- **只在 `main` 上隐藏滚动条。** 未采用，因为溢出来自 body 边距创建的文档根节点；只设置子元素不能消除额外文档高度。
- **允许所有状态页滚动。** 未采用，因为启动和普通失败消息都很短，滚动条会暗示存在并不存在的额外内容。

## Consequences

- 启动和失败状态页会填满 BrowserWindow，且不会出现纵向滚动条。
- 极长诊断会在视口内换行，而不会让状态页扩展到视口之外。
