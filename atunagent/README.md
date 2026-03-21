# Atun Agent

Native VS Code agent extension.

## UX

- Chat integrado por API oficial (`vscode.chat`) como `@atun`.
- Acceso rapido: `Ctrl+Shift+A` (Windows/Linux), `Cmd+Shift+A` (macOS).
- Sidebar nativa con controles de:
  - Access: `isolated` / `full`
  - Thinking mode
  - Model override
  - Play/Pause (stop de respuesta activa)
  - Slash `/skills` y hash `#` para archivos
  - Token breakdown
- Preferencia de barra lateral secundaria via `atunAgent.preferSecondarySideBar` (fallback: barra lateral principal).

## Token Counter

Se calcula en cada request usando `model.countTokens(...)` del modelo activo:

- input prompt
- referencias `#` (archivos y contexto)
- snapshot de proyecto
- referencias de imagen (estimadas por descriptor)

Cuando el modelo seleccionado es GPT/Codex en el provider de OpenAI, se usa su tokenizer oficial via API de VS Code model.

## Commands

- `Atun Agent: Open Chat`
- `Atun Agent: Focus Sidebar`
- `Atun Agent: Set Access Mode`
- `Atun Agent: Toggle Thinking`
- `Atun Agent: Set Model Override`
- `Atun Agent: Stop Response`

## Development

```bash
npm install
npm run compile
npm test
```
