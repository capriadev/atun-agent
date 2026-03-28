import * as path from 'node:path';
import * as vscode from 'vscode';
import type { HostSupport } from './host-support';
import { SidebarViewModel } from './sidebar/sidebar-view-model';
import type { ProviderKind, SidebarViewState } from './core/types';

type IncomingMessage =
	| { type: 'ready' }
	| { type: 'openProviderPicker' }
	| { type: 'chooseProvider'; providerKind: ProviderKind }
	| { type: 'updateProviderDraft'; patch: { displayName?: string; apiKey?: string } }
	| { type: 'validateProviderDraft' }
	| { type: 'toggleDraftModel'; modelId: string }
	| { type: 'saveProviderConnection' }
	| { type: 'setModelSelection'; connectionId: string; modelId: string }
	| { type: 'sendChatMessage'; content: string }
	| { type: 'newChat' }
	| { type: 'openProviderManager' }
	| { type: 'openNativeChat' }
	| { type: 'back' };

export class AtunShellViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atunAgent.shellView';

	private view: vscode.WebviewView | undefined;

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly sidebarViewModel: SidebarViewModel,
		private readonly hostSupport: HostSupport,
	) {}

	public async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'assets'))],
		};
		this.renderWebview(view);
		view.webview.onDidReceiveMessage((message: IncomingMessage) => {
			void this.handleMessage(message);
		});
		view.onDidChangeVisibility(() => {
			if (!view.visible) {
				return;
			}
			this.renderWebview(view);
			void this.postState();
		});
		await this.postState();
	}

	public refresh(): void {
		void this.postState();
	}

	private renderWebview(view: vscode.WebviewView): void {
		view.webview.html = this.getHtml(view.webview);
	}

	private async handleMessage(message: IncomingMessage): Promise<void> {
		try {
			switch (message.type) {
				case 'ready':
					await this.postState();
					return;
				case 'openProviderPicker':
				case 'openProviderManager':
					await this.sidebarViewModel.openProviderPicker();
					return;
				case 'chooseProvider':
					await this.sidebarViewModel.chooseProvider(message.providerKind);
					return;
				case 'updateProviderDraft':
					await this.sidebarViewModel.updateProviderDraft(message.patch);
					return;
				case 'validateProviderDraft':
					await this.sidebarViewModel.validateProviderDraft();
					return;
				case 'toggleDraftModel':
					await this.sidebarViewModel.toggleDraftModel(message.modelId);
					return;
				case 'saveProviderConnection':
					await this.sidebarViewModel.saveProviderConnection();
					return;
				case 'setModelSelection':
					await this.sidebarViewModel.setModelSelection(message.connectionId, message.modelId);
					return;
				case 'sendChatMessage':
					await this.sidebarViewModel.sendChatMessage(message.content);
					return;
				case 'newChat':
					await this.sidebarViewModel.newChat();
					return;
				case 'openNativeChat':
					if (this.hostSupport.hasChatParticipantApi) {
						await vscode.commands.executeCommand('atun-agent.openNativeChat');
					}
					return;
				case 'back':
					await this.sidebarViewModel.goBack();
					return;
				default:
					return;
			}
		} catch (error) {
			const messageText = error instanceof Error ? error.message : 'Atun Agent action failed.';
			void vscode.window.showErrorMessage(messageText);
			await this.postState();
		}
	}

	private async postState(): Promise<void> {
		if (!this.view) {
			return;
		}

		const state = await this.sidebarViewModel.getState();
		await this.view.webview.postMessage({
			type: 'state',
			...state,
		} satisfies SidebarViewState & { type: 'state' });
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = createNonce();
		const logoMarkup = getLogoMarkup();

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atun Agent</title>
  <style>
    :root {
      color-scheme: light dark;
      --atun-bg: var(--vscode-sideBar-background);
      --atun-bg-elevated: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      --atun-panel: var(--vscode-editor-background);
      --atun-panel-muted: var(--vscode-input-background);
      --atun-border: var(--vscode-widget-border, var(--vscode-panel-border, var(--vscode-editorGroup-border)));
      --atun-border-strong: var(--vscode-contrastBorder, var(--vscode-widget-border, var(--vscode-panel-border)));
      --atun-text: var(--vscode-foreground);
      --atun-text-strong: var(--vscode-editor-foreground, var(--vscode-foreground));
      --atun-muted: var(--vscode-descriptionForeground);
      --atun-accent: var(--vscode-button-background);
      --atun-accent-text: var(--vscode-button-foreground);
      --atun-secondary: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      --atun-secondary-text: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      --atun-hover: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground));
      --atun-input-text: var(--vscode-input-foreground);
      --atun-placeholder: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground));
      --atun-link: var(--vscode-textLink-foreground);
      --atun-error: var(--vscode-errorForeground);
      --atun-warning-border: var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
      --atun-scrollbar: var(--vscode-scrollbarSlider-background, color-mix(in srgb, var(--atun-muted) 42%, transparent));
      --atun-scrollbar-hover: var(--vscode-scrollbarSlider-hoverBackground, color-mix(in srgb, var(--atun-muted) 58%, transparent));
      --atun-focus: var(--vscode-focusBorder);
      --atun-font: var(--vscode-font-family);
      --atun-radius: 14px;
      --atun-radius-sm: 10px;
      --atun-shadow-color: var(--vscode-widget-shadow, color-mix(in srgb, var(--atun-text-strong) 16%, transparent));
      --atun-stripe: color-mix(in srgb, var(--atun-muted) 42%, transparent);
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      height: 100%;
    }
    body {
      margin: 0;
      height: 100vh;
      background:
        radial-gradient(circle at top, color-mix(in srgb, var(--atun-accent) 10%, transparent), transparent 46%),
        var(--atun-bg);
      color: var(--atun-text);
      font: 12px/1.45 var(--atun-font);
      overflow: hidden;
    }
    button, input, textarea, select {
      font: inherit;
      color: inherit;
    }
    button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
      outline: 1px solid var(--atun-focus);
      outline-offset: 1px;
    }
    .screen {
      display: none;
      height: 100vh;
      min-height: 100vh;
      overflow: hidden;
    }
    .screen.active {
      display: block;
    }
    .screen.onboarding.active {
      display: grid;
    }
    .screen.picker.active,
    .screen.config.active {
      display: grid;
      align-content: start;
    }
    .surface {
      border: 1px solid var(--atun-border);
      border-radius: var(--atun-radius);
      background: color-mix(in srgb, var(--atun-bg-elevated) 92%, var(--atun-bg));
      box-shadow: 0 10px 28px var(--atun-shadow-color);
    }
    .onboarding {
      display: grid;
      place-items: center;
      padding: 18px;
    }
    .onboarding-card {
      width: 100%;
      max-width: 360px;
      padding: 24px 18px;
      text-align: center;
      display: grid;
      gap: 16px;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--atun-text-strong);
    }
    .logo-mark svg {
      width: 78px;
      height: 78px;
      display: block;
    }
    .stack {
      display: grid;
      gap: 6px;
    }
    .title {
      margin: 0;
      font-size: 26px;
      line-height: 1;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--atun-text-strong);
    }
    .subtitle {
      margin: 0;
      color: var(--atun-muted);
    }
    .button {
      width: 100%;
      min-height: 40px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--atun-border);
      background: var(--atun-secondary);
      color: var(--atun-secondary-text);
      cursor: pointer;
    }
    .button:hover:not(:disabled) {
      background: var(--atun-hover);
    }
    .button.primary {
      border-color: transparent;
      background: var(--atun-accent);
      color: var(--atun-accent-text);
    }
    .button.link {
      border-style: dashed;
      background: transparent;
      color: var(--atun-link);
    }
    .button:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .button-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .picker, .config, .chat-screen {
      height: 100vh;
      padding: 10px;
    }
    .picker, .config {
      display: grid;
      gap: 12px;
      grid-template-rows: auto minmax(0, 1fr);
    }
    .toolbar-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .toolbar-row h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.1;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--atun-text-strong);
    }
    .icon-lite {
      width: auto;
      min-height: 32px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--atun-border);
      background: transparent;
      cursor: pointer;
      color: var(--atun-muted);
    }
    .provider-card {
      width: 100%;
      padding: 14px;
      text-align: left;
      display: grid;
      gap: 6px;
      cursor: pointer;
      border-radius: var(--atun-radius);
      border: 1px solid var(--atun-border);
      background: var(--atun-bg-elevated);
    }
    .provider-card:hover {
      background: var(--atun-hover);
    }
    .provider-card strong {
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--atun-text-strong);
    }
    .config-panel {
      padding: 14px;
      display: grid;
      gap: 12px;
      min-height: 0;
      overflow: hidden;
    }
    .setup-panel[hidden] {
      display: none;
    }
    .field {
      display: grid;
      gap: 6px;
    }
    .field label {
      color: var(--atun-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
    }
    .input {
      width: 100%;
      min-height: 40px;
      padding: 10px 12px;
      border-radius: var(--atun-radius-sm);
      border: 1px solid var(--atun-border);
      background: var(--atun-panel-muted);
      color: var(--atun-input-text);
    }
    .hint {
      color: var(--atun-muted);
      font-size: 11px;
    }
    .notice {
      padding: 10px 12px;
      border-radius: var(--atun-radius-sm);
      border: 1px solid var(--atun-warning-border);
      background: var(--atun-panel-muted);
      color: var(--atun-text);
    }
    .models {
      display: grid;
      gap: 8px;
      max-height: 240px;
      overflow: auto;
      padding-right: 2px;
    }
    .model-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--atun-radius-sm);
      border: 1px solid var(--atun-border);
      background: var(--atun-panel);
    }
    .model-row input {
      margin: 0;
      width: auto;
    }
    .chat-shell {
      height: calc(100vh - 20px);
      min-height: 0;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: 10px;
    }
    .history-shell {
      position: relative;
      overflow: hidden;
      border-radius: 18px;
      border: 1px solid var(--atun-border-strong);
      background: var(--atun-panel);
      min-height: 0;
    }
    .history-empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 10px;
      padding: 24px;
      text-align: center;
      background:
        repeating-linear-gradient(
          135deg,
          transparent 0,
          transparent 32px,
          var(--atun-stripe) 32px,
          var(--atun-stripe) 38px
        ),
        var(--atun-panel);
    }
    .history-empty[hidden] {
      display: none;
    }
    .empty-wordmark {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: clamp(34px, 7vw, 58px);
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      line-height: 0.95;
      color: var(--atun-text-strong);
    }
    .empty-arrow {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border: 2px solid currentColor;
      border-radius: 999px;
      font-size: 24px;
    }
    .empty-copy {
      max-width: 240px;
      margin: 0;
      color: var(--atun-muted);
    }
    .messages {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 12px;
      align-content: start;
      min-height: 0;
      height: 100%;
      overflow: auto;
      padding: 14px;
    }
    .messages[hidden] {
      display: none;
    }
    .message {
      max-width: 94%;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid var(--atun-border);
      background: var(--atun-bg-elevated);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .message.user {
      margin-left: auto;
      background: var(--atun-secondary);
    }
    .message.assistant {
      margin-right: auto;
      background: var(--atun-panel);
    }
    .message.error {
      border-color: var(--atun-error);
    }
    .composer-shell {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 18px;
      border: 1px solid var(--atun-border-strong);
      background: var(--atun-bg-elevated);
    }
    .composer-header {
      display: flex;
      justify-content: flex-end;
      min-height: 10px;
    }
    .expand-button {
      min-width: 26px;
      min-height: 26px;
      padding: 0;
      border-radius: 999px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--atun-muted);
      cursor: pointer;
    }
    .expand-button:hover {
      background: var(--atun-hover);
    }
    .composer-frame {
      border-radius: 12px;
      background: transparent;
    }
    .composer-input {
      width: 100%;
      min-height: 82px;
      max-height: 180px;
      padding: 0;
      border: 0;
      resize: none;
      background: transparent;
      color: var(--atun-input-text);
      line-height: 1.5;
      overflow-y: auto;
    }
    .composer-shell.expanded .composer-input {
      min-height: 144px;
      max-height: 260px;
    }
    .composer-input::placeholder {
      color: var(--atun-placeholder);
    }
    .composer-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .prompt-actions,
    .composer-stats,
    .footer-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .micro-button,
    .chip {
      min-height: 30px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--atun-border);
      background: var(--atun-panel);
      color: var(--atun-text);
      cursor: pointer;
    }
    .micro-button:hover,
    .chip:hover {
      background: var(--atun-hover);
    }
    .micro-button {
      width: 32px;
      padding: 0;
      justify-content: center;
      display: inline-flex;
      align-items: center;
      font-weight: 700;
    }
    .micro-button:disabled,
    .chip:disabled {
      cursor: default;
      opacity: 0.7;
    }
    .send-button {
      min-height: 32px;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid transparent;
      background: var(--atun-accent);
      color: var(--atun-accent-text);
      cursor: pointer;
    }
    .send-button:hover:not(:disabled) {
      opacity: 0.92;
    }
    .send-button:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .stat {
      color: var(--atun-muted);
      white-space: nowrap;
    }
    .footer-controls {
      padding-top: 2px;
      border-top: 1px solid var(--atun-border);
      justify-content: space-between;
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
      flex: 1;
    }
    .footer-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chip.static {
      cursor: default;
      color: var(--atun-muted);
    }
    .model-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      max-width: 100%;
    }
    .model-chip span {
      color: var(--atun-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
    }
    .model-select {
      min-width: 128px;
      max-width: 100%;
      border: 0;
      background: transparent;
      color: var(--atun-text);
      padding: 0;
    }
    .model-select:disabled {
      opacity: 0.7;
    }
    .native-link {
      background: transparent;
      border-style: dashed;
      color: var(--atun-link);
    }
    .context-meter {
      min-height: 30px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--atun-border);
      background: var(--atun-panel);
      color: var(--atun-muted);
      white-space: nowrap;
    }
    .scrollable::-webkit-scrollbar,
    .models::-webkit-scrollbar,
    .messages::-webkit-scrollbar,
    .composer-input::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .scrollable::-webkit-scrollbar-thumb,
    .models::-webkit-scrollbar-thumb,
    .messages::-webkit-scrollbar-thumb,
    .composer-input::-webkit-scrollbar-thumb {
      background: var(--atun-scrollbar);
      border-radius: 999px;
    }
    .scrollable::-webkit-scrollbar-thumb:hover,
    .models::-webkit-scrollbar-thumb:hover,
    .messages::-webkit-scrollbar-thumb:hover,
    .composer-input::-webkit-scrollbar-thumb:hover {
      background: var(--atun-scrollbar-hover);
    }
  </style>
</head>
<body>
  <section id="screen-chat" class="screen chat-screen active">
    <div class="chat-shell">
      <div id="setupPanel" class="surface config-panel setup-panel" hidden>
        <div class="toolbar-row">
          <div class="stack">
            <span class="logo-mark" aria-hidden="true">${logoMarkup}</span>
            <h1>Atun Agent</h1>
            <p id="setupSubtitle" class="subtitle">Conecta Groq y habilita al menos un modelo para empezar.</p>
          </div>
          <button id="closeSetup" class="icon-lite">Volver</button>
        </div>
        <div class="field">
          <label for="displayName">Nombre personalizado</label>
          <input id="displayName" class="input" type="text" placeholder="Groq Juan" />
        </div>
        <div class="field">
          <label for="apiKey">API</label>
          <input id="apiKey" class="input" type="password" placeholder="gsk_..." />
        </div>
        <div id="modelsHint" class="hint">Al ingresar la API key se cargaran los modelos disponibles.</div>
        <div id="providerError" class="notice" hidden></div>
        <div id="modelsWrap" class="models"></div>
        <div class="button-row">
          <button id="refreshModels" class="button">Actualizar modelos</button>
          <button id="saveConnection" class="button primary">Aceptar</button>
        </div>
      </div>
      <div id="chatError" class="notice" hidden></div>
      <div class="history-shell">
        <div id="emptyState" class="history-empty">
          <div class="empty-wordmark">
            <span>Chat</span>
            <span class="empty-arrow">&#8593;</span>
          </div>
          <p class="empty-copy">Escribe el primer mensaje para empezar la sesion con el modelo seleccionado.</p>
        </div>
        <div id="messages" class="messages"></div>
      </div>
      <div id="composerShell" class="composer-shell">
        <div class="composer-header">
          <button id="toggleComposerSize" class="expand-button" title="Expandir input">^</button>
        </div>
        <div class="composer-frame">
          <textarea id="composer" class="composer-input scrollable" placeholder="Escribe tu mensaje..."></textarea>
        </div>
        <div class="composer-meta">
          <div class="prompt-actions">
            <button class="micro-button" data-insert="#" title="Adjuntar o mencionar contexto">#</button>
            <button class="micro-button" data-insert="/" title="Invocar skills">/</button>
            <button class="micro-button" data-insert="@" title="Invocar MCP">@</button>
          </div>
          <div class="composer-stats">
            <span id="tokenCount" class="stat">0 tok</span>
            <button id="sendMessage" class="send-button">Enviar</button>
          </div>
        </div>
        <div class="footer-controls">
          <div class="footer-left">
            <button id="newChat" class="chip">Nuevo chat</button>
            <button class="chip static" disabled>Full Access</button>
            <button class="chip static" disabled>Agent</button>
            <label class="chip model-chip">
              <span>Model</span>
              <select id="modelSelect" class="model-select"></select>
            </label>
          </div>
          <div class="footer-right">
            <button id="openNativeChat" class="chip native-link">Native</button>
            <div id="contextMeter" class="context-meter">0% contexto</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = {
      screen: 'onboarding',
      providerCards: [],
      draftConfig: { providerKind: 'groq', displayName: '', apiKey: '' },
      modelOptions: [],
      modelSelectorOptions: [],
      connections: [],
      activeConnectionId: undefined,
      selectedModelId: undefined,
      chatSession: undefined,
      messages: [],
      isValidatingProvider: false,
      isStreaming: false,
      error: undefined,
      nativeChatAvailable: false
    };

    const ui = {
      composerExpanded: false
    };

    let validateTimer = undefined;

    const setupPanel = document.getElementById('setupPanel');
    const setupSubtitle = document.getElementById('setupSubtitle');
    const closeSetup = document.getElementById('closeSetup');
    const displayName = document.getElementById('displayName');
    const apiKey = document.getElementById('apiKey');
    const modelsWrap = document.getElementById('modelsWrap');
    const providerError = document.getElementById('providerError');
    const modelsHint = document.getElementById('modelsHint');
    const saveConnection = document.getElementById('saveConnection');
    const refreshModels = document.getElementById('refreshModels');
    const messages = document.getElementById('messages');
    const emptyState = document.getElementById('emptyState');
    const composerShell = document.getElementById('composerShell');
    const composer = document.getElementById('composer');
    const toggleComposerSize = document.getElementById('toggleComposerSize');
    const tokenCount = document.getElementById('tokenCount');
    const contextMeter = document.getElementById('contextMeter');
    const chatError = document.getElementById('chatError');
    const modelSelect = document.getElementById('modelSelect');
    const sendMessage = document.getElementById('sendMessage');
    const openNativeChat = document.getElementById('openNativeChat');
    const insertButtons = Array.from(document.querySelectorAll('[data-insert]'));

    function estimateInputTokens() {
      const inputChars = composer.value.trim().length;
      if (!inputChars) {
        return 0;
      }
      return Math.max(1, Math.ceil(inputChars / 4));
    }

    function estimateContextPercent() {
      const transcriptChars = state.messages.reduce((total, message) => total + (message.content || '').length, 0);
      const totalChars = transcriptChars + composer.value.length;
      const estimatedTokens = Math.max(0, Math.ceil(totalChars / 4));
      return Math.min(100, Math.round((estimatedTokens / 32000) * 100));
    }

    function renderProviderConfig() {
      const showSetupPanel = state.connections.length === 0 || state.screen !== 'chat';
      setupPanel.hidden = !showSetupPanel;
      closeSetup.hidden = state.connections.length === 0;
      setupSubtitle.textContent = state.connections.length === 0
        ? 'Conecta Groq y habilita al menos un modelo para empezar.'
        : 'Agrega otra conexion o ajusta los modelos habilitados sin salir del chat.';

      displayName.value = state.draftConfig.displayName || '';
      apiKey.value = state.draftConfig.apiKey || '';
      providerError.hidden = !state.error;
      providerError.textContent = state.error || '';
      modelsHint.textContent = state.isValidatingProvider
        ? 'Consultando modelos en Groq...'
        : 'Al ingresar la API key se cargaran los modelos disponibles.';

      modelsWrap.innerHTML = '';
      if (state.modelOptions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'hint';
        empty.textContent = state.isValidatingProvider ? 'Cargando modelos...' : 'Todavia no hay modelos cargados.';
        modelsWrap.appendChild(empty);
      } else {
        for (const model of state.modelOptions) {
          const row = document.createElement('label');
          row.className = 'model-row';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = Boolean(model.enabled);
          checkbox.disabled = state.isValidatingProvider;
          checkbox.addEventListener('change', () => {
            vscode.postMessage({ type: 'toggleDraftModel', modelId: model.id });
          });

          const text = document.createElement('span');
          text.textContent = model.label;

          row.appendChild(checkbox);
          row.appendChild(text);
          modelsWrap.appendChild(row);
        }
      }

      const canAccept = Boolean(state.draftConfig.displayName.trim())
        && state.modelOptions.some((model) => model.enabled)
        && !state.isValidatingProvider
        && !state.error;
      saveConnection.disabled = !canAccept;
      refreshModels.disabled = state.isValidatingProvider || !state.draftConfig.apiKey.trim();
    }

    function renderGroupedModelSelect() {
      const selectedValue = state.activeConnectionId && state.selectedModelId
        ? state.activeConnectionId + '::' + state.selectedModelId
        : '';

      modelSelect.innerHTML = '';
      if (!state.modelSelectorOptions.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Sin modelos habilitados';
        modelSelect.appendChild(option);
        modelSelect.disabled = true;
        return;
      }

      const groups = new Map();
      for (const entry of state.modelSelectorOptions) {
        if (!groups.has(entry.connectionLabel)) {
          groups.set(entry.connectionLabel, []);
        }
        groups.get(entry.connectionLabel).push(entry);
      }

      for (const pair of groups.entries()) {
        const label = pair[0];
        const items = pair[1];
        const group = document.createElement('optgroup');
        group.label = label;
        for (const item of items) {
          const option = document.createElement('option');
          option.value = item.value;
          option.textContent = item.modelLabel;
          group.appendChild(option);
        }
        modelSelect.appendChild(group);
      }

      modelSelect.value = selectedValue;
      if (modelSelect.value !== selectedValue && modelSelect.options.length > 0) {
        modelSelect.selectedIndex = 0;
      }
      modelSelect.disabled = state.isStreaming || !state.modelSelectorOptions.length;
    }

    function renderMessages() {
      const hasMessages = state.messages.length > 0;
      emptyState.hidden = hasMessages;
      messages.hidden = !hasMessages;
      messages.innerHTML = '';

      if (!hasMessages) {
        return;
      }

      for (const item of state.messages) {
        const bubble = document.createElement('div');
        bubble.className = 'message ' + item.role + (item.errorText ? ' error' : '');
        bubble.textContent = item.content || (item.role === 'assistant' && state.isStreaming ? '...' : '');
        messages.appendChild(bubble);
      }
      messages.scrollTop = messages.scrollHeight;
    }

    function renderChat() {
      chatError.hidden = !state.error || state.screen !== 'chat';
      chatError.textContent = state.error || '';
      composerShell.classList.toggle('expanded', ui.composerExpanded);
      toggleComposerSize.textContent = ui.composerExpanded ? 'v' : '^';
      renderGroupedModelSelect();
      renderMessages();

      const inputTokens = estimateInputTokens();
      const contextPercent = estimateContextPercent();
      tokenCount.textContent = inputTokens + ' tok';
      contextMeter.textContent = contextPercent + '% contexto';

      const canSend = !state.isStreaming
        && Boolean(state.selectedModelId)
        && Boolean(composer.value.trim());
      sendMessage.disabled = !canSend;
      openNativeChat.hidden = !(state.nativeChatAvailable && state.connections.length > 0);
      openNativeChat.disabled = state.isStreaming;
      composer.disabled = state.isStreaming || !state.modelSelectorOptions.length;
      toggleComposerSize.disabled = state.isStreaming;
    }

    function render() {
      renderProviderConfig();
      renderChat();
    }

    function scheduleValidation() {
      if (validateTimer) {
        clearTimeout(validateTimer);
      }
      validateTimer = setTimeout(() => {
        if (apiKey.value.trim()) {
          vscode.postMessage({ type: 'validateProviderDraft' });
        }
      }, 450);
    }

    function sendCurrentPrompt() {
      const content = composer.value.trim();
      if (!content) {
        return;
      }
      vscode.postMessage({ type: 'sendChatMessage', content: content });
      composer.value = '';
      renderChat();
    }

    function insertComposerToken(token) {
      const prefix = composer.value && !composer.value.endsWith(' ') ? ' ' : '';
      composer.value = composer.value + prefix + token;
      composer.focus();
      renderChat();
    }

    closeSetup.addEventListener('click', () => {
      vscode.postMessage({ type: 'back' });
    });
    document.getElementById('newChat').addEventListener('click', () => {
      vscode.postMessage({ type: 'newChat' });
    });
    openNativeChat.addEventListener('click', () => {
      vscode.postMessage({ type: 'openNativeChat' });
    });
    toggleComposerSize.addEventListener('click', () => {
      ui.composerExpanded = !ui.composerExpanded;
      renderChat();
    });

    displayName.addEventListener('input', () => {
      vscode.postMessage({ type: 'updateProviderDraft', patch: { displayName: displayName.value } });
    });
    apiKey.addEventListener('input', () => {
      vscode.postMessage({ type: 'updateProviderDraft', patch: { apiKey: apiKey.value } });
      scheduleValidation();
    });
    refreshModels.addEventListener('click', () => {
      vscode.postMessage({ type: 'validateProviderDraft' });
    });
    saveConnection.addEventListener('click', () => {
      vscode.postMessage({ type: 'saveProviderConnection' });
    });

    modelSelect.addEventListener('change', () => {
      const value = modelSelect.value || '';
      const parts = value.split('::');
      const connectionId = parts[0];
      const modelId = parts[1];
      if (!connectionId || !modelId) {
        return;
      }
      vscode.postMessage({ type: 'setModelSelection', connectionId: connectionId, modelId: modelId });
    });

    composer.addEventListener('input', () => {
      renderChat();
    });
    composer.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !sendMessage.disabled) {
        event.preventDefault();
        sendCurrentPrompt();
      }
    });
    sendMessage.addEventListener('click', () => {
      sendCurrentPrompt();
    });

    for (const button of insertButtons) {
      button.addEventListener('click', () => {
        const token = button.getAttribute('data-insert') || '';
        if (token) {
          insertComposerToken(token);
        }
      });
    }

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

function getLogoMarkup(): string {
	return [
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
		'<path d="M2 16s9-15 20-4C11 23 2 8 2 8"/>',
		'</svg>',
	].join('');
}
