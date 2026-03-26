# Current Task

## Active Task

Fix the next round of integration issues in the sidebar: keep native toolbar icons theme-correct and remove page-level scrolling so only the chat history scrolls.

## What Was Being Worked On Before This

The last completed feature work was release `2.1.1`:

- broken keyboard shortcuts were removed
- native `view/title` actions were added beside the view fullscreen control
- new toolbar icons were wired into the extension manifest
- extra SVG assets were added for current and future UI work

## Last Thing Modified

The latest completed release changes are:

- version numbers were bumped to `2.2.0`
- changelog and README were updated for the redesigned shell
- `.vscode/launch.json` and `.vscode/tasks.json` were added for `F5` / `Run Extension`
- compile and local VSIX packaging passed for `2.2.0`

## Decision Made And Why

Decision:
- persist the workflow rule that every change lands as its own commit
- fix the next UI pass in small recoverable steps:
  - toolbar icon rendering
  - page-level scrolling/layout compaction

Why:
- the project is being tuned visually and benefits from frequent rollback points
- the current shell still has integration regressions that break the native feel

## Logical Next Step

Current execution order:

1. wire real behavior for history, ghost chat, access mode and agent mode
2. decide which controls move from the webview into native `QuickPick` or `TreeView`
3. review the debug loop after using the new `Run Extension` config in practice

## Session Close Note

This session closed version `2.2.0` and added a checked-in extension-host debug workflow.
