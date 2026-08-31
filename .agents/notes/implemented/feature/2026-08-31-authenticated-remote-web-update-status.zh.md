# Agent Note: 需要鉴权的远程 Web 部署

Status: implemented

[English](2026-08-31-authenticated-remote-web-update-status.md) | 中文

## Problem

浏览器 Web 运行时需要受保护的公网入口和用于麦克风录音的安全上下文。远程浏览器还需要看到发布状态，但不能被允许重启服务器。

## Decision

远程部署在 Harness Web 服务器前放置 Nginx。Nginx 终止 HTTPS，并对 SPA、HTTP API 和 WebSocket upgrade 应用 Basic Auth。Harness 进程只监听 `127.0.0.1`，应用端口不会直接暴露。

浏览器更新插件会在本机页面和完成鉴权的远程页面于 shell 挂载时调用 `host.updateCheck`，并在页面保持打开时每五分钟重新检查。用户选择“稍后”后，页面会忽略该发布版本；只有出现更晚的版本时才会再次显示提示。`host.updateInstall` 在 Connection 请求栅栏处保持仅回环可用；远程页面显示可用版本并提示通过 SSH 更新服务器。限制在 API 分发前执行，因此隐藏按钮不是安全控制。

使用 IP 部署时，可以使用带 IP Subject Alternative Name 的自签名证书。浏览器需要操作员信任该证书后才会授予麦克风权限；受公共信任的证书需要域名或隧道。

## Consequences

通过鉴权的远程用户可以使用浏览器麦克风录音并收到更新提示。服务器升级仍由 SSH 完成，保留服务所有权，避免浏览器触发进程替换。IP 证书在每台客户端首次访问时会显示浏览器警告，直到该客户端信任证书。

## Alternatives considered

**直接暴露 Harness 端口。** 这样 API 和 WebSocket 端点没有统一的鉴权与 TLS 策略，应用端口也会成为公网攻击面。

**只使用带 Basic Auth 的 HTTP。** 鉴权可以保护入口，但对于公网 IP，浏览器仍会把麦克风录音视为不安全上下文，语音输入依然不可用。

**允许远程调用 `host.updateInstall`。** 由浏览器触发进程替换会让公网客户端拥有服务器生命周期权限，并可能中断活动会话，因此远程部署仍通过 SSH 更新。

## Verification

Connection node-half 测试断言：即使声明了远程 authority，`host.updateInstall` 也会被拒绝，而普通 API 请求仍会进入 bridge。部署验证覆盖 Nginx 鉴权、TLS、WebSocket 转发和浏览器安全上下文要求。
