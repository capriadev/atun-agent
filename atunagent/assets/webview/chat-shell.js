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
  composerExpanded: false,
  manualComposerHeight: undefined
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
const accessModeSelect = document.getElementById('accessModeSelect');
const agentModeSelect = document.getElementById('agentModeSelect');
const reasoningSelect = document.getElementById('reasoningSelect');
const insertButtons = Array.from(document.querySelectorAll('[data-insert]'));

function getComposerLineHeight() {
  const computed = window.getComputedStyle(composer);
  return Number.parseFloat(computed.lineHeight) || 20;
}

function getComposerBounds() {
  const lineHeight = getComposerLineHeight();
  return {
    minHeight: lineHeight * 4,
    maxHeight: lineHeight * 10
  };
}

function applyComposerHeight(nextHeight) {
  const { minHeight, maxHeight } = getComposerBounds();
  const clampedHeight = Math.max(minHeight, Math.min(nextHeight, maxHeight));
  composer.style.height = clampedHeight + 'px';
  composer.style.maxHeight = ui.composerExpanded ? '100%' : maxHeight + 'px';
  composer.style.overflowY = composer.scrollHeight > clampedHeight ? 'auto' : 'hidden';
}

function autoResizeComposer(force = false) {
  if (ui.manualComposerHeight && !force) {
    applyComposerHeight(ui.manualComposerHeight);
    return;
  }

  composer.style.height = 'auto';
  applyComposerHeight(composer.scrollHeight);
}

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
    option.textContent = 'Sin modelos';
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
  renderGroupedModelSelect();
  renderMessages();

  const inputTokens = estimateInputTokens();
  const contextPercent = estimateContextPercent();
  tokenCount.textContent = inputTokens + ' tk';
  contextMeter.textContent = contextPercent + '%';

  const canSend = !state.isStreaming
    && Boolean(state.selectedModelId)
    && Boolean(composer.value.trim());
  sendMessage.disabled = !canSend;
  openNativeChat.hidden = !(state.nativeChatAvailable && state.connections.length > 0);
  openNativeChat.disabled = state.isStreaming;
  composer.disabled = state.isStreaming || !state.modelSelectorOptions.length;
  toggleComposerSize.disabled = state.isStreaming;
  accessModeSelect.disabled = true;
  agentModeSelect.disabled = true;
  reasoningSelect.disabled = true;

  autoResizeComposer();
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
  ui.manualComposerHeight = undefined;
  renderChat();
}

function insertComposerToken(token) {
  const prefix = composer.value && !composer.value.endsWith(' ') ? ' ' : '';
  composer.value = composer.value + prefix + token;
  composer.focus();
  ui.manualComposerHeight = undefined;
  renderChat();
}

function toggleComposerExpanded() {
  ui.composerExpanded = !ui.composerExpanded;
  if (!ui.composerExpanded) {
    ui.manualComposerHeight = undefined;
  }
  renderChat();
}

function toggleComposerHeightPreset() {
  const { minHeight, maxHeight } = getComposerBounds();
  const currentHeight = Math.round(composer.getBoundingClientRect().height);
  ui.manualComposerHeight = Math.abs(currentHeight - maxHeight) < 8 ? minHeight : maxHeight;
  applyComposerHeight(ui.manualComposerHeight);
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
  toggleComposerExpanded();
});

toggleComposerSize.addEventListener('dblclick', (event) => {
  event.preventDefault();
  toggleComposerHeightPreset();
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
  if (!ui.manualComposerHeight) {
    autoResizeComposer(true);
  }
  renderChat();
});

composer.addEventListener('mouseup', () => {
  const currentHeight = Math.round(composer.getBoundingClientRect().height);
  const autoHeight = Math.round(composer.scrollHeight);
  ui.manualComposerHeight = Math.abs(currentHeight - autoHeight) > 6 ? currentHeight : undefined;
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

window.addEventListener('load', () => {
  autoResizeComposer(true);
});

vscode.postMessage({ type: 'ready' });
