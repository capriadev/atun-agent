# Current Task

## Active Task

Close the `2.2.0` release line and document the fastest local debug workflow for the extension host.

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
- keep the release line aligned with the real feature set instead of leaving the redesign under `2.1.1`
- document both debug entry points:
  - `F5` / `Run Extension`
  - direct CLI launch with `code --extensionDevelopmentPath`

Why:
- the packaged artifact and manifest must reflect the actual shipped redesign
- extension work is much faster when the Extension Development Host flow is explicit and checked into the repo

## Logical Next Step

Current execution order:

1. wire real behavior for history, ghost chat, access mode and agent mode
2. decide which controls move from the webview into native `QuickPick` or `TreeView`
3. review the debug loop after using the new `Run Extension` config in practice

## Session Close Note

This session closed version `2.2.0` and added a checked-in extension-host debug workflow.
