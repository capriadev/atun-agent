import * as path from 'node:path';
import * as vscode from 'vscode';
import type { HostSupport } from './host-support';
import { SidebarViewModel } from './sidebar-view-model';
import type { ProviderKind, SidebarViewState } from './types';

type IncomingMessage =
	| { type: 'ready' }
	| { type: 'openProviderPicker' }
	| { type: 'chooseProvider'; providerKind: ProviderKind }
	| { type: 'updateProviderDraft'; patch: { displayName?: string; apiKey?: string } }
	| { type: 'validateProviderDraft' }
	| { type: 'toggleDraftModel'; modelId: string }
	| { type: 'saveProviderConnection' }
	| { type: 'setActiveConnection'; connectionId: string }
	| { type: 'setSelectedModel'; modelId: string }
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
		view.webview.html = this.getHtml(view.webview);
		view.webview.onDidReceiveMessage((message: IncomingMessage) => {
			void this.handleMessage(message);
		});
		await this.postState();
	}

	public refresh(): void {
		void this.postState();
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
				case 'setActiveConnection':
					await this.sidebarViewModel.setActiveConnection(message.connectionId);
					return;
				case 'setSelectedModel':
					await this.sidebarViewModel.setSelectedModel(message.modelId);
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
		const logo = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'assets', 'icons', 'logo', 'atunagent.svg')));

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
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top, color-mix(in srgb, var(--vscode-button-background) 20%, transparent), transparent 45%),
        var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      font: 12px/1.45 var(--vscode-font-family);
    }
    .app {
      padding: 14px;
      display: grid;
      gap: 12px;
      min-height: 100vh;
    }
    .card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--vscode-editor-background) 84%, transparent);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    }
    .screen {
      display: none;
    }
    .screen.active {
      display: grid;
      gap: 12px;
      min-height: calc(100vh - 28px);
    }
    .hero {
      place-content: center;
      text-align: center;
      gap: 16px;
      padding: 18px;
    }
    .hero img {
      width: 72px;
      height: 72px;
      margin: 0 auto;
    }
    .hero h1, .titlebar h1 {
      margin: 0;
      font-size: 20px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .hero p, .subtitle {
      margin: 0;
      color: var(--vscode-descriptionForeground);
    }
    .titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .titlebar .left {
      display: grid;
      gap: 4px;
    }
    .provider-card, .panel {
      padding: 14px;
    }
    .provider-card {
      display: grid;
      gap: 8px;
      cursor: pointer;
    }
    .provider-card:hover {
      border-color: var(--vscode-button-background);
    }
    .label {
      display: grid;
      gap: 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vscode-descriptionForeground);
    }
    input, textarea, select, button {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font: inherit;
    }
    input, textarea, select {
      padding: 10px 12px;
    }
    textarea {
      resize: vertical;
      min-height: 90px;
    }
    button {
      cursor: pointer;
      padding: 10px 12px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: transparent;
    }
    button.linklike {
      background: transparent;
      color: var(--vscode-textLink-foreground);
      border-style: dashed;
    }
    button:disabled, input:disabled, textarea:disabled, select:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .actions, .row {
      display: grid;
      gap: 8px;
    }
    .row.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .models {
      display: grid;
      gap: 8px;
      max-height: 220px;
      overflow: auto;
      padding-right: 2px;
    }
    .model {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      background: color-mix(in srgb, var(--vscode-editor-background) 84%, transparent);
    }
    .model input {
      width: auto;
      margin: 0;
    }
    .notice {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      background: color-mix(in srgb, var(--vscode-editorWarning-foreground) 12%, transparent);
      color: var(--vscode-foreground);
    }
    .chat-shell {
      grid-template-rows: auto auto 1fr auto;
    }
    .chat-toolbar {
      display: grid;
      gap: 8px;
    }
    .messages {
      display: grid;
      gap: 10px;
      align-content: start;
      overflow: auto;
      min-height: 280px;
      padding: 10px;
    }
    .message {
      max-width: 92%;
      padding: 10px 12px;
      border-radius: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid var(--vscode-panel-border);
    }
    .message.user {
      margin-left: auto;
      background: color-mix(in srgb, var(--vscode-button-background) 18%, var(--vscode-editor-background));
    }
    .message.assistant {
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent);
    }
    .message.error {
      border-color: var(--vscode-errorForeground);
    }
    .empty {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      padding: 20px 10px;
    }
    .tiny {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="app">
    <section id="screen-onboarding" class="screen card hero">
      <img src="${logo}" alt="Atun Agent logo" />
      <div class="actions">
        <h1>Atun Agent</h1>
        <p>Conecta un proveedor, elige modelos y arranca el chat local de la extension.</p>
      </div>
      <button id="startConnect" class="primary">Añadir API / API Connect</button>
    </section>

    <section id="screen-provider-picker" class="screen">
      <div class="titlebar">
        <div class="left">
          <h1>Agregar proveedor</h1>
          <p class="subtitle">La infraestructura interna empieza con Groq.</p>
        </div>
        <button id="pickerBack">Volver</button>
      </div>
      <button id="groqCard" class="card provider-card">
        <strong>Groq</strong>
        <span class="subtitle">API compatible con OpenAI, lista de modelos y chat por streaming.</span>
      </button>
    </section>

    <section id="screen-provider-config" class="screen">
      <div class="titlebar">
        <div class="left">
          <h1>Configuracion</h1>
          <p class="subtitle">Ingresa tu conexion Groq y marca los modelos habilitados.</p>
        </div>
        <button id="configBack">Volver</button>
      </div>
      <div class="panel card">
        <div class="actions">
          <label class="label">Nombre personalizado
            <input id="displayName" type="text" placeholder="Mi Groq principal" />
          </label>
          <label class="label">API
            <input id="apiKey" type="password" placeholder="gsk_..." />
          </label>
          <div class="tiny" id="modelsHint">Al ingresar la API key se cargaran los modelos disponibles.</div>
          <div id="providerError" class="notice" hidden></div>
          <div id="modelsWrap" class="models"></div>
          <div class="row two">
            <button id="refreshModels">Actualizar modelos</button>
            <button id="saveConnection" class="primary">Aceptar</button>
          </div>
        </div>
      </div>
    </section>

    <section id="screen-chat" class="screen chat-shell">
      <div class="titlebar">
        <div class="left">
          <h1>Atun Agent</h1>
          <p class="subtitle">Chat local conectado a tus proveedores.</p>
        </div>
        <button id="manageProviders">Administrar proveedores</button>
      </div>
      <div class="row two chat-toolbar">
        <select id="connectionSelect"></select>
        <select id="modelSelect"></select>
      </div>
      <div id="chatError" class="notice" hidden></div>
      <div id="messages" class="card messages"></div>
      <div class="panel card">
        <div class="actions">
          <textarea id="composer" placeholder="Escribe tu mensaje..."></textarea>
          <div class="row two">
            <button id="newChat">Nuevo chat</button>
            <button id="sendMessage" class="primary">Enviar</button>
          </div>
          <button id="openNativeChat" class="linklike">Abrir chat nativo (@atun)</button>
        </div>
      </div>
    </section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = {
      screen: 'onboarding',
      providerCards: [],
      draftConfig: { providerKind: 'groq', displayName: '', apiKey: '' },
      modelOptions: [],
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

    let validateTimer = undefined;

    const screens = {
      onboarding: document.getElementById('screen-onboarding'),
      providerPicker: document.getElementById('screen-provider-picker'),
      providerConfig: document.getElementById('screen-provider-config'),
      chat: document.getElementById('screen-chat')
    };

    const displayName = document.getElementById('displayName');
    const apiKey = document.getElementById('apiKey');
    const modelsWrap = document.getElementById('modelsWrap');
    const providerError = document.getElementById('providerError');
    const modelsHint = document.getElementById('modelsHint');
    const saveConnection = document.getElementById('saveConnection');
    const refreshModels = document.getElementById('refreshModels');
    const connectionSelect = document.getElementById('connectionSelect');
    const modelSelect = document.getElementById('modelSelect');
    const messages = document.getElementById('messages');
    const composer = document.getElementById('composer');
    const chatError = document.getElementById('chatError');
    const sendMessage = document.getElementById('sendMessage');
    const openNativeChat = document.getElementById('openNativeChat');

    function setScreen(next) {
      screens.onboarding.classList.toggle('active', next === 'onboarding');
      screens.providerPicker.classList.toggle('active', next === 'provider-picker');
      screens.providerConfig.classList.toggle('active', next === 'provider-config');
      screens.chat.classList.toggle('active', next === 'chat');
    }

    function renderProviderConfig() {
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
        empty.className = 'tiny';
        empty.textContent = state.isValidatingProvider ? 'Cargando modelos...' : 'Todavia no hay modelos cargados.';
        modelsWrap.appendChild(empty);
      } else {
        for (const model of state.modelOptions) {
          const row = document.createElement('label');
          row.className = 'model';

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

    function renderChat() {
      chatError.hidden = !state.error;
      chatError.textContent = state.error || '';

      connectionSelect.innerHTML = '';
      for (const connection of state.connections) {
        const option = document.createElement('option');
        option.value = connection.id;
        option.textContent = connection.displayName;
        connectionSelect.appendChild(option);
      }
      connectionSelect.value = state.activeConnectionId || '';
      connectionSelect.disabled = state.connections.length === 0 || state.isStreaming;

      modelSelect.innerHTML = '';
      for (const model of state.modelOptions) {
        if (!model.enabled) {
          continue;
        }
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.label;
        modelSelect.appendChild(option);
      }
      if (!modelSelect.options.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Sin modelos habilitados';
        modelSelect.appendChild(option);
      }
      modelSelect.value = state.selectedModelId || '';
      modelSelect.disabled = state.isStreaming || !state.selectedModelId;

      messages.innerHTML = '';
      if (!state.messages.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Todavia no hay mensajes. Envia el primero para arrancar el chat.';
        messages.appendChild(empty);
      } else {
        for (const item of state.messages) {
          const bubble = document.createElement('div');
          bubble.className = 'message ' + item.role + (item.errorText ? ' error' : '');
          bubble.textContent = item.content || (item.role === 'assistant' && state.isStreaming ? '...' : '');
          messages.appendChild(bubble);
        }
        messages.scrollTop = messages.scrollHeight;
      }

      const canSend = !state.isStreaming && Boolean(state.selectedModelId) && composer.value.trim().length > 0;
      sendMessage.disabled = !canSend;
      openNativeChat.hidden = !(state.nativeChatAvailable && state.connections.length > 0);
      openNativeChat.disabled = state.isStreaming;
    }

    function render() {
      setScreen(state.screen);
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

    document.getElementById('startConnect').addEventListener('click', () => {
      vscode.postMessage({ type: 'openProviderPicker' });
    });
    document.getElementById('pickerBack').addEventListener('click', () => {
      vscode.postMessage({ type: 'back' });
    });
    document.getElementById('configBack').addEventListener('click', () => {
      vscode.postMessage({ type: 'back' });
    });
    document.getElementById('groqCard').addEventListener('click', () => {
      vscode.postMessage({ type: 'chooseProvider', providerKind: 'groq' });
    });
    document.getElementById('manageProviders').addEventListener('click', () => {
      vscode.postMessage({ type: 'openProviderManager' });
    });
    document.getElementById('newChat').addEventListener('click', () => {
      vscode.postMessage({ type: 'newChat' });
    });
    openNativeChat.addEventListener('click', () => {
      vscode.postMessage({ type: 'openNativeChat' });
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

    connectionSelect.addEventListener('change', () => {
      vscode.postMessage({ type: 'setActiveConnection', connectionId: connectionSelect.value });
    });
    modelSelect.addEventListener('change', () => {
      vscode.postMessage({ type: 'setSelectedModel', modelId: modelSelect.value });
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

    function sendCurrentPrompt() {
      const content = composer.value.trim();
      if (!content) {
        return;
      }
      vscode.postMessage({ type: 'sendChatMessage', content });
      composer.value = '';
      renderChat();
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
