# Current Task

## Active Task

Redesign the extension UI toward a more editor-native minimal shell, using VS Code theme token mapping and a single grouped model selector that combines provider type, provider name and models.

## What Was Being Worked On Before This

The last completed feature work was release `2.1.1`:

- broken keyboard shortcuts were removed
- native `view/title` actions were added beside the view fullscreen control
- new toolbar icons were wired into the extension manifest
- extra SVG assets were added for current and future UI work

## Last Thing Modified

The latest completed repo-level changes before this task were:

- baseline `.context/` workflow committed
- the repository was left clean before beginning this redesign

## Decision Made And Why

Decision:
- keep the current extension architecture
- push the UI toward a more native/editor-like feel by combining:
  - native VS Code surfaces where possible
  - webview only for isolated chat and complex UI
- remove the separate provider selector from the chat surface and replace it with one grouped model selector

Why:
- this matches the intended architecture used by agent-style extensions
- it reduces duplicated selectors in the current chat shell
- it keeps the provider/runtime backend intact while allowing a major UI redesign

## Logical Next Step

Current execution order:

1. prepare state and contracts for unified provider-model selection
2. redesign the webview with VS Code token mapping and the new minimal layout
3. validate and package each stage with recoverable commits

## Session Close Note

This session focus is the native/editor-integrated redesign with small commits after each safe stage.
