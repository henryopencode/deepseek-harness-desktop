# Agent Note: Keep the desktop status page within its viewport

Status: implemented
Archived: 2026-08-30

English | [中文](2026-08-27-viewport-bound-desktop-status-page.zh.md)

## Problem

The desktop shell status document gave only its `main` element a `100vh` height. The document root retained browser default margins, making the total document taller than the BrowserWindow viewport and showing an unnecessary vertical scrollbar during startup.

## Decision

The inline status document resets `html` and `body` dimensions and margins, hides document overflow, and sizes the centered `main` element to the complete viewport with border-box padding. Status text remains constrained to its existing readable width without requiring page scrolling.

## Alternatives considered

- **Hide the scrollbar only on `main`.** Rejected because the overflow belongs to the document root created by body margins; styling only the child leaves the excess document height intact.
- **Allow scrolling for every status page.** Rejected because startup and ordinary failure messages are short, and a scrollbar communicates a nonexistent extra screen of content.

## Consequences

- Startup and failure status pages fill the BrowserWindow without a vertical scrollbar.
- Extremely long diagnostics wrap within the viewport rather than expanding the status page beyond it.
