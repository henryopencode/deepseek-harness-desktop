# Agent Note: Web 运行时设置模板

Status: implemented

[English](2026-09-05-web-runtime-settings-template.md) | 中文

## Problem

Web 运行时发布包包含可执行文件和前端，却没有新部署所需的模型路由配置。用户必须手动重建提供方和模型条目，包括图片能力声明，同时凭据又必须留在发布归档之外。

## Decision

`apps/cli/config/settings.example.yaml` 是版本化且不含凭据的模型模板。它默认选择 `codex-relay/gpt-5.6-sol`，并在 `https://sub2.neurix.cn` 声明使用 OpenAI Responses 的 `codex-relay` 路由，其中 GPT-5.6 Sol 和 GPT-5.6 Terra 两个模型都接受文本和图片输入。Web 打包脚本会把模板复制到发布包根目录，并包含安装辅助脚本。发布包的 `install.mjs` 在运行时依赖准备完成后使用独占创建，为 `$DSH_HOME/settings.yaml` 创建模板文件；已有文件（包括空文件）都会保留。更新器会把辅助脚本和模板与其他稳定运行时文件一起同步，用户设置仍保存在归档之外。模板只包含 `CODEX_RELAY_API_KEY` 引用；凭据值通过 Models 页面、环境变量或托管凭据存储提供。

## Alternatives considered

**只在组合配置中放置该路由。** 不采用，因为路由和模型目录属于必须可编辑的部署设置，不应要求重新构建运行时或修改插件组合。

**每次安装或更新都复制模板。** 不采用，因为更新绝不能替换用户设置文件，空文件也可能是用户有意保留的选择。

**在发布包中携带真实 API 密钥。** 不采用，因为发布归档是可分发产物，凭据应属于用户的凭据存储或环境。

## Consequences

新的 Web 运行时安装会得到可直接查看的模型配置，设置所引用的凭据后即可鉴权。已有部署在安装和更新期间保留自己的设置。该模板明确针对本仓库的 Codex 中转站路由，使用其他地址或模型的部署可以编辑或替换生成的设置文件。

## Verification

设置模板测试会解析 YAML，检查路由、两个模型的输入模态以及不存在凭据值。安装器测试覆盖首次创建、重复安装和保留已有空文件。
