# Current Task

## Active Task

Persist the release workflow rule in `.context/` and cut the next packaged version after the latest sidebar fixes.

## What Was Being Worked On Before This

The last completed feature work was release `2.1.1`:

- broken keyboard shortcuts were removed
- native `view/title` actions were added beside the view fullscreen control
- new toolbar icons were wired into the extension manifest
- extra SVG assets were added for current and future UI work

## Last Thing Modified

The latest completed code changes are:

- native toolbar icons were switched to theme-aware light/dark assets
- page-level scrolling was removed so the chat shell owns scrolling
- each of those changes landed in its own commit

## Decision Made And Why

Decision:
- persist one more workflow rule: a finished change set should end with the next packaged release ready
- cut a patch release because the last completed work changed user-visible behavior but did not bump the shipped version

Why:
- the repo is being used iteratively and the installable artifact should stay synchronized with the latest safe state
- the icon and layout fixes are user-facing and belong in the next packaged build

## Logical Next Step

Current execution order:

1. wire real behavior for history, ghost chat, access mode and agent mode
2. decide which controls move from the webview into native `QuickPick` or `TreeView`
3. review the debug loop after using the new `Run Extension` config in practice

## Session Close Note

This session closed version `2.2.0` and added a checked-in extension-host debug workflow.
