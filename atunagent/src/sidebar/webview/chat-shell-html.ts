import * as vscode from 'vscode';

export function createChatShellHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'webview', 'chat-shell.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'webview', 'chat-shell.js'));
	const logoMarkup = getLogoMarkup();
	const fullAccessIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icons', 'full-access.svg'));
	const agentIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icons', 'agent-agent.svg'));
	const modelIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icons', 'model.svg'));
	const reasoningIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icons', 'thinking.svg'));
	const hashIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icons', 'hash.svg'));
	const slashIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icons', 'slash.svg'));
	const atIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'icons', 'at.svg'));

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atun Agent</title>
  <link rel="stylesheet" href="${styleUri}" />
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
            <span class="empty-title">ATUN</span>
            <span class="empty-title">AGENT</span>
          </div>
          <p class="empty-copy">Escribe el primer mensaje para empezar el chat local con el modelo seleccionado.</p>
        </div>
        <div id="messages" class="messages"></div>
      </div>
      <div id="composerShell" class="composer-shell">
        <div class="composer-toolbar">
          <div class="prompt-actions">
            <button class="micro-button" data-insert="#" title="Adjuntar o mencionar contexto"><img src="${hashIconUri}" alt="" /></button>
            <button class="micro-button" data-insert="/" title="Invocar skills"><img src="${slashIconUri}" alt="" /></button>
            <button class="micro-button" data-insert="@" title="Invocar MCP"><img src="${atIconUri}" alt="" /></button>
          </div>
          <div class="composer-stats">
            <span id="tokenCount" class="stat">0 tok</span>
            <button id="sendMessage" class="send-button" title="Enviar mensaje">&#10148;</button>
          </div>
        </div>
        <div class="composer-frame">
          <button id="toggleComposerSize" class="expand-button" title="Expandir o contraer input">&#8597;</button>
          <textarea id="composer" class="composer-input scrollable" rows="4" placeholder="Escribe tu mensaje..."></textarea>
        </div>
        <div class="footer-controls">
          <div class="footer-left">
            <label class="control-select">
              <img class="control-icon" src="${fullAccessIconUri}" alt="" />
              <select id="accessModeSelect" class="mini-select">
                <option>Full Access</option>
                <option>Approval Required</option>
              </select>
            </label>
            <label class="control-select">
              <img class="control-icon" src="${agentIconUri}" alt="" />
              <select id="agentModeSelect" class="mini-select">
                <option>Agent</option>
                <option>Ask</option>
                <option>Plan</option>
                <option>Git</option>
                <option>Docs</option>
              </select>
            </label>
            <label class="control-select model-select-wrap">
              <img class="control-icon" src="${modelIconUri}" alt="" />
              <select id="modelSelect" class="mini-select"></select>
            </label>
            <label class="control-select">
              <img class="control-icon" src="${reasoningIconUri}" alt="" />
              <select id="reasoningSelect" class="mini-select">
                <option>Off</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </label>
          </div>
          <div class="footer-right">
            <div id="contextMeter" class="context-meter">0% contexto</div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

function getLogoMarkup(): string {
	return [
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
		'<path d="M2 16s9-15 20-4C11 23 2 8 2 8"/>',
		'</svg>',
	].join('');
}
