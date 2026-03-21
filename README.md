# Atun Agent Workspace

Repo: https://github.com/capriadev/atun-agent

## Setup rapido (local)

```bash
npm run install:ext
npm run compile
```

## Generar VSIX local por version

```bash
npm run package:local
```

Esto genera:

```text
packages/v{version}/atun-agent-{version}.vsix
```

Ejemplo actual:

```text
packages/v1.1.1/atun-agent-1.1.1.vsix
```

## Instalar VSIX local

```bash
code --install-extension packages/v1.1.1/atun-agent-1.1.1.vsix
```
