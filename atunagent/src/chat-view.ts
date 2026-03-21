import * as path from 'node:path';
import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import { iconUri } from './icons';
import type { AccessMode } from './types';

type AgentMode = 'ask' | 'plan' | 'git' | 'docs';

interface ChatTurn {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

interface AttachmentItem {
	id: string;
	name: string;
	uri: vscode.Uri;
	isImage: boolean;
}

interface ModelOption {
	id: string;
	name: string;
	label: string;
}

interface TokenSummary {
	modelId: string;
	inputTokens: number;
	attachmentTokens: number;
	projectTokens: number;
	imageTokens: number;
	totalTokens: number;
}

type IncomingMessage =
	| { type: 'ready' }
	| { type: 'send'; prompt: string; modelId?: string; accessMode: AccessMode; agentMode: AgentMode; thinkingMode: string }
	| { type: 'stop' }
	| { type: 'addFiles' }
	| { type: 'removeAttachment'; id: string }
	| { type: 'chooseSkill' }
	| { type: 'inputChanged'; prompt: string; modelId?: string };

export class AtunChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atunAgent.chatView';

	private view: vscode.WebviewView | undefined;

	private history: ChatTurn[] = [];

	private attachments: AttachmentItem[] = [];

	private models: ModelOption[] = [];

	private lastDraft = '';

	private selectedModelId: string | undefined;

	private selectedAccessMode: AccessMode;

	private selectedAgentMode: AgentMode = 'ask';

	private selectedThinkingMode = 'high';

	private isRunning = false;

	private projectSnapshotCache: { at: number; text: string } | undefined;

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly state: AtunAgentState,
	) {
		this.selectedAccessMode = state.accessMode;
		this.selectedThinkingMode = state.thinkingMode ? 'high' : 'normal';
	}

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
			case 'send':
				this.selectedModelId = message.modelId || this.selectedModelId;
				this.selectedAccessMode = message.accessMode;
				this.selectedAgentMode = message.agentMode;
				this.selectedThinkingMode = message.thinkingMode;
				await this.state.setAccessMode(message.accessMode);
				await this.state.setThinkingMode(message.thinkingMode === 'high');
				await this.runSend(message.prompt);
				return;
			case 'stop':
				this.state.stopActiveRequest();
				return;
			case 'addFiles':
				await this.pickFiles();
				return;
			case 'removeAttachment':
				this.attachments = this.attachments.filter((item) => item.id !== message.id);
				await this.postState();
				await this.recomputeDraftTokens();
				return;
			case 'chooseSkill':
				await this.pickSkill();
				return;
			case 'inputChanged':
				this.lastDraft = message.prompt;
				this.selectedModelId = message.modelId || this.selectedModelId;
				await this.recomputeDraftTokens();
				return;
			default:
				return;
		}
	}

	private async runSend(prompt: string): Promise<void> {
		const trimmed = prompt.trim();
		if (!trimmed) {
			return;
		}

		const model = await this.resolveModel(this.selectedModelId);
		if (!model) {
			this.history.push({ role: 'system', content: 'No hay modelos de chat disponibles en VS Code.' });
			await this.postState();
			return;
		}

		this.lastDraft = '';
		this.history.push({ role: 'user', content: trimmed });
		this.history.push({ role: 'assistant', content: '' });
		this.isRunning = true;
		await this.postState();

		const requestCts = new vscode.CancellationTokenSource();
		this.state.setActiveRequestCancellation(requestCts);

		try {
			const attachmentContext = await this.buildAttachmentContext();
			const projectSnapshot = await this.getProjectSnapshot();
			const instruction = this.buildInstructionBlock();
			const userPrompt = [
				instruction,
				trimmed,
				attachmentContext.text ? `[Attached Files]\n${attachmentContext.text}` : '',
				attachmentContext.images ? `[Attached Images]\n${attachmentContext.images}` : '',
				projectSnapshot ? `[Project Snapshot]\n${projectSnapshot}` : '',
			]
				.filter((entry) => entry.length > 0)
				.join('\n\n');

			const messages = this.toLanguageModelMessages(userPrompt);
			const response = await model.sendRequest(messages, {}, requestCts.token);

			let assistantText = '';
			for await (const chunk of response.text) {
				assistantText += chunk;
				this.history[this.history.length - 1] = { role: 'assistant', content: assistantText };
				await this.postState();
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error inesperado';
			this.history[this.history.length - 1] = { role: 'assistant', content: `Error: ${message}` };
			await this.postState();
		} finally {
			this.isRunning = false;
			requestCts.dispose();
			this.state.setActiveRequestCancellation(undefined);
			await this.recomputeDraftTokens();
			await this.postState();
		}
	}

	private buildInstructionBlock(): string {
		const modeInstruction: Record<AgentMode, string> = {
			ask: 'Mode ask: answer directly and concisely.',
			plan: 'Mode plan: provide a clear step-by-step plan before implementation.',
			git: 'Mode git: include git-friendly patch and commit guidance when relevant.',
			docs: 'Mode docs: prioritize explanations and documentation quality.',
		};

		const accessInstruction =
			this.selectedAccessMode === 'full'
				? 'Access mode is full.'
				: 'Access mode is isolated. Avoid destructive or system-level actions.';
		const thinkingInstruction =
			this.selectedThinkingMode === 'high'
				? 'Reasoning depth should be high.'
				: 'Reasoning depth should be normal.';

		return `[Atun Agent Context]\n${accessInstruction}\n${thinkingInstruction}\n${modeInstruction[this.selectedAgentMode]}`;
	}

	private toLanguageModelMessages(currentPrompt: string): vscode.LanguageModelChatMessage[] {
		const turns = this.history.slice(-12);
		const messages: vscode.LanguageModelChatMessage[] = [];

		for (const turn of turns) {
			if (turn.role === 'user') {
				messages.push(vscode.LanguageModelChatMessage.User(turn.content));
				continue;
			}

			if (turn.role === 'assistant' && turn.content.trim()) {
				messages.push(vscode.LanguageModelChatMessage.Assistant(turn.content));
			}
		}

		messages.push(vscode.LanguageModelChatMessage.User(currentPrompt));
		return messages;
	}

	private async pickFiles(): Promise<void> {
		const picked = await vscode.window.showOpenDialog({
			canSelectMany: true,
			canSelectFiles: true,
			canSelectFolders: false,
			openLabel: 'Add to Atun Agent',
		});

		if (!picked || picked.length === 0) {
			return;
		}

		for (const uri of picked) {
			const exists = this.attachments.some((item) => item.uri.toString() === uri.toString());
			if (exists) {
				continue;
			}
			const extension = path.extname(uri.fsPath).toLowerCase();
			this.attachments.push({
				id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
				name: path.basename(uri.fsPath),
				uri,
				isImage: IMAGE_EXTENSIONS.has(extension),
			});
		}

		await this.postState();
		await this.recomputeDraftTokens();
	}

	private async pickSkill(): Promise<void> {
		const picked = await vscode.window.showQuickPick(
			[
				{ label: 'Agent Ask', value: 'ask' as AgentMode },
				{ label: 'Agent Plan', value: 'plan' as AgentMode },
				{ label: 'Agent Git', value: 'git' as AgentMode },
				{ label: 'Agent Docs', value: 'docs' as AgentMode },
			],
			{ title: 'Select Skill/Mode' },
		);
		if (!picked) {
			return;
		}
		this.selectedAgentMode = picked.value;
		await this.postState();
	}

	private async loadModels(): Promise<void> {
		const models = await vscode.lm.selectChatModels({});
		this.models = models.map((model) => ({
			id: model.id,
			name: model.name,
			label: `${model.name} (${model.vendor}/${model.family})`,
		}));

		if (!this.selectedModelId || !this.models.some((item) => item.id === this.selectedModelId)) {
			this.selectedModelId = this.models[0]?.id;
		}
	}

	private async resolveModel(id: string | undefined): Promise<vscode.LanguageModelChat | undefined> {
		if (id) {
			const selected = await vscode.lm.selectChatModels({ id });
			if (selected[0]) {
				return selected[0];
			}
		}

		const fallback = await vscode.lm.selectChatModels({});
		return fallback[0];
	}

	private async recomputeDraftTokens(): Promise<void> {
		if (!this.lastDraft.trim() && this.attachments.length === 0) {
			await this.state.setLastTokenBreakdown({
				modelId: this.selectedModelId ?? 'none',
				inputTokens: 0,
				referenceTokens: 0,
				projectTokens: 0,
				imageReferenceTokens: 0,
				totalTokens: 0,
			});
			await this.postState();
			return;
		}

		const summary = await this.computeTokenSummary(this.lastDraft, this.selectedModelId);
		await this.state.setLastTokenBreakdown({
			modelId: summary.modelId,
			inputTokens: summary.inputTokens,
			referenceTokens: summary.attachmentTokens,
			projectTokens: summary.projectTokens,
			imageReferenceTokens: summary.imageTokens,
			totalTokens: summary.totalTokens,
		});
		await this.postState();
	}

	private async computeTokenSummary(prompt: string, modelId?: string): Promise<TokenSummary> {
		const model = await this.resolveModel(modelId);
		if (!model) {
			return {
				modelId: 'none',
				inputTokens: 0,
				attachmentTokens: 0,
				projectTokens: 0,
				imageTokens: 0,
				totalTokens: 0,
			};
		}

		const attachmentContext = await this.buildAttachmentContext();
		const projectSnapshot = await this.getProjectSnapshot();
		const inputTokens = await countTokensSafe(model, prompt);
		const attachmentTokens = await countTokensSafe(model, attachmentContext.text);
		const imageTokens = await countTokensSafe(model, attachmentContext.images);
		const projectTokens = await countTokensSafe(model, projectSnapshot);

		return {
			modelId: model.id,
			inputTokens,
			attachmentTokens,
			projectTokens,
			imageTokens,
			totalTokens: inputTokens + attachmentTokens + projectTokens + imageTokens,
		};
	}

	private async buildAttachmentContext(): Promise<{ text: string; images: string }> {
		const textParts: string[] = [];
		const imageParts: string[] = [];

		for (const attachment of this.attachments) {
			if (attachment.isImage) {
				imageParts.push(`${attachment.name} (${attachment.uri.fsPath})`);
				continue;
			}

			try {
				const bytes = await vscode.workspace.fs.readFile(attachment.uri);
				const content = Buffer.from(bytes).toString('utf8').slice(0, 12000);
				textParts.push(`### ${attachment.name}\n${content}`);
			} catch {
				textParts.push(`### ${attachment.name}\n[Could not read file content]`);
			}
		}

		return {
			text: textParts.join('\n\n'),
			images: imageParts.join('\n'),
		};
	}

	private async getProjectSnapshot(): Promise<string> {
		const now = Date.now();
		if (this.projectSnapshotCache && now - this.projectSnapshotCache.at < 20000) {
			return this.projectSnapshotCache.text;
		}

		const files = await vscode.workspace.findFiles(
			'**/*',
			'**/{node_modules,.git,.vscode-test,dist,out,coverage}/**',
			250,
		);
		const lines = files.map((file) => vscode.workspace.asRelativePath(file, false));
		const text = lines.join('\n');
		this.projectSnapshotCache = { at: now, text };
		return text;
	}

	private async postState(): Promise<void> {
		if (!this.view) {
			return;
		}

		const tokenBreakdown = this.state.lastTokenBreakdown;
		await this.view.webview.postMessage({
			type: 'state',
			history: this.history,
			attachments: this.attachments.map((item) => ({ id: item.id, name: item.name, isImage: item.isImage })),
			models: this.models,
			selectedModelId: this.selectedModelId,
			accessMode: this.selectedAccessMode,
			agentMode: this.selectedAgentMode,
			thinkingMode: this.selectedThinkingMode,
			isRunning: this.isRunning,
			tokenSummary: tokenBreakdown
				? {
						modelId: tokenBreakdown.modelId,
						inputTokens: tokenBreakdown.inputTokens,
						attachmentTokens: tokenBreakdown.referenceTokens,
						projectTokens: tokenBreakdown.projectTokens,
						imageTokens: tokenBreakdown.imageReferenceTokens,
						totalTokens: tokenBreakdown.totalTokens,
					}
				: undefined,
		});
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = createNonce();
		const scriptNonce = `nonce-${nonce}`;

		const icons = {
			hash: webview.asWebviewUri(iconUri(this.context, 'hash.svg')),
			slash: webview.asWebviewUri(iconUri(this.context, 'slash.svg')),
			play: webview.asWebviewUri(iconUri(this.context, 'play.svg')),
			pause: webview.asWebviewUri(iconUri(this.context, 'pause.svg')),
			thinking: webview.asWebviewUri(iconUri(this.context, 'thinking.svg')),
			model: webview.asWebviewUri(iconUri(this.context, 'model.svg')),
			isolated: webview.asWebviewUri(iconUri(this.context, 'Isolated-access.svg')),
			full: webview.asWebviewUri(iconUri(this.context, 'full-access.svg')),
			logo: webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'assets', 'icons', 'logo', 'atunagent.svg'))),
		};

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${scriptNonce};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atun Agent</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      background: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      font-family: var(--vscode-font-family);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
    }
    .header img { width: 16px; height: 16px; }
    .messages {
      min-height: 0;
      overflow: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .welcome {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      line-height: 1.45;
      padding: 12px;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 12px;
    }
    .turn {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      padding: 9px 10px;
      white-space: pre-wrap;
      line-height: 1.4;
      font-size: 12px;
    }
    .turn.user {
      background: color-mix(in srgb, var(--vscode-button-background) 15%, transparent);
      align-self: flex-end;
      max-width: 92%;
    }
    .turn.assistant {
      background: color-mix(in srgb, var(--vscode-editor-background) 70%, transparent);
    }
    .composer {
      border-top: 1px solid var(--vscode-panel-border);
      padding: 10px;
      display: grid;
      gap: 8px;
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .chip button {
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 12px;
      padding: 0;
    }
    textarea {
      width: 100%;
      resize: vertical;
      min-height: 90px;
      max-height: 220px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      padding: 10px;
      outline: none;
      font: inherit;
    }
    textarea:focus {
      border-color: var(--vscode-focusBorder);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .left-actions, .right-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .icon-btn {
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 8px;
      padding: 5px 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      cursor: pointer;
    }
    .icon-btn img { width: 13px; height: 13px; }
    .send-btn {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .selectors {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }
    select {
      width: 100%;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      padding: 5px 6px;
      font-size: 11px;
    }
    .tokens {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 5px 8px;
    }
  </style>
</head>
<body>
  <header class="header"><img src="${icons.logo}" alt="logo" /> ATUN AGENT</header>
  <main class="messages" id="messages"></main>
  <section class="composer">
    <div class="chips" id="chips"></div>
    <textarea id="prompt" placeholder="Ask Atun Agent to code, plan, debug or document..."></textarea>
    <div class="row">
      <div class="left-actions">
        <button class="icon-btn" id="btnHash"><img src="${icons.hash}" alt="#" /># files</button>
        <button class="icon-btn" id="btnSlash"><img src="${icons.slash}" alt="/" />/skills</button>
        <button class="icon-btn" id="btnPlayPause"><img id="playPauseIcon" src="${icons.play}" alt="run" /><span id="playPauseText">Play</span></button>
      </div>
      <div class="right-actions">
        <div class="tokens" id="tokens">Tokens 0</div>
        <button class="send-btn" id="btnSend">Enviar</button>
      </div>
    </div>
    <div class="selectors">
      <select id="access">
        <option value="isolated">Acceso Aislado</option>
        <option value="full">Acceso Full</option>
      </select>
      <select id="agentMode">
        <option value="ask">Agent Ask</option>
        <option value="plan">Agent Plan</option>
        <option value="git">Agent Git</option>
        <option value="docs">Agent Docs</option>
      </select>
      <select id="model"></select>
      <select id="thinking">
        <option value="normal">normal</option>
        <option value="high">alto</option>
      </select>
    </div>
  </section>
  <script ${scriptNonce}>
    const vscode = acquireVsCodeApi();
    const state = {
      history: [],
      attachments: [],
      models: [],
      selectedModelId: '',
      accessMode: 'isolated',
      agentMode: 'ask',
      thinkingMode: 'high',
      isRunning: false,
      tokenSummary: undefined,
    };

    const messagesEl = document.getElementById('messages');
    const chipsEl = document.getElementById('chips');
    const promptEl = document.getElementById('prompt');
    const accessEl = document.getElementById('access');
    const modeEl = document.getElementById('agentMode');
    const modelEl = document.getElementById('model');
    const thinkingEl = document.getElementById('thinking');
    const tokensEl = document.getElementById('tokens');
    const btnSend = document.getElementById('btnSend');
    const btnHash = document.getElementById('btnHash');
    const btnSlash = document.getElementById('btnSlash');
    const btnPlayPause = document.getElementById('btnPlayPause');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const playPauseText = document.getElementById('playPauseText');

    let inputTimer;
    const playIcon = '${icons.play}';
    const pauseIcon = '${icons.pause}';

    function render() {
      messagesEl.innerHTML = '';
      if (!state.history.length) {
        const welcome = document.createElement('div');
        welcome.className = 'welcome';
        welcome.textContent = 'Atun Agent listo. Usa # para agregar archivos, /skills para modos y envia tu tarea abajo.';
        messagesEl.appendChild(welcome);
      } else {
        for (const turn of state.history) {
          const div = document.createElement('div');
          div.className = 'turn ' + turn.role;
          div.textContent = turn.content;
          messagesEl.appendChild(div);
        }
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;

      chipsEl.innerHTML = '';
      for (const item of state.attachments) {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = item.name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'x';
        remove.addEventListener('click', () => {
          vscode.postMessage({ type: 'removeAttachment', id: item.id });
        });
        chip.appendChild(remove);
        chipsEl.appendChild(chip);
      }

      accessEl.value = state.accessMode;
      modeEl.value = state.agentMode;
      thinkingEl.value = state.thinkingMode;

      modelEl.innerHTML = '';
      for (const model of state.models) {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.label;
        modelEl.appendChild(option);
      }
      if (state.selectedModelId) {
        modelEl.value = state.selectedModelId;
      }

      if (state.tokenSummary) {
        tokensEl.textContent = 'Tokens ' + state.tokenSummary.totalTokens;
      } else {
        tokensEl.textContent = 'Tokens 0';
      }

      playPauseIcon.src = state.isRunning ? pauseIcon : playIcon;
      playPauseText.textContent = state.isRunning ? 'Pause' : 'Play';
      btnSend.disabled = state.isRunning;
    }

    function postInputChanged() {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => {
        vscode.postMessage({
          type: 'inputChanged',
          prompt: promptEl.value,
          modelId: modelEl.value || undefined,
        });
      }, 220);
    }

    btnSend.addEventListener('click', () => {
      vscode.postMessage({
        type: 'send',
        prompt: promptEl.value,
        modelId: modelEl.value || undefined,
        accessMode: accessEl.value,
        agentMode: modeEl.value,
        thinkingMode: thinkingEl.value,
      });
      promptEl.value = '';
      postInputChanged();
    });

    btnPlayPause.addEventListener('click', () => {
      if (state.isRunning) {
        vscode.postMessage({ type: 'stop' });
      } else {
        btnSend.click();
      }
    });

    btnHash.addEventListener('click', () => vscode.postMessage({ type: 'addFiles' }));
    btnSlash.addEventListener('click', () => vscode.postMessage({ type: 'chooseSkill' }));

    promptEl.addEventListener('input', postInputChanged);
    modelEl.addEventListener('change', postInputChanged);

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.type !== 'state') {
        return;
      }
      Object.assign(state, data);
      render();
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
	}
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']);

function createNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let value = '';
	for (let i = 0; i < 32; i += 1) {
		value += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return value;
}

async function countTokensSafe(model: vscode.LanguageModelChat, text: string): Promise<number> {
	if (!text.trim()) {
		return 0;
	}
	try {
		return await model.countTokens(text);
	} catch {
		return Math.max(1, Math.ceil(text.length / 4));
	}
}
