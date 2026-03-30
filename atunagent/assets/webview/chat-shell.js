// chat-shell.js — Atun Agent v2.4.0
'use strict';

const vscode = acquireVsCodeApi();

/* ── Estado ─────────────────────────────────────────────────────────── */
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
  nativeChatAvailable: false,
};

const ui = {
  composerExpanded: false,
  manualHeight: undefined,     // altura fijada por arrastre
  ctxPopupOpen: false,
  accessValue: 'full',
  agentValue:  'agent',
  reasoningValue: 'off',
};

let validateTimer;

/* ── Refs DOM ────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const setupPanel       = $('setupPanel');
const setupSubtitle    = $('setupSubtitle');
const closeSetup       = $('closeSetup');
const displayNameInput = $('displayName');
const apiKeyInput      = $('apiKey');
const modelsWrap       = $('modelsWrap');
const providerError    = $('providerError');
const modelsHint       = $('modelsHint');
const saveConnection   = $('saveConnection');
const refreshModels    = $('refreshModels');
const messagesEl       = $('messages');
const emptyState       = $('emptyState');
const composerShell    = $('composerShell');
const composer         = $('composer');
const resizeHandle     = $('composerResizeHandle');
const tokenCount       = $('tokenCount');
const contextMeter     = $('contextMeter');
const chatError        = $('chatError');
const modelSelect      = $('modelSelect');
const sendMessage      = $('sendMessage');

// Context popup
const ctxWrap          = $('ctxWrap');
const ctxMeterBtn      = $('ctxMeterBtn');
const ctxPopup         = $('ctxPopup');
const popupTokens      = $('popupTokens');
const popupFill        = $('popupFill');
const popupPct         = $('popupPct');
const btnCompactCtx    = $('btnCompactCtx');

// Custom selects
const cselAccess    = $('cselAccess');
const cselAgent     = $('cselAgent');
const cselReasoning = $('cselReasoning');
const cselModel     = $('cselModel');

const accessLabel    = $('cselAccessLabel');
const agentLabel     = $('cselAgentLabel');
const reasoningLabel = $('cselReasoningLabel');

const accessDropdown    = $('cselAccessDropdown');
const agentDropdown     = $('cselAgentDropdown');
const reasoningDropdown = $('cselReasoningDropdown');

// Buttons # / @
const insertButtons = Array.from(document.querySelectorAll('[data-insert]'));

/* ── Resize del composer ─────────────────────────────────────────────── */
const LINE_H = 20;
const MIN_ROWS = 4;
const MAX_ROWS = 10;

function minH() { return LINE_H * MIN_ROWS; }
function maxH() { return LINE_H * MAX_ROWS; }

function setComposerHeight(px) {
  const clamped = Math.max(minH(), Math.min(px, ui.composerExpanded ? 99999 : maxH()));
  composer.style.height = clamped + 'px';
  composer.style.overflowY = composer.scrollHeight > clamped ? 'auto' : 'hidden';
}

function autoResize(force = false) {
  if (ui.manualHeight && !force) { setComposerHeight(ui.manualHeight); return; }
  composer.style.height = 'auto';
  setComposerHeight(composer.scrollHeight);
}

// Doble clic en handle: expand completo ↔ volver a auto
resizeHandle.addEventListener('dblclick', (e) => {
  e.preventDefault();
  if (ui.composerExpanded) {
    // Si estaba expandido: contraer al contenido real o al mínimo
    ui.composerExpanded = false;
    ui.manualHeight = undefined;
    composerShell.classList.remove('expanded');
    composer.style.maxHeight = maxH() + 'px';
    autoResize(true);
  } else {
    // Expandir al 100%
    ui.composerExpanded = true;
    composerShell.classList.add('expanded');
    composer.style.maxHeight = '100%';
    composer.style.height = '100%';
  }
});

// Un solo clic cuando expandido → contraer al contenido
resizeHandle.addEventListener('click', (e) => {
  if (e.detail > 1) return; // ignorar si es parte de doble clic
  if (!ui.composerExpanded) return;
  ui.composerExpanded = false;
  composerShell.classList.remove('expanded');
  composer.style.maxHeight = maxH() + 'px';
  ui.manualHeight = undefined;
  autoResize(true);
});

// Arrastre del handle
let dragStartY = 0;
let dragStartH = 0;
let isDragging = false;

resizeHandle.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  dragStartY = e.clientY;
  dragStartH = composer.getBoundingClientRect().height;
  document.body.style.cursor = 'ns-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const delta = dragStartY - e.clientY; // arrastrar hacia arriba aumenta altura
  const next = Math.max(minH(), dragStartH + delta);
  ui.manualHeight = next;
  ui.composerExpanded = false;
  composerShell.classList.remove('expanded');
  composer.style.maxHeight = maxH() + 'px';
  setComposerHeight(next);
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  document.body.style.cursor = '';
});

/* ── Estimación de tokens ────────────────────────────────────────────── */
function estimateInputTokens() {
  const chars = composer.value.trim().length;
  return chars ? Math.max(1, Math.ceil(chars / 4)) : 0;
}

function estimateContext() {
  const transcriptChars = state.messages.reduce((t, m) => t + (m.content || '').length, 0);
  const totalChars = transcriptChars + composer.value.length;
  const estTokens = Math.max(0, Math.ceil(totalChars / 4));
  const MAX_CTX = 256000;
  const percent = Math.min(100, Math.round((estTokens / MAX_CTX) * 100));
  const kTokens = estTokens >= 1000
    ? (estTokens / 1000).toFixed(0) + 'k'
    : String(estTokens);
  return { percent, kTokens, estTokens };
}

/* ── Context popup (toggle por click) ───────────────────────────────── */
function openCtxPopup() {
  ui.ctxPopupOpen = true;
  ctxPopup.hidden = false;
  ctxWrap.classList.add('popup-open');
}

function closeCtxPopup() {
  ui.ctxPopupOpen = false;
  ctxPopup.hidden = true;
  ctxWrap.classList.remove('popup-open');
}

ctxMeterBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  ui.ctxPopupOpen ? closeCtxPopup() : openCtxPopup();
});

document.addEventListener('click', (e) => {
  if (ui.ctxPopupOpen && !ctxWrap.contains(e.target)) {
    closeCtxPopup();
  }
});

if (btnCompactCtx) {
  btnCompactCtx.addEventListener('click', () => {
    vscode.postMessage({ type: 'compactContext' });
    closeCtxPopup();
  });
}

/* ── Custom selects ─────────────────────────────────────────────────── */
const allCsels = [cselAccess, cselAgent, cselReasoning];

function closeCsel(el) {
  if (!el) return;
  el.classList.remove('open');
}

function closeAllCsels(except) {
  allCsels.forEach(c => { if (c && c !== except) closeCsel(c); });
}

function toggleCsel(el) {
  const isOpen = el.classList.contains('open');
  closeAllCsels(el);
  isOpen ? closeCsel(el) : el.classList.add('open');
}

allCsels.forEach(csel => {
  if (!csel) return;
  csel.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCsel(csel);
  });
});

document.addEventListener('click', () => closeAllCsels(null));

// Seleccionar opción en csel-option
function bindCselOptions(dropdown, labelEl, onSelect) {
  if (!dropdown) return;
  dropdown.querySelectorAll('.csel-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = btn.dataset.value;
      dropdown.querySelectorAll('.csel-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (labelEl) labelEl.textContent = btn.querySelector('.csel-opt-text')?.textContent ?? btn.textContent.trim();
      onSelect(val);
      closeAllCsels(null);
    });
  });
}

bindCselOptions(accessDropdown, accessLabel, (val) => {
  ui.accessValue = val;
  // stub: notificar backend cuando se implemente
});

bindCselOptions(agentDropdown, agentLabel, (val) => {
  ui.agentValue = val;
  // stub: notificar backend
});

bindCselOptions(reasoningDropdown, reasoningLabel, (val) => {
  ui.reasoningValue = val;
  // stub: notificar backend
});

/* ── Selector de modelo (nativo) ────────────────────────────────────── */
function renderGroupedModelSelect() {
  const selectedValue = state.activeConnectionId && state.selectedModelId
    ? state.activeConnectionId + '::' + state.selectedModelId
    : '';

  modelSelect.innerHTML = '';

  if (!state.modelSelectorOptions.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Sin modelos';
    modelSelect.appendChild(opt);
    modelSelect.disabled = true;
    return;
  }

  const groups = new Map();
  for (const entry of state.modelSelectorOptions) {
    if (!groups.has(entry.connectionLabel)) groups.set(entry.connectionLabel, []);
    groups.get(entry.connectionLabel).push(entry);
  }

  for (const [label, items] of groups) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const item of items) {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.modelLabel;
      group.appendChild(opt);
    }
    modelSelect.appendChild(group);
  }

  modelSelect.value = selectedValue;
  if (modelSelect.value !== selectedValue && modelSelect.options.length > 0) {
    modelSelect.selectedIndex = 0;
  }
  modelSelect.disabled = state.isStreaming || !state.modelSelectorOptions.length;
}

modelSelect.addEventListener('change', () => {
  const parts = (modelSelect.value || '').split('::');
  if (parts.length < 2) return;
  vscode.postMessage({ type: 'setModelSelection', connectionId: parts[0], modelId: parts[1] });
});

/* ── Render provider config ─────────────────────────────────────────── */
function renderProviderConfig() {
  const showSetup = state.connections.length === 0 || state.screen !== 'chat';
  setupPanel.hidden = !showSetup;
  closeSetup.hidden = state.connections.length === 0;
  setupSubtitle.textContent = state.connections.length === 0
    ? 'Conecta Groq y habilita al menos un modelo para empezar.'
    : 'Agrega otra conexión o ajusta los modelos habilitados.';

  displayNameInput.value = state.draftConfig.displayName || '';
  apiKeyInput.value      = state.draftConfig.apiKey || '';
  providerError.hidden   = !state.error;
  providerError.textContent = state.error || '';
  modelsHint.textContent = state.isValidatingProvider
    ? 'Consultando modelos en Groq...'
    : 'Al ingresar la API key se cargarán los modelos disponibles.';

  modelsWrap.innerHTML = '';
  if (!state.modelOptions.length) {
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.textContent = state.isValidatingProvider ? 'Cargando modelos...' : 'Todavía no hay modelos cargados.';
    modelsWrap.appendChild(empty);
  } else {
    for (const model of state.modelOptions) {
      const row = document.createElement('label');
      row.className = 'model-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = Boolean(model.enabled);
      cb.disabled = state.isValidatingProvider;
      cb.addEventListener('change', () => {
        vscode.postMessage({ type: 'toggleDraftModel', modelId: model.id });
      });
      const text = document.createElement('span');
      text.textContent = model.label;
      row.appendChild(cb);
      row.appendChild(text);
      modelsWrap.appendChild(row);
    }
  }

  const canAccept = Boolean(state.draftConfig.displayName.trim())
    && state.modelOptions.some(m => m.enabled)
    && !state.isValidatingProvider
    && !state.error;
  saveConnection.disabled  = !canAccept;
  refreshModels.disabled   = state.isValidatingProvider || !state.draftConfig.apiKey.trim();
}

/* ── Render mensajes ────────────────────────────────────────────────── */
function renderMessages() {
  const hasMessages = state.messages.length > 0;
  emptyState.hidden   = hasMessages;
  messagesEl.hidden   = !hasMessages;
  messagesEl.innerHTML = '';

  if (!hasMessages) return;

  for (const item of state.messages) {
    const bubble = document.createElement('div');
    bubble.className = 'message ' + item.role + (item.errorText ? ' error' : '');
    bubble.textContent = item.content || (item.role === 'assistant' && state.isStreaming ? '…' : '');
    messagesEl.appendChild(bubble);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ── Render chat ────────────────────────────────────────────────────── */
function renderChat() {
  chatError.hidden = !state.error || state.screen !== 'chat';
  chatError.textContent = state.error || '';

  renderGroupedModelSelect();
  renderMessages();

  // Tokens e indicador de contexto
  const inputTok = estimateInputTokens();
  const ctx      = estimateContext();

  tokenCount.textContent  = inputTok ? inputTok + ' tok' : '0';
  contextMeter.textContent = ctx.percent + '%';

  if (popupTokens) popupTokens.textContent = ctx.kTokens + ' / 256k';
  if (popupFill)   popupFill.style.width    = ctx.percent + '%';
  if (popupPct)    popupPct.textContent      = ctx.percent + '%';

  // Estados de controles
  const canSend = !state.isStreaming
    && Boolean(state.selectedModelId)
    && Boolean(composer.value.trim());

  sendMessage.disabled = !canSend;
  composer.disabled    = state.isStreaming || !state.modelSelectorOptions.length;

  autoResize();
}

function render() {
  renderProviderConfig();
  renderChat();
}

/* ── Enviar mensaje ─────────────────────────────────────────────────── */
function sendCurrentPrompt() {
  const content = composer.value.trim();
  if (!content) return;
  vscode.postMessage({ type: 'sendChatMessage', content });
  composer.value    = '';
  ui.manualHeight   = undefined;
  renderChat();
}

/* ── Insertar token en composer ─────────────────────────────────────── */
function insertComposerToken(token) {
  const prefix = composer.value && !composer.value.endsWith(' ') ? ' ' : '';
  composer.value += prefix + token;
  composer.focus();
  ui.manualHeight = undefined;
  renderChat();
}

/* ── Eventos provider config ─────────────────────────────────────────── */
function scheduleValidation() {
  if (validateTimer) clearTimeout(validateTimer);
  validateTimer = setTimeout(() => {
    if (apiKeyInput.value.trim()) vscode.postMessage({ type: 'validateProviderDraft' });
  }, 450);
}

closeSetup.addEventListener('click', () => vscode.postMessage({ type: 'back' }));

displayNameInput.addEventListener('input', () => {
  vscode.postMessage({ type: 'updateProviderDraft', patch: { displayName: displayNameInput.value } });
});

apiKeyInput.addEventListener('input', () => {
  vscode.postMessage({ type: 'updateProviderDraft', patch: { apiKey: apiKeyInput.value } });
  scheduleValidation();
});

refreshModels.addEventListener('click', () => vscode.postMessage({ type: 'validateProviderDraft' }));
saveConnection.addEventListener('click', () => vscode.postMessage({ type: 'saveProviderConnection' }));

/* ── Eventos composer ───────────────────────────────────────────────── */
composer.addEventListener('input', () => {
  if (!ui.manualHeight) autoResize(true);
  renderChat();
});

composer.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !sendMessage.disabled) {
    e.preventDefault();
    sendCurrentPrompt();
  }
});

sendMessage.addEventListener('click', sendCurrentPrompt);

for (const btn of insertButtons) {
  btn.addEventListener('click', () => {
    const token = btn.getAttribute('data-insert') || '';
    if (token) insertComposerToken(token);
  });
}

/* ── Mensajes desde el host ─────────────────────────────────────────── */
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'state') return;
  Object.assign(state, event.data);
  render();
});

window.addEventListener('load', () => autoResize(true));

vscode.postMessage({ type: 'ready' });
