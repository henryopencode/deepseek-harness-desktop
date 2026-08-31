# Agent Note: Reuse the desktop window and expose edit context menus

Status: implemented
Archived: 2026-08-30

English | [中文](2026-08-26-single-instance-context-menu.zh.md)

## Problem

Launching a second desktop shortcut created another Electron window even though the product owns one local Harness session. Electron also did not provide an edit context menu for the Web composer, so users could not use right-click paste, copy, or select-all actions.

## Decision

The desktop shell acquires Electron's single-instance lock before creating its window. A second launch sends the `second-instance` event to the first process, which restores, shows, and focuses the existing window. macOS activation also focuses that window when it already exists.

The shell handles WebContents context-menu events and builds an application menu from the target's edit capabilities. Editable targets expose available undo, redo, cut, copy, paste, and select-all commands; selected non-editable text exposes copy; links expose an external-browser action. Menu actions call the owning WebContents edit methods, so behavior is shared by Windows and macOS.

## Alternatives considered

- **Let each shortcut create a separate BrowserWindow.** Rejected because every window would start or attach to the same local Harness service without a product use case for parallel shells.
- **Implement copy and paste controls inside the Web composer.** Rejected because it would cover only one renderer component and would not restore standard editing behavior for other editable Web controls.
- **Rely on the operating system's default Electron context menu.** Rejected because the packaged shell does not expose one consistently across the supported desktop platforms; an explicit menu owns the same labels and capability checks everywhere.

## Consequences

- Repeated desktop launches reuse one window and do not start another Harness process.
- Right-click editing is available wherever Chromium reports the corresponding operation as allowed.
- The context menu remains capability-driven: unavailable operations are omitted, and external links continue to open in the system browser.
