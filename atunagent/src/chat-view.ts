import * as path from 'node:path';
import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import type { AgentMode } from './types';

interface ModelOption {
	id: string;
	label: string;
}

type IncomingMessage =
	| { type: 'ready' }
	| { type: 'openChat' }
	| { type: 'addContextFiles' }
	| { type: 'createFile' }
	| { type: 'deleteFile' }
	| { type: 'runTerminal' }
	| { type: 'clearContext' }
	| { type: 'setAccessMode'; value: 'isolated' | 'full' }
	| { type: 'setAgentMode'; value: AgentMode }
	| { type: 'setModelId'; value: string };

export class AtunShellViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atunAgent.shellView';

	private view: vscode.WebviewView | undefined;
	private models: ModelOption[] = [];

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly state: AtunAgentState,
	) {}

	public async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'assets'))],
		};
		view.webview.html = this.getHtml(view.webview);
		view.webview.onDidReceiveMessage((message: IncomingMessage) => {
			void this.handleMessage(message);
		});
		await this.loadModels();
		await this.postState();
	}

	public refresh(): void {
		void this.postState();
	}

	private async handleMessage(message: IncomingMessage): Promise<void> {
		switch (message.type) {
			case 'ready':
				await this.loadModels();
				await this.postState();
				return;
			case 'openChat':
				await vscode.commands.executeCommand('atun-agent.openChat');
				return;
			case 'addContextFiles':
				await vscode.commands.executeCommand('atun-agent.addContextFiles');
				return;
			case 'createFile':
				await vscode.commands.executeCommand('atun-agent.workspace.createFile');
				return;
			case 'deleteFile':
				await vscode.commands.executeCommand('atun-agent.workspace.deleteFile');
				return;
			case 'runTerminal':
				await vscode.commands.executeCommand('atun-agent.workspace.runTerminal');
				return;
			case 'clearContext':
				await this.state.clearContextFiles();
				await this.postState();
				return;
			case 'setAccessMode':
				await this.state.setAccessMode(message.value);
				await this.postState();
				return;
			case 'setAgentMode':
				await this.state.setAgentMode(message.value);
				await this.postState();
				return;
			case 'setModelId':
				await this.state.setModelOverrideId(message.value || undefined);
				await this.postState();
				return;
			default:
				return;
		}
	}

	private async loadModels(): Promise<void> {
		const models = await vscode.lm.selectChatModels({});
		this.models = models.map((model) => ({
			id: model.id,
			label: `${model.name} (${model.vendor}/${model.family})`,
		}));

		const selected = this.state.modelOverrideId;
		if (!selected && this.models[0]) {
			await this.state.setModelOverrideId(this.models[0].id);
		}
	}

	private async postState(): Promise<void> {
		if (!this.view) {
			return;
		}

		const modelId = this.state.modelOverrideId ?? this.models[0]?.id ?? '';
		await this.view.webview.postMessage({
			type: 'state',
			accessMode: this.state.accessMode,
			agentMode: this.state.agentMode,
			modelId,
			models: this.models,
			contextCount: this.state.contextFileUris.length,
			isRunning: this.state.hasRunningRequest(),
		});
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = createNonce();
		const logo = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'assets', 'icons', 'logo', 'atunagent.svg')));
		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atun Agent</title>
  <style>
    body {
      margin: 0;
      padding: 10px;
      display: grid;
      gap: 8px;
      color: var(--vscode-sideBar-foreground);
      background: var(--vscode-sideBar-background);
      font: 12px/1.35 var(--vscode-font-family);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .header img { width: 14px; height: 14px; }
    .row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    button, select {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 6px;
      font-size: 11px;
      cursor: pointer;
    }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      width: 100%;
    }
    .status {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 6px;
      display: grid;
      gap: 4px;
      color: var(--vscode-descriptionForeground);
    }
    .tiny { font-size: 11px; }
  </style>
</head>
<body>
  <div class="header"><img src="${logo}" alt="logo">ATUN AGENT</div>
  <button id="openChat" class="primary">Open Native Chat (@atun)</button>
  <div class="row">
    <button id="addContext">+ Context Files</button>
    <button id="clearContext">Clear Context</button>
    <button id="createFile">Create File</button>
    <button id="deleteFile">Delete File</button>
    <button id="runTerminal">Run Terminal</button>
  </div>
  <div class="row">
    <select id="access">
      <option value="isolated">Access isolated</option>
      <option value="full">Access full</option>
    </select>
    <select id="mode">
      <option value="ask">Mode ask</option>
      <option value="plan">Mode plan</option>
      <option value="git">Mode git</option>
      <option value="docs">Mode docs</option>
    </select>
  </div>
  <select id="model"></select>
  <div class="status tiny" id="status"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = { accessMode: 'isolated', agentMode: 'ask', modelId: '', models: [], contextCount: 0, isRunning: false };

    const status = document.getElementById('status');
    const access = document.getElementById('access');
    const mode = document.getElementById('mode');
    const model = document.getElementById('model');

    function render() {
      access.value = state.accessMode;
      mode.value = state.agentMode;
      model.innerHTML = '';
      for (const item of state.models) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        model.appendChild(option);
      }
      if (state.modelId) {
        model.value = state.modelId;
      }
      status.innerHTML = [
        'Context files: ' + state.contextCount,
        'Active response: ' + (state.isRunning ? 'running' : 'idle'),
      ].join('<br/>');
    }

    document.getElementById('openChat').addEventListener('click', () => vscode.postMessage({ type: 'openChat' }));
    document.getElementById('addContext').addEventListener('click', () => vscode.postMessage({ type: 'addContextFiles' }));
    document.getElementById('clearContext').addEventListener('click', () => vscode.postMessage({ type: 'clearContext' }));
    document.getElementById('createFile').addEventListener('click', () => vscode.postMessage({ type: 'createFile' }));
    document.getElementById('deleteFile').addEventListener('click', () => vscode.postMessage({ type: 'deleteFile' }));
    document.getElementById('runTerminal').addEventListener('click', () => vscode.postMessage({ type: 'runTerminal' }));

    access.addEventListener('change', () => vscode.postMessage({ type: 'setAccessMode', value: access.value }));
    mode.addEventListener('change', () => vscode.postMessage({ type: 'setAgentMode', value: mode.value }));
    model.addEventListener('change', () => vscode.postMessage({ type: 'setModelId', value: model.value }));

    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'state') {
        return;
      }
      Object.assign(state, event.data);
      render();
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
	}
}

function createNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 32; i += 1) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}
