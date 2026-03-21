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

Requirements:

- VS Code `1.110+`
- Native Chat enabled in the editor host
- A compatible chat model provider available in VS Code Chat

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

## Troubleshooting

- If the sidebar opens but native agent mode is unavailable, the editor host is missing the VS Code Chat API, the Language Model API, or a compatible chat model provider.
- If installation shows `Oracle Java SE Language Server exited with 10`, that message is unrelated to this TypeScript extension and usually comes from another installed Java extension.

## Local VSIX packaging

From repository root:

```bash
npm run package:local
```

Output:

```text
packages/v{version}/atun-agent-{version}.vsix
```
