# Current Task

## Active Task

Consolidate the native-themed shell redesign and define the next native/editor integration steps on top of the new grouped model selector.

## What Was Being Worked On Before This

The last completed feature work was release `2.1.1`:

- broken keyboard shortcuts were removed
- native `view/title` actions were added beside the view fullscreen control
- new toolbar icons were wired into the extension manifest
- extra SVG assets were added for current and future UI work

## Last Thing Modified

The latest completed feature changes are:

- the sidebar webview was redesigned into a minimal chat shell driven by mapped `--vscode-*` tokens
- provider and model selection were unified into a single grouped model selector
- the native settings title action now opens the provider setup flow instead of being a stub
- compile and local VSIX packaging passed after the redesign

## Decision Made And Why

Decision:
- keep the current extension architecture
- treat the webview as a native-looking shell instead of a custom app panel
- map theme usage through local `--atun-*` variables backed by `--vscode-*`
- remove the separate provider selector from chat and keep model switching grouped by provider connection
- use the native title action for provider management entry instead of another HTML toolbar button

Why:
- this matches the intended architecture used by agent-style extensions
- it reduces duplicated selectors in the chat shell
- it keeps the provider/runtime backend intact while allowing a major UI redesign
- it makes the UI less visually isolated from the editor theme

## Logical Next Step

Current execution order:

1. wire real behavior for the remaining native/editor actions: history, ghost chat, access mode and agent mode
2. decide which controls stay in webview and which move to native `QuickPick` or `TreeView`
3. refine the grouped model selector and message history interactions after visual review

## Session Close Note

This session completed the first native-themed shell pass with recoverable commits and successful packaging.
