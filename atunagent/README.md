# Atun Agent

Atun Agent es un **chat agent para VS Code en sidebar** pensado para flujo de desarrollo real: prompt + contexto de archivos + modos de trabajo + control de respuesta + estimacion de tokens.

Repo: https://github.com/capriadev/atun-agent

## Que lo diferencia

- UI de chat persistente en barra lateral (historial + composer inferior).
- Adjuntos directos con `#` (archivos/imagenes).
- Slash skills con `/skills` y modos de trabajo (`ask`, `plan`, `git`, `docs`).
- Selectores de sesion:
  - Access: `isolated` / `full`
  - Model (VS Code LM API)
  - Thinking: `normal` / `high`
- Control de ejecucion en vivo (`play/pause`) para enviar o frenar respuesta activa.
- Conteo de tokens por modelo (`model.countTokens`) sobre:
  - input
  - adjuntos
  - snapshot de proyecto
  - imagenes (estimacion por descriptor)

## Atajos y comandos

- **Abrir agente**:
  - `Ctrl+Shift+A` (Win/Linux)
  - `Ctrl+Alt+A` (fallback Win/Linux)
  - `Cmd+Shift+A` / `Cmd+Alt+A` (macOS)
- Command Palette:
  - `Atun Agent: Open Chat`
  - `Atun Agent: Focus Sidebar`
  - `Atun Agent: Stop Response`

## Configuracion

- `atunAgent.accessMode`: `isolated` o `full`
- `atunAgent.preferSecondarySideBar`: intenta ubicar vista en barra secundaria
- `atunAgent.autoRevealOnStartup`: auto-abrir Atun Agent en primera activacion

## Desarrollo local

```bash
npm install
npm run compile
npm test
```

## Empaquetado local (VSIX)

Desde la raiz del repo:

```bash
npm run package:local
```

Salida:

```text
packages/v{version}/atun-agent-{version}.vsix
```

Instalacion local:

```bash
code --install-extension packages/v1.1.2/atun-agent-1.1.2.vsix
```

## Troubleshooting rapido

- Si `Atun Agent: Open Chat` no abre, usar `Atun Agent: Focus Sidebar`.
- Si no aparece en barra secundaria, VS Code hace fallback a barra primaria segun disponibilidad.
- Si no hay modelos en selector, verificar acceso a modelos en VS Code LM API (Copilot/Provider).