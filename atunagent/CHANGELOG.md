# Changelog

All notable changes to **Atun Agent** will be documented in this file.

## [2.1.0] - 2026-03-21

### Added
- Local SQLite persistence for provider connections, enabled models, chat sessions and chat messages.
- SecretStorage-backed API key storage for provider credentials.
- Internal provider registry and first Groq adapter with model discovery plus streaming chat completions.
- New onboarding flow in the sidebar:
  - logo screen
  - provider picker
  - Groq configuration
  - local chat UI
- Local chat experience with connection selector, model selector, streaming responses and new-chat action.
- Automated test coverage for SQLite initialization and connection persistence.

### Changed
- Main UX now uses the sidebar chat as the primary surface instead of relying on native language model APIs.
- `Atun Agent: Open Chat` now focuses the Atun sidebar.
- Native `@atun` chat participant now acts as a lightweight bridge that redirects setup/use back to the sidebar.

## [2.0.1] - 2026-03-21

### Fixed
- Prevented extension activation from failing on editor hosts that do not expose the native VS Code Chat or Language Model APIs.
- Prevented the sidebar webview from rendering as an empty shell when chat models are unavailable or model discovery fails.

### Added
- Native host diagnostics in the sidebar for unsupported hosts and missing chat models.
- Clearer open-chat error message when native agent integration is not available.

## [2.0.0] - 2026-03-21

### Added
- Native chat participant `@atun` with slash commands:
  - `/list`, `/read`, `/create`, `/update`, `/delete`, `/terminal`
- Quick action commands:
  - `Atun Agent: Add Context Files`
  - `Atun Agent: Create File`
  - `Atun Agent: Delete File`
  - `Atun Agent: Run Terminal Command`
- Workspace operations module with guarded actions and access-mode checks.
- Package icon (`assets/icons/logo/atunagent-icon.png`) for extension details.

### Changed
- Main UX migrated from webview chat composer to native VS Code chat integration.
- Sidebar converted to minimal launcher/status shell.
- `Ctrl+Alt+A` is now the primary open-chat shortcut (`Ctrl+Shift+A` remains as fallback).
- Version bumped to `2.0.0`.

### Security
- Mutating operations (create/update/delete/terminal) require explicit confirmation by default.
- `isolated` mode blocks mutating operations.
- Delete strategy defaults to trash (`useTrash: true`).

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
