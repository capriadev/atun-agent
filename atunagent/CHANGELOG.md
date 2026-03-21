# Changelog

All notable changes to **Atun Agent** will be documented in this file.

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