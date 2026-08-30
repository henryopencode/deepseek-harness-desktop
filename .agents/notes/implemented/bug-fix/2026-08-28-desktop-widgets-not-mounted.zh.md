# Agent Note: Mount bundled widgets in the desktop profile

Status: implemented

[English](2026-08-28-desktop-widgets-not-mounted.md) | 中文

## Problem

桌面安装包包含嫩芽和鲸鱼挂件模块，但生成的 `desktop` profile 只挂载了 base 与 web-app bundle，因此安装后的挂件从未显示。

## Decision

Electron 启动器拥有 desktop profile 的 bundle 列表。新 profile 会在 base 和 web-app 层之后加入两个挂件。已有 profile 只有在 bundle 列表恰好等于此前由安装程序拥有的默认值时才会升级；自定义 bundle 列表保持不变。profile 初始化逻辑独立在 `apps/desktop/profile.mjs`，并通过 Node 测试覆盖首次初始化、旧默认值升级和自定义列表保留。

## Alternatives considered

**要求用户安装后运行 `dsh plugin`。** 否决，因为桌面安装包已经携带模块，产品组合应在首次启动时完整可用。

**向所有已有 profile 追加挂件。** 否决，因为用户编写的 profile 组合必须保持权威。

## Consequences

桌面启动现在默认显示两个随包挂件。Web 和其他 profile 仍保持显式启用，已有自定义 desktop profile 不会被重写。桌面包版本升至 `0.2.9`，以区分修正后的组合与之前的版本。
