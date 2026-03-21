# Changelog

All notable changes to **Atun Agent** will be documented in this file.

## [1.1.2] - 2026-03-21

### Fixed
- `Atun Agent: Open Chat` now opens via robust multi-command fallback (`openView` + container fallback) to avoid `command ... not found` errors.
- Added safer error handling when focusing sidebar.

### Added
- Extra keybinding fallback for opening chat:
  - `Ctrl+Alt+A` (Windows/Linux), `Cmd+Alt+A` (macOS).
- New setting: `atunAgent.autoRevealOnStartup`.

### Changed
- Sidebar icon switched to a higher-contrast asset (`ghost-chat.svg`) for better visibility.
- Extension description improved to better reflect real capabilities.
- Documentation expanded with troubleshooting and clearer feature overview.

## [1.1.1] - 2026-03-21

### Added
- Extension metadata for repo/local distribution:
  - `publisher`, `author`, `license`, `repository`, `homepage`, `bugs`, `keywords`.
- Root packaging script: `npm run package:local`.
- Versioned VSIX output automation:
  - `scripts/package-vsix.mjs`
  - output to `packages/v{version}/atun-agent-{version}.vsix`.

### Changed
- Updated root README with simple local install/package flow.
- Updated workspace wrapper package scripts for local packaging flow.

## [1.1.0] - 2026-03-21

### Added
- New sidebar chat UI (`WebviewView`) with conversation area and bottom composer.
- Input actions: `# files`, `/skills`, `play/pause`.
- Bottom selectors: access mode, agent mode, model, thinking level.
- Token counter using model tokenizer (`model.countTokens`) for:
  - prompt input
  - attached files
  - project snapshot
  - attached images (descriptor-based estimate)

### Changed
- Replaced tree-style options list with real chat-agent experience.
- Updated shortcut and command flow to focus/open chat experience (`Ctrl+Shift+A`).
- Updated docs and workspace wrapper metadata to current product naming.

### Removed
- Legacy participant/tree-list implementation files.

## [1.0.0] - 2026-03-21

### Added
- Initial Atun Agent release structure.
