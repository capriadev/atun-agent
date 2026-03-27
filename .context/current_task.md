# Current Task

## Active Task

Close the `2.2.3` patch release after fixing the onboarding action bridge and improving theme-driven onboarding visuals.

## What Was Being Worked On Before This

The last completed feature work was release `2.1.1`:

- broken keyboard shortcuts were removed
- native `view/title` actions were added beside the view fullscreen control
- new toolbar icons were wired into the extension manifest
- extra SVG assets were added for current and future UI work

## Last Thing Modified

The latest completed code changes are:

- the onboarding CTA now recovers persisted chat state if the view lands on the login screen by mistake
- the onboarding shell now maps text, logo, borders and decoration more directly from VS Code theme tokens
- both fixes landed in separate commits before packaging

## Decision Made And Why

Decision:
- cut another patch release because the latest fixes are user-visible and affect startup and setup reliability
- keep functional and visual fixes separated into independent commits before release

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
