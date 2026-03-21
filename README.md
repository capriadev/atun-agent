# Atun Agent Workspace

Atun Agent es una extension de VS Code con UI de chat en sidebar (estilo agentes tipo Codex/Claude/Roo), con composer inferior, adjuntos, slash skills, selectores y conteo de tokens.

## Proyecto activo

- `atunagent/`: extension TypeScript principal.

## Comandos desde la raiz

```bash
npm run install:ext
npm run compile
npm run watch
npm run test
npm run package
```

## Estado actual

- UI de agente tipo chat en sidebar (no listado de opciones).
- Atajo rapido: `Ctrl+Shift+A` / `Cmd+Shift+A`.
- Selector de acceso: `isolated` y `full`.
- Conteo de tokens por `model.countTokens(...)` (input, adjuntos, snapshot de proyecto e imagenes).

## Autor

[capriadev](https://github.com/capriadev)