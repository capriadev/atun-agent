# Atun Agent Workspace

Repo: https://github.com/capriadev/atun-agent

## Local setup

```bash
npm run install:ext
npm run compile
```

## Run tests

```bash
npm run test
```

## Build local VSIX by version

```bash
npm run package:local
```

Output format:

```text
packages/v{version}/atun-agent-{version}.vsix
```

Current expected output:

```text
packages/v2.1.0/atun-agent-2.1.0.vsix
```

## Install locally

```bash
code --install-extension packages/v2.1.0/atun-agent-2.1.0.vsix
```
