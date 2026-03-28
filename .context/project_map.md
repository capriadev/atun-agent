# Project Map

## Purpose

Atun Agent is a VS Code extension focused on a local-first agent workflow:

- custom sidebar experience as the primary UI
- local SQLite-backed persistence for providers, sessions and messages
- provider-based chat runtime, starting with Groq
- native editor integration where it adds value, without depending on it as the main product surface

The current goal is to keep moving from a webview-only prototype toward something that feels more editor-native, similar in behavior and placement to other AI extensions.

## Architecture

There are two layers:

1. Extension host layer
- activates the extension
- initializes persistence and services
- registers commands and native view-title actions
- owns the webview bridge
- exposes a minimal `@atun` native chat participant as a secondary surface

2. Sidebar/webview layer
- renders onboarding, provider setup and chat UI
- sends user actions back to the extension host
- receives serialized state from the extension host

## Main Components

### Entry and orchestration
- `atunagent/src/extension.ts`
  - extension activation
  - service construction
  - command registration
  - sidebar provider registration

### Sidebar UI
- `atunagent/src/chat-view.ts`
  - webview HTML, CSS and client-side message bridge
  - screen flow: onboarding, provider picker, provider config, chat
  - native-themed shell built from local `--atun-*` variables mapped to `--vscode-*`
  - grouped model selector by provider connection inside the chat footer

- `atunagent/src/sidebar-view-model.ts`
  - main state coordinator for the sidebar
  - loads state from persistence
  - validates provider drafts
  - creates chats and sends messages

### Persistence and secrets
- `atunagent/src/local-database.ts`
  - local SQLite wrapper using `sql.js`
  - schema for settings, connections, models, sessions and messages

- `atunagent/src/secrets-service.ts`
  - stores API keys in VS Code `SecretStorage`

### Provider backend
- `atunagent/src/provider-registry.ts`
  - provider-agnostic contract for validation, model listing and chat streaming

- `atunagent/src/groq-provider.ts`
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

Current chat shell behavior:

- onboarding handles first provider connection
- provider configuration remains a webview flow
- active chat uses one grouped model selector instead of separate provider/model dropdowns
- provider management entry now also exists through the native settings title action

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
- current shipped line: `2.2.4`

## Local Debug Workflow

- `.vscode/launch.json`
  - `Run Extension` launches an Extension Development Host against `atunagent/`

- `.vscode/tasks.json`
  - background `npm: watch` task feeds the extension debug loop used by `F5`

## Vision

The codebase is evolving in this order:

1. stable local-first sidebar
2. provider runtime and persistence
3. stronger editor-native integration
4. more providers and richer chat/session features

The project should feel like an integrated editor extension, but the backend logic must remain decoupled from the webview and from VS Code-native chat APIs.
