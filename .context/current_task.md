# Current Task

## Active Task

Close the `2.2.4` patch release after patching stale retained webviews in the sidebar.

## What Was Being Worked On Before This

The last completed feature work was release `2.1.1`:

- broken keyboard shortcuts were removed
- native `view/title` actions were added beside the view fullscreen control
- new toolbar icons were wired into the extension manifest
- extra SVG assets were added for current and future UI work

## Last Thing Modified

The latest completed code changes are:

- retained sidebar webview context was disabled to avoid mismatches between old HTML and new host code
- the webview HTML is re-rendered when the sidebar becomes visible again
- the patch targets the “click does nothing” onboarding failure mode reported during testing

## Decision Made And Why

Decision:
- treat the reported no-op onboarding button as likely stale webview state and patch the lifecycle accordingly
- cut another patch release because this affects basic usability of the extension

Why:
- the installable artifact must match the latest safe fixes
- debugging startup and theme regressions is easier when each fix has its own rollback point

## Logical Next Step

Current execution order:

1. wire real behavior for history, ghost chat, access mode and agent mode
2. decide which controls move from the webview into native `QuickPick` or `TreeView`
3. review the debug loop after using the new `Run Extension` config in practice

## Session Close Note

This session closed version `2.2.0` and added a checked-in extension-host debug workflow.
