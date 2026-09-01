# Agent Note: 选择性开放远程 Web 运行时安装

Status: implemented

[English](2026-08-31-remote-web-runtime-update.md) | 中文

## Problem

通过服务器地址访问 Web 运行时的浏览器页面可以知道有新的受管软件包，但如果安装只能来自回环地址，管理员每次确认更新都必须离开页面改用 SSH；如果允许所有非回环请求启动更新器，又会把宿主进程替换能力暴露给任何能访问端口的人。浏览器信任栅栏只识别服务权威，刻意不承担鉴权。

## Decision

`host.updateCheck` 返回可选的 `installAvailable` 标志。只有在 `allowRemoteUpdate` 为 true 且 `webRuntimeRoot` 下存在受管 `update.mjs` 时，`ApiProxyService` 才会将该标志设为 true。Web 组合把 `DSH_WEB_ALLOW_REMOTE_UPDATE=1` 映射到这一配置；默认值为 false。

连接层 node 半侧仍把 `host.updateInstall` 放在特权方法集合中。开启选择性权限后，只有回环请求或权威列在 `trustedHosts` 中的请求可以通过这一个方法的信任栅栏；其他特权方法仍要求回环地址。部署必须在开启该配置前通过反向代理或其他外层提供鉴权。更新器路径仍从配置的运行时根目录解析，绝不接受浏览器输入；现有更新器继续在替换并重启服务前校验下载的软件包。

浏览器更新提示同时使用 `installAvailable` 与本地回环状态：回环页面以及声明该能力的已鉴权远程部署显示“立即更新”，其他情况提示服务器管理员通过部署管理路径更新。

## Verification

连接层测试证明默认配置会拒绝来自已声明非回环权威的 `host.updateInstall` 请求，开启配置后只在 RPC 分发前放行该权威。API 网关测试执行临时的受管更新检查脚本，分别断言两种配置下的 `installAvailable` 值。浏览器测试覆盖显式开启与关闭远程能力的状态，包括安装按钮和状态提示。

## Alternatives considered

**保持远程安装只能使用 SSH。** 这会保留最小的远程攻击面，但浏览器只能提示检查结果，每次发布都需要额外的管理步骤。

**在连接层加入鉴权。** 这会把部署身份、会话和凭据策略复制进目前只提供 Host/Origin 可达性检查的传输包。鉴权仍属于部署，选择性开关只有在外层鉴权存在时才安全。

**允许所有受信任 Host 安装。** 这会把服务权威声明变成进程管理授权，也会放大笔误或过宽 allowlist 的风险。显式开关和单一方法例外让默认值及其他特权 API 保持不变。

## Consequences

部署显式开启该能力且外层鉴权保护路由后，远程用户可以在同一页面确认更新并等待受管 Web 运行时重启。不启用的部署继续使用原来的 SSH 安装流程，同时仍能收到更新可用状态。运维人员必须只在 `trustedHosts` 权威正确且反向代理完成鉴权时设置 `DSH_WEB_ALLOW_REMOTE_UPDATE=1`；连接层无法自行执行这项外部身份校验。
