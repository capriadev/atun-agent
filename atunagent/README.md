# Atun Agent

Atun Agent is a **local-first VS Code agent sidebar** with Groq connectivity, SQLite persistence and a minimal native chat bridge.

Repo: https://github.com/capriadev/atun-agent

## What it does

- Local sidebar onboarding to connect providers
- Groq API configuration with model discovery
- SQLite persistence for local connections, sessions and messages
- SecretStorage for API keys
- Simple local chat with selectable model and streaming responses
- Native `@atun` bridge that points setup back to the sidebar when needed
- Native view-title toolbar actions in the editor header for settings, history, new chat and ghost chat

## Quick start

Requirements:

- VS Code `1.110+`
- Internet access to validate Groq and send chat requests
- A Groq API key

1. Open Atun Agent from the activity bar or run `Atun Agent: Open Chat`
2. Click `Anadir API / API Connect`
3. Choose `Groq`
4. Enter a display name and your API key
5. Wait for the available models to load
6. Enable at least one model and click `Aceptar`
7. Start chatting from the sidebar

## Commands

- `Atun Agent: Open Chat`
- `Atun Agent: Focus Sidebar`
- `Atun Agent: Stop Response`
- `Atun Agent: Add Context Files`
- `Atun Agent: Create File`
- `Atun Agent: Delete File`
- `Atun Agent: Run Terminal Command`

Note:

- Default keyboard shortcuts were removed in `2.1.1` because they were not behaving reliably.

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

### Debug extension host

Fastest local workflow inside VS Code:

1. Open the repo root in VS Code.
2. Start the `Run Extension` launch config with `F5`.
3. A new Extension Development Host window opens with Atun Agent loaded.

If you prefer command line only, first build the extension:

```bash
npm run compile
```

Then open an Extension Development Host from the repo root:

```powershell
code --new-window --extensionDevelopmentPath "$PWD/atunagent"
```

Or launch the debug session from VS Code with the `Run Extension` configuration.

Notes:

- `Ctrl+Shift+F5` restarts the Extension Development Host.
- The launch config uses the repo task `npm: watch` so code rebuilds while you edit.
- Breakpoints go in files such as `src/extension.ts`, `src/chat-view.ts` and `src/sidebar-view-model.ts`.

## Troubleshooting

- If the sidebar does not list Groq models, verify the API key and confirm the editor can reach `https://api.groq.com`.
- If native `@atun` opens but tells you to finish setup in the sidebar, that is expected in this release.
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
