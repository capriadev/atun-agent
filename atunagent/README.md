# Atun Agent

Atun Agent is a **native VS Code chat participant** (`@atun`) with a minimal sidebar launcher.

Repo: https://github.com/capriadev/atun-agent

## What it does

- Native chat integration via VS Code Chat (`@atun`)
- Minimal shell view in sidebar for quick actions and state
- Workspace tools from chat with explicit confirmation:
  - list/read/create/update/delete files
  - run integrated terminal commands
- Access modes:
  - `isolated`: blocks mutating actions
  - `full`: enables mutating actions after confirmation

## Quick start

- Open chat: `Ctrl+Alt+A` (primary), `Ctrl+Shift+A` (secondary)
- In chat, use `@atun`
- Slash commands:
  - `/list`
  - `/read`
  - `/create`
  - `/update`
  - `/delete`
  - `/terminal`

Examples:

```text
@atun /list src/**/*
@atun /read README.md
@atun /create src/new-file.ts
```

```ts
export const ok = true;
```

```text
@atun /terminal npm test
```

## Commands

- `Atun Agent: Open Chat`
- `Atun Agent: Focus Sidebar`
- `Atun Agent: Stop Response`
- `Atun Agent: Add Context Files`
- `Atun Agent: Create File`
- `Atun Agent: Delete File`
- `Atun Agent: Run Terminal Command`

## Configuration

- `atunAgent.accessMode`: `isolated` | `full`
- `atunAgent.agentMode`: `ask` | `plan` | `git` | `docs`
- `atunAgent.preferSecondarySideBar`: prefer secondary sidebar
- `atunAgent.autoRevealOnStartup`: auto-open sidebar on first activation
- `atunAgent.workspace.requireConfirm`: require explicit confirmation
- `atunAgent.workspace.deleteMode`: `trash`

## Development

```bash
npm install
npm run compile
npm test
```

## Local VSIX packaging

From repository root:

```bash
npm run package:local
```

Output:

```text
packages/v{version}/atun-agent-{version}.vsix
```
