# Agent Note：可选的浏览器状态与余额挂件

Status: implemented

[English](2026-08-28-opt-in-browser-widgets.md) | 中文

## 问题

桌面产品需要轻量的状态和余额提示，但不能改变默认 profile 组合、不能把凭据暴露给浏览器代码，也不能让桌面安装包用户必须额外安装外部插件。

## 决策

`@deepseek-ai/dsh-sprout-widget` 和 `@deepseek-ai/dsh-whale-widget` 是可选 bundle 插件。二者不属于桌面安装包或其默认 profile；`web` 和其他 profile 仍需显式启用。

嫩芽挂件从 `session/event` 的回合边界推导进程内状态，只提供同源布尔路由。鲸鱼挂件只在 Node 侧读取 `DEEPSEEK_API_KEY`，请求官方余额端点，并只把余额和币种返回同源浏览器脚本。鲸鱼不会持久化余额、用量账本、平台 token 或定价表。

## 曾考虑的替代方案

**在每个 profile 中默认启用两个挂件。** 否决，因为非桌面 profile 必须保持现有页面组合不变，用户也可能不希望出现状态装饰或余额请求。

**在浏览器中读取 DeepSeek 凭据。** 否决，因为浏览器脚本绝不能收到 API key；Node 路由把凭据保留在 provider-side service 中。

**保留贡献的鲸鱼用量和定价实现。** 否决，因为它没有源码层构建或覆盖率证据，依赖历史绝对路径，并把用量数字耦合到未版本化的定价假设。

## 后果

两个挂件增加可选的用户可见路由和一个随包图片资产。它们需要用户显式激活，对模型不可见。鲸鱼显示余额依赖 `DEEPSEEK_API_KEY`；没有该密钥时会报告缺少配置，而不会发起未认证请求。
