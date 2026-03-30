import * as vscode from 'vscode';

export function createChatShellHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'webview', 'chat-shell.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'webview', 'chat-shell.js'));
	const logoMarkup = getLogoMarkup();

	// Inline SVG content for icons used in custom selects (bypass img CSP issues with inline)
	const svgFullAccess = getInlineSvg('shield-alert');
	const svgIsolated   = getInlineSvg('shield-check');
	const svgAgent      = getInlineSvg('agent');
	const svgModel      = getInlineSvg('model');
	const svgThinking   = getInlineSvg('thinking');
	const svgHash       = getInlineSvg('hash');
	const svgSlash      = getInlineSvg('slash');
	const svgAt         = getInlineSvg('at');
	const svgSend       = getInlineSvg('send');
	const svgChevron    = getInlineSvg('chevron');

	return `<!DOCTYPE html>
<html lang="es">
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

      <!-- Panel de configuración de proveedor -->
      <div id="setupPanel" class="surface config-panel setup-panel" hidden>
        <div class="toolbar-row">
          <div class="stack">
            <span class="logo-mark" aria-hidden="true">${logoMarkup}</span>
            <h1>Atun Agent</h1>
            <p id="setupSubtitle" class="subtitle">Conecta Groq y habilita al menos un modelo para empezar.</p>
          </div>
          <button id="closeSetup" class="btn-lite">Volver</button>
        </div>
        <div class="field">
          <label for="displayName">Nombre personalizado</label>
          <input id="displayName" class="text-input" type="text" placeholder="Groq Juan" />
        </div>
        <div class="field">
          <label for="apiKey">API Key</label>
          <input id="apiKey" class="text-input" type="password" placeholder="gsk_..." />
        </div>
        <div id="modelsHint" class="hint">Al ingresar la API key se cargarán los modelos disponibles.</div>
        <div id="providerError" class="notice" hidden></div>
        <div id="modelsWrap" class="models"></div>
        <div class="button-row">
          <button id="refreshModels" class="button">Actualizar modelos</button>
          <button id="saveConnection" class="button primary">Aceptar</button>
        </div>
      </div>

      <div id="chatError" class="notice" hidden></div>

      <!-- Historial de mensajes -->
      <div class="history-shell">
        <div id="emptyState" class="history-empty">
          <span class="logo-mark empty-logo" aria-hidden="true">${logoMarkup}</span>
          <p class="empty-label">ATUN AGENT</p>
          <p class="empty-hint">Escribe el primer mensaje para comenzar.</p>
        </div>
        <div id="messages" class="messages" hidden></div>
      </div>

      <!-- Composer -->
      <div id="composerShell" class="composer-shell">

        <!-- Handle de resize (arriba del textarea) -->
        <div class="composer-resize-handle" id="composerResizeHandle" title="Arrastrá para redimensionar · Doble click expande/contrae">
          <span class="resize-dots">···</span>
        </div>

        <!-- Textarea -->
        <textarea
          id="composer"
          class="composer-input"
          placeholder="Escribe tu mensaje..."
          rows="4"
        ></textarea>

        <!-- Fila de acciones (bajo el textarea) -->
        <div class="actions-bar">
          <div class="actions-left">
            <button class="action-btn" id="btnHash" data-insert="#" title="Adjuntar archivo o mencionar contexto del workspace">
              ${svgHash}
            </button>
            <button class="action-btn" id="btnSlash" data-insert="/" title="Invocar skills — se pueden activar múltiples">
              ${svgSlash}
            </button>
            <button class="action-btn" id="btnAt" data-insert="@" title="Activar MCP — se pueden activar múltiples">
              ${svgAt}
            </button>
          </div>
          <div class="actions-right">
            <span id="tokenCount" class="token-stat" title="Tokens estimados en el input">0</span>
            <button id="sendMessage" class="send-btn" title="Enviar mensaje (Ctrl+Enter)">
              ${svgSend}
            </button>
          </div>
        </div>

        <!-- Barra de controles inferior -->
        <div class="controls-bar">
          <div class="controls-left">

            <!-- Selector: Nivel de acceso -->
            <div class="csel" id="cselAccess" data-csel="access" title="Nivel de acceso">
              <span class="csel-icon">${svgFullAccess}</span>
              <span class="csel-label" id="cselAccessLabel">Full Access</span>
              <span class="csel-chevron">${svgChevron}</span>
              <div class="csel-dropdown" id="cselAccessDropdown">
                <button class="csel-option active" data-value="full">
                  <span class="csel-opt-icon">${svgFullAccess}</span>
                  <span class="csel-opt-text">Full Access</span>
                </button>
                <button class="csel-option" data-value="approval">
                  <span class="csel-opt-icon">${svgIsolated}</span>
                  <span class="csel-opt-text">Approval Required</span>
                </button>
              </div>
            </div>

            <!-- Selector: Modo del agente -->
            <div class="csel" id="cselAgent" data-csel="agent" title="Modo agente">
              <span class="csel-icon">${svgAgent}</span>
              <span class="csel-label" id="cselAgentLabel">Agent</span>
              <span class="csel-chevron">${svgChevron}</span>
              <div class="csel-dropdown" id="cselAgentDropdown">
                <button class="csel-option active" data-value="agent">
                  <span class="csel-opt-text">Agent</span>
                </button>
                <button class="csel-option" data-value="ask">
                  <span class="csel-opt-text">Ask</span>
                </button>
                <button class="csel-option" data-value="plan">
                  <span class="csel-opt-text">Plan</span>
                </button>
                <button class="csel-option" data-value="git">
                  <span class="csel-opt-text">Git</span>
                </button>
                <button class="csel-option" data-value="docs">
                  <span class="csel-opt-text">Docs</span>
                </button>
                <button class="csel-option" data-value="docs-translator">
                  <span class="csel-opt-text">Docs Translator</span>
                </button>
              </div>
            </div>

            <!-- Selector: Modelo (usa <select> real agrupado, estilizado) -->
            <div class="csel csel-model" id="cselModel" data-csel="model" title="Modelo de lenguaje">
              <span class="csel-icon">${svgModel}</span>
              <select id="modelSelect" class="csel-native-select">
              </select>
              <span class="csel-chevron">${svgChevron}</span>
            </div>

            <!-- Selector: Razonamiento -->
            <div class="csel" id="cselReasoning" data-csel="reasoning" title="Nivel de razonamiento">
              <span class="csel-icon">${svgThinking}</span>
              <span class="csel-label" id="cselReasoningLabel">Off</span>
              <span class="csel-chevron">${svgChevron}</span>
              <div class="csel-dropdown" id="cselReasoningDropdown">
                <button class="csel-option active" data-value="off">Off</button>
                <button class="csel-option" data-value="low">Low</button>
                <button class="csel-option" data-value="medium">Medium</button>
                <button class="csel-option" data-value="high">High</button>
              </div>
            </div>

          </div>
          <div class="controls-right">
            <!-- Medidor de contexto con popup persistente (toggle) -->
            <div class="ctx-wrap" id="ctxWrap">
              <button class="ctx-meter-btn" id="ctxMeterBtn" title="Ver uso de contexto">
                <span id="contextMeter">0%</span>
              </button>
              <div class="ctx-popup" id="ctxPopup" hidden>
                <div class="ctx-popup-title">Uso de contexto</div>
                <div class="ctx-popup-tokens"><span id="popupTokens">0k</span> / 256k</div>
                <div class="ctx-popup-bar-wrap">
                  <div class="ctx-popup-bar">
                    <div id="popupFill" class="ctx-popup-fill" style="width:0%"></div>
                  </div>
                  <span class="ctx-popup-pct" id="popupPct">0%</span>
                </div>
                <button class="ctx-popup-action" id="btnCompactCtx">Compactar contexto</button>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /composer-shell -->
    </div><!-- /chat-shell -->
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

function getInlineSvg(name: string): string {
	const svgs: Record<string, string> = {
		'shield-alert': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
		'shield-check':  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
		'agent':         '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="m17 7 5 5-5 5"/><path d="m7 7-5 5 5 5"/><path d="M8 12h.01"/></svg>',
		'model':         '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
		'thinking':      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>',
		'hash':          '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>',
		'slash':         '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 2 22"/></svg>',
		'at':            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>',
		'send':          '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/></svg>',
		'chevron':       '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
	};
	return svgs[name] ?? '';
}
