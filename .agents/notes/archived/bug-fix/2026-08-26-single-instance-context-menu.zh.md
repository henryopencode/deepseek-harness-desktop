# Agent Note: 复用桌面窗口并提供编辑右键菜单

Status: implemented
Archived: 2026-08-30

[English](2026-08-26-single-instance-context-menu.md) | 中文

## Problem

再次点击桌面快捷方式会创建另一个 Electron 窗口，尽管产品只拥有一个本地 Harness 会话。Electron 也没有为 Web 编辑器提供编辑右键菜单，因此用户无法使用右键粘贴、复制或全选。

## Decision

桌面外壳在创建窗口前获取 Electron 的单实例锁。再次启动会向首个进程发送 `second-instance` 事件，由首个进程恢复、显示并聚焦已有窗口。macOS 激活已有窗口时也会聚焦该窗口。

外壳处理 WebContents 的右键菜单事件，并根据目标元素的编辑能力构建应用菜单。可编辑目标会提供可用的撤销、重做、剪切、复制、粘贴和全选命令；不可编辑但选中的文本会提供复制；链接会提供在外部浏览器打开的操作。菜单动作调用所属 WebContents 的编辑方法，因此 Windows 和 macOS 共用同一行为。

## Alternatives considered

- **让每个快捷方式都创建独立 BrowserWindow。** 未采用，因为每个窗口都会启动或连接同一个本地 Harness 服务，而产品没有并行外壳的使用场景。
- **只在 Web 编辑器内部实现复制和粘贴按钮。** 未采用，因为这只能覆盖一个渲染器组件，不能恢复其他可编辑 Web 控件的标准编辑行为。
- **依赖操作系统提供 Electron 默认右键菜单。** 未采用，因为打包外壳在支持的桌面平台上并不稳定地提供该菜单；显式菜单能统一标签和能力判断。

## Consequences

- 重复启动桌面应用会复用一个窗口，不会再启动另一个 Harness 进程。
- Chromium 报告某项操作可用的地方都能使用右键编辑。
- 右键菜单仍由能力驱动：不可用操作不会出现，外部链接继续在系统浏览器中打开。
