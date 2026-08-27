# Agent Note：带官方镜像分支的独立桌面产品仓库

Status: implemented

[English](2026-08-27-independent-desktop-repository.md) | 中文

## 问题

定制版桌面应用原来位于 GitHub Fork 中，产品分支和官方仓库通过 Fork 身份耦合在一起，导致产品发布资产、分支历史和官方同步意图不清晰。

## 决策

产品维护在独立的公开仓库 [`henryopencode/deepseek-harness-desktop`](https://github.com/henryopencode/deepseek-harness-desktop) 中。`master` 保存定制版桌面产品和发布配置；`official` 镜像 `deepseek-ai/deepseek-harness:master`，从 `upstream` 远程刷新，不直接在该分支编辑。本地 `origin` 指向独立仓库，`upstream` 指向官方仓库，`legacy-fork` 保留为旧 Fork 的参考。

同步和打包流程写在[桌面仓库说明](../../../../DESKTOP_REPOSITORY.md)中。官方改动先抓取到 `official`，经过检查后合并到 `master`，再测试并推送到 `origin/master`。桌面发布资产必须在目标操作系统上构建，并通过针对性的包检查、构建和文档检查后才能发布。

## 曾考虑的替代方案

**继续把现有 Fork 作为产品仓库。** 否决，因为 GitHub 会把 Fork 关系显示为仓库身份；即使重命名本地远程，发布和分支维护仍混合在官方所有权语义中。

**只复制源码到新仓库，不建立官方分支。** 否决，因为以后同步官方更新只能临时比较或重新克隆，缺少记录确切官方源码状态的长期分支。

**自动把官方更新合并到 `master`。** 否决，因为桌面打包、原生 runtime 和产品 UI 改动需要在成为发布候选前完成冲突审查和平台检查。

## 后果

产品仓库拥有明确的官方同步点和稳定的发布资产位置。更新 `official` 使用带租约保护的镜像推送，产品工作继续作为 `master` 上的普通提交。独立仓库不会自动接收官方更新；维护者需要按文档执行抓取、审查、合并和验证流程。
