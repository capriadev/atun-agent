# Project Map

## Purpose

Atun Agent is a VS Code extension focused on a local-first agent workflow:

- custom sidebar experience as the primary UI
- local SQLite-backed persistence for providers, sessions and messages
- provider-based chat runtime, starting with Groq
- native editor integration where it adds value, without depending on it as the main product surface

The current goal is to keep moving from a webview-heavy prototype toward a modular extension architecture that can absorb more providers, services and native integrations without centralizing everything in `extension.ts`.

## Architecture

There are two layers:

1. Extension host layer
- activates the extension
- composes bootstrap services
- registers commands and native view-title actions
- owns the webview bridge
- exposes a minimal `@atun` native chat participant as a secondary surface

2. Sidebar/webview layer
- renders a single chat surface with inline provider setup
- sends user actions back to the extension host
- receives serialized state from the extension host

## Main Components

### Entry and orchestration
- `atunagent/src/extension.ts`
  - thin activation entrypoint
  - composes bootstrap, commands and sidebar registration

- `atunagent/src/bootstrap/create-extension-services.ts`
  - builds long-lived services for the extension host
  - initializes persistence, providers and sidebar state

- `atunagent/src/commands/register-commands.ts`
  - owns command registration
  - owns sidebar focus/open helpers and first-activation reveal logic

### Shared contracts
- `atunagent/src/core/types.ts`
  - shared extension types used across state, providers, storage and sidebar modules

### Sidebar UI
- `atunagent/src/sidebar/sidebar-view-model.ts`
  - main state coordinator for the sidebar
  - loads state from persistence
  - validates provider drafts
  - creates chats and sends messages

- `atunagent/src/sidebar/atun-shell-view-provider.ts`
  - VS Code webview provider
  - bridge between host messages and sidebar view-model

- `atunagent/src/sidebar/webview/chat-shell-html.ts`
  - HTML structure for the chat shell

- `atunagent/assets/webview/chat-shell.css`
  - stylesheet loaded directly by the webview for fast visual iteration

- `atunagent/assets/webview/chat-shell.js`
  - client-side webview behavior loaded as a static asset for quick UI testing

- `atunagent/src/sidebar/webview/chat-shell-protocol.ts`
  - typed incoming messages from the webview to the host

### Persistence and secrets
- `atunagent/src/storage/local-database.ts`
  - local SQLite wrapper using `sql.js`
  - schema for settings, connections, models, sessions and messages

- `atunagent/src/storage/secrets-service.ts`
  - stores API keys in VS Code `SecretStorage`

### Provider backend
- `atunagent/src/providers/provider-registry.ts`
  - provider-agnostic contract for validation, model listing and chat streaming

- `atunagent/src/providers/groq-provider.ts`
  - Groq adapter
  - model discovery
  - streaming chat completions

### Native/editor integration
- `atunagent/src/chat-participant.ts`
  - minimal `@atun` bridge that redirects setup/use back to the sidebar

- `atunagent/src/host-support.ts`
  - detects whether the editor host exposes the native chat API

### Legacy/shared workspace tooling
- `atunagent/src/agent-state.ts`
- `atunagent/src/workspace-tools.ts`
  - still present for guarded workspace actions and command support
  - no longer define the primary chat experience

## UI Integration Model

Current integration points:

- activity bar container for Atun Agent
- webview view as the main product surface
- native `view/title` toolbar actions next to the editor's fullscreen control
- native command registrations
- native chat participant kept as a secondary bridge

Current chat shell behavior (v2.4.1):

- one persistent chat surface is always rendered
- first-time setup and provider management open inside the same chat surface
- active chat uses a native-styled `<select>` for the model selector (with `optgroup` per connection)
- access mode, agent mode and reasoning level use custom HTML selects with inline SVG icons and own dropdown
- the shell removes most inner card framing so the editor/sidebar background becomes the main surface
- the composer uses only a thin top separator and compact spacing so it reads like part of the editor instead of a nested panel
- a `:::` resize handle above the textarea supports drag-to-resize, double-click to expand/collapse, and single-click to contract when expanded
- manual resize and expand clamp against actual available panel height instead of only the default textarea row cap
- the context usage meter opens a persistent popup (click-toggle) showing tokens/256k, a progress bar and a compact action button
- all color tokens derive from `--vscode-*` variables mapped to `--atun-*` scoped vars
- SVGs for custom-select icons are injected inline into the HTML string to pass the webview CSP
- adaptive density classes progressively hide secondary labels and shrink control chrome as the sidebar narrows
- history/composer scrollbars stay visually hidden until hover or focus for a more native-feeling compact UI

The long-term direction is to increase native/editor-level integration while keeping the provider, persistence and chat runtime independent from any single VS Code API surface.

## Asset Structure

- `atunagent/assets/icons/`
  - UI and command icons
  - includes title-bar action icons such as:
    - `setting.svg`
    - `fishing-history.svg`
    - `new-chat.svg`
    - `ghost-chat.svg`

- `atunagent/assets/vendor/sql-wasm.wasm`
  - bundled SQLite WASM runtime required by `sql.js`

## Packaging

- root workspace wrapper drives build/package commands
- extension output is packaged as versioned VSIX files under `packages/`
- current shipped line: `2.4.1`

## Local Debug Workflow

- `.vscode/launch.json`
  - `Run Extension` launches an Extension Development Host against `atunagent/`

- `.vscode/tasks.json`
  - background `npm: watch` task feeds the extension debug loop used by `F5`

- command palette workflow for UI iteration:
  - `Atun Agent: Reload Sidebar Webview`
  - `Atun Agent: Open Webview DevTools`

## Vision

The codebase is evolving in this order:

1. stable local-first sidebar
2. provider runtime and persistence
3. stronger editor-native integration
4. more providers and richer chat/session features

The project should feel like an integrated editor extension, but the backend logic must remain decoupled from the webview and from VS Code-native chat APIs.
