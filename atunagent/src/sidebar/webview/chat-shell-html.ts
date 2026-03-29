import * as vscode from 'vscode';

export function createChatShellHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'webview', 'chat-shell.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'webview', 'chat-shell.js'));
	const logoMarkup = getLogoMarkup();

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
