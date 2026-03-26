# Working Rules

## Source Of Truth

- Read all files in `.context/` at the start of every session before making changes.
- Treat `.context/` as persistent project memory, not as optional notes.
- Update `current_task.md` whenever the active focus changes.
- Update `project_map.md` when architecture or structure changes in a meaningful way.
- Update `error_db.md` whenever a new failure is encountered and understood.

## Project Identity

- Primary UX is the Atun sidebar, not native chat.
- Native editor surfaces are added where they improve integration:
  - view title actions
  - commands
  - activity bar presence
  - native chat bridge
- Provider runtime must remain decoupled from the UI surface.
- Persistence is local-first.
- API credentials never belong in SQLite; they go in `SecretStorage`.

## Structural Conventions

- Keep the orchestration entry in `src/extension.ts`.
- Keep state coordination in dedicated view-model/service classes, not embedded inside raw HTML strings when avoidable.
- Keep provider logic behind `ProviderRegistry` so additional providers can be added without rewriting the sidebar flow.
- Keep database responsibilities inside `LocalDatabase`.
- Keep the webview responsible for rendering and user interaction only; business logic stays in the extension host.

## Integration Conventions

- Prefer real editor integration points over fake toolbar controls inside HTML when the editor exposes them.
- If a control belongs naturally in the VS Code view header, use `contributes.menus["view/title"]` instead of drawing it in the webview.
- The native `@atun` participant is secondary until the backend/runtime is mature enough to share behavior cleanly.
- In the webview, map VS Code theme tokens into project-scoped UI vars first (for example `--atun-*`) and style from those vars instead of spreading raw `--vscode-*` usage everywhere.
- Keep provider/model switching in one grouped selector when the user is already inside chat; avoid duplicated selectors for the same state.

## Release Conventions

- When changes are meaningful, update version, changelog and packaged VSIX output.
- Keep versioned artifacts under `packages/vX.Y.Z/`.
- Verify at least:
  - `npm run compile`
  - `npm run package:local`
- Run `npm test` when possible, but if the VS Code test harness is broken due local cache/update issues, note it explicitly instead of hiding it.

## Editing Conventions

- Preserve user changes already present in the worktree.
- Do not remove newly added icons/assets unless they are clearly wrong or explicitly requested.
- If a feature is intentionally visual-only for now, stubs are acceptable, but they should be clearly wired and named for future implementation.

## Current Product Direction

- Move from webview-heavy prototype behavior toward a more editor-native feel.
- Keep the backend usable independently of whether the UI is webview, native chat, or future custom views.
