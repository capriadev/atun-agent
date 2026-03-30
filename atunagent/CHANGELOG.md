# Changelog

All notable changes to **Atun Agent** will be documented in this file.

## [2.3.2] - 2026-03-29

### Changed
- Redesigned the sidebar chat shell into a denser, more minimal layout.
- Reorganized the composer into:
  - top action row
  - middle auto-growing input area
  - bottom selector row with context usage on the right
- The input now starts at four lines, auto-grows up to ten lines, supports manual resize, and the expand control toggles compact/expanded behavior with a double-click min/max shortcut.

## [2.3.1] - 2026-03-28

### Added
- Fast UI iteration workflow for the sidebar webview:
  - static `assets/webview/chat-shell.css`
  - static `assets/webview/chat-shell.js`
  - `Atun Agent: Reload Sidebar Webview`
  - `Atun Agent: Open Webview DevTools`

### Changed
- `chat-shell-html.ts` now focuses on HTML structure and links external webview assets instead of embedding large inline CSS and client script blocks.

## [2.3.0] - 2026-03-28

### Changed
- Reorganized the extension into domain-oriented modules for long-term scale:
  - `src/core`
  - `src/storage`
  - `src/providers`
  - `src/sidebar`
  - `src/bootstrap`
  - `src/commands`
- Split the sidebar webview layer into a dedicated provider, typed webview protocol and isolated HTML template module.
- Reduced `extension.ts` to a thin activation entrypoint that composes services and command registration.

## [2.2.5] - 2026-03-27

### Changed
- Removed the standalone onboarding, provider picker and provider configuration pages from the sidebar webview.
- Kept the product on a single persistent chat surface and moved provider setup into an inline panel inside that chat shell.

## [2.2.4] - 2026-03-27

### Fixed
- Disabled retained webview context for the sidebar so updated builds do not keep an older disconnected onboarding UI alive.
- Re-render the sidebar HTML when the view becomes visible again, reducing stale webview state after reloads and upgrades.

## [2.2.3] - 2026-03-27

### Fixed
- Added a stronger onboarding recovery path so the primary button rehydrates persisted chat state when provider data already exists.
- Tightened the onboarding theme mapping so text, logo, borders and decorative surfaces derive more consistently from VS Code theme tokens.

## [2.2.2] - 2026-03-27

### Fixed
- Restored the persisted sidebar state more defensively so existing provider data no longer leaves the UI stuck on onboarding.
- Removed remaining onboarding visual mismatches by making the logo and decorative shell colors follow VS Code theme-driven variables.

## [2.2.1] - 2026-03-26

### Fixed
- Switched native view-title toolbar icons to explicit light/dark assets so they render correctly across VS Code themes.
- Removed page-level sidebar scrolling so the chat shell keeps scrolling localized to the message history and internal lists.

## [2.2.0] - 2026-03-26

### Changed
- Redesigned the sidebar into a more editor-native shell driven by mapped VS Code theme tokens.
- Replaced the separate provider/model chat selectors with a single grouped model selector by provider connection.
- The native settings title action now opens the provider setup flow directly.

### Added
- Composer shell inspired by integrated agent extensions:
  - expandable input
  - token estimate
  - context usage indicator
  - inline `#`, `/` and `@` prompt actions
- Local debug workflow documentation in the README.
- Workspace debug configuration to launch the extension with `F5`.

## [2.1.1] - 2026-03-26

### Changed
- Removed the broken default keyboard shortcuts for opening Atun Agent.
- Added native view-title actions next to the sidebar fullscreen control:
  - settings
  - history
  - new chat
  - ghost chat

### Added
- Toolbar command stubs for settings, history and ghost chat.
- Toolbar-driven new chat action wired to the current sidebar flow.

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
