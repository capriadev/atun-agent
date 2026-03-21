# Atun Agent

Extension de agente de chat para VS Code con UI propia en sidebar, orientada a flujo tipo Codex/Claude/Roo.

## Caracteristicas

- Vista de chat completa en sidebar (historial + composer inferior).
- Input con controles:
  - `#` agregar archivos/imagenes
  - `/skills` cambiar modo de trabajo
  - `play/pause` enviar o frenar respuesta
- Selectores inferiores:
  - Access: `isolated` / `full`
  - Agent mode: `ask` / `plan` / `git` / `docs`
  - Model selector (modelos disponibles en VS Code LM API)
  - Thinking: `normal` / `high`
- Token counter en tiempo casi real (al escribir y al adjuntar):
  - input
  - adjuntos
  - snapshot de proyecto
  - imagenes adjuntas (estimacion)

## Atajos y comandos

- `Ctrl+Shift+A` (Win/Linux) / `Cmd+Shift+A` (macOS): abrir Atun Agent.
- `Atun Agent: Open Chat`
- `Atun Agent: Focus Sidebar`
- `Atun Agent: Stop Response`

## Configuracion

- `atunAgent.accessMode`: `isolated` o `full`
- `atunAgent.preferSecondarySideBar`: intentar ubicar la vista en la barra lateral secundaria

## Desarrollo

```bash
npm install
npm run compile
npm test
```