# Error DB

## 1. SQLite runtime missing from packaged VSIX

### What happened

The extension built locally, but the packaged VSIX did not include the SQLite WASM runtime required by `sql.js`.

### Cause

The SQLite runtime was being resolved from dependency/runtime paths that were not guaranteed to be present inside the packaged extension output.

### Fix

- bundled the runtime file into `atunagent/assets/vendor/sql-wasm.wasm`
- resolved SQLite from the extension's own `assets/vendor/` path
- verified the packaged VSIX includes the vendor asset

### Rule

If the extension depends on runtime assets such as WASM files, package them explicitly under tracked extension assets instead of assuming dependency folders will be shipped.

---

## 2. `vscode-test` blocked by local VS Code update state

### What happened

`npm test` failed with:

- `Code is currently being updated. Please wait for the update to complete before launching.`

### Cause

The local `.vscode-test` cache/downloaded VS Code build entered an update-locked state unrelated to extension code correctness.

### Fix

No reliable repo-side fix was applied yet. Re-downloading the test runtime did not consistently resolve the issue.

### Rule

When `vscode-test` fails due update/cache state, do not treat it as an extension code regression by default. Record the harness failure separately and rely on compile/package validation until the local test runtime is stable again.

---

## 3. Broken default shortcuts

### What happened

The default keyboard shortcuts for opening Atun Agent were not behaving reliably.

### Cause

The shortcut setup was not dependable enough for the current extension flow and produced a poor default experience.

### Fix

- removed the shipped default keybindings
- kept command-based access and native title-bar actions instead

### Rule

Do not ship default keybindings unless they are verified to work consistently in the real extension workflow.

---

## 4. Webview text encoding regression

### What happened

One onboarding label rendered as mojibake (`AÃ±adir`) inside the webview.

### Cause

A text replacement touched encoded content inside the HTML template string and corrupted the label.

### Fix

- corrected the onboarding button label back to ASCII-safe text

### Rule

Prefer ASCII-safe UI strings in the inline webview template unless the file encoding is tightly controlled end-to-end.
