import * as vscode from 'vscode';
import { LocalDatabase } from './local-database';
import { ProviderRegistry } from './provider-registry';
import type {
	ChatCompletionInputMessage,
	ChatMessageRecord,
	ChatSessionRecord,
	ModelSelectOption,
	ProviderDraftConfig,
	ProviderModel,
	SidebarScreen,
	SidebarViewState,
} from './types';

const DEFAULT_DRAFT: ProviderDraftConfig = {
	providerKind: 'groq',
	displayName: '',
	apiKey: '',
};

export class SidebarViewModel {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();

	private screen: SidebarScreen = 'onboarding';
	private draftConfig: ProviderDraftConfig = { ...DEFAULT_DRAFT };
	private modelOptions: ProviderModel[] = [];
	private connections = [] as SidebarViewState['connections'];
	private activeConnectionId: string | undefined;
	private selectedModelId: string | undefined;
	private chatSession: ChatSessionRecord | undefined;
	private messages: ChatMessageRecord[] = [];
	private isValidatingProvider = false;
	private isStreaming = false;
	private error: string | undefined;
	private streamAbortController: AbortController | undefined;

	public readonly onDidChange = this.onDidChangeEmitter.event;

	public constructor(
		private readonly database: LocalDatabase,
		private readonly providers: ProviderRegistry,
		private readonly nativeChatAvailable: boolean,
	) {}

	public async initialize(): Promise<void> {
		await this.refreshFromStorage();
	}

	public async getState(): Promise<SidebarViewState> {
		await this.ensureScreenMatchesStorage();
		const modelSelectorOptions = await this.buildModelSelectorOptions();
		return {
			screen: this.screen,
			providerCards: this.providers.listSupportedProviders(),
			draftConfig: this.draftConfig,
			modelOptions: this.modelOptions,
			modelSelectorOptions,
			connections: this.connections,
			activeConnectionId: this.activeConnectionId,
			selectedModelId: this.selectedModelId,
			chatSession: this.chatSession,
			messages: this.messages,
			isValidatingProvider: this.isValidatingProvider,
			isStreaming: this.isStreaming,
			error: this.error,
			nativeChatAvailable: this.nativeChatAvailable,
		};
	}

	public async openProviderPicker(): Promise<void> {
		this.error = undefined;
		const providerCards = this.providers.listSupportedProviders();
		if (providerCards.length === 1) {
			await this.chooseProvider(providerCards[0].kind);
			return;
		}
		this.screen = 'provider-picker';
		this.emitDidChange();
	}

	public async chooseProvider(providerKind: ProviderDraftConfig['providerKind']): Promise<void> {
		this.error = undefined;
		this.modelOptions = [];
		this.draftConfig = {
			providerKind,
			displayName: providerKind === 'groq' ? 'Groq' : '',
			apiKey: '',
		};
		this.screen = 'provider-config';
		this.emitDidChange();
	}

	public async goBack(): Promise<void> {
		this.error = undefined;
		if (this.screen === 'provider-config') {
			this.screen = this.connections.length > 0 ? 'chat' : 'onboarding';
		} else if (this.screen === 'provider-picker') {
			this.screen = this.connections.length > 0 ? 'chat' : 'onboarding';
		}
		this.emitDidChange();
	}

	public async updateProviderDraft(patch: Partial<ProviderDraftConfig>): Promise<void> {
		const apiKeyChanged = patch.apiKey !== undefined && patch.apiKey !== this.draftConfig.apiKey;
		this.draftConfig = { ...this.draftConfig, ...patch };
		if (apiKeyChanged) {
			this.modelOptions = [];
			this.error = undefined;
		}
		this.emitDidChange();
	}

	public async validateProviderDraft(): Promise<void> {
		const apiKey = this.draftConfig.apiKey.trim();
		if (!apiKey) {
			this.modelOptions = [];
			this.error = undefined;
			this.emitDidChange();
			return;
		}

		this.isValidatingProvider = true;
		this.error = undefined;
		this.emitDidChange();

		const previousSelection = new Set(
			this.modelOptions.filter((model) => model.enabled).map((model) => model.id),
		);

		const result = await this.providers.validateAndListModels(this.draftConfig);
		this.isValidatingProvider = false;
		if (!result.ok) {
			this.modelOptions = [];
			this.error = result.error;
			this.emitDidChange();
			return;
		}

		this.modelOptions = result.models.map((model) => ({
			...model,
			enabled: previousSelection.has(model.id),
		}));
		this.emitDidChange();
	}

	public async toggleDraftModel(modelId: string): Promise<void> {
		this.modelOptions = this.modelOptions.map((model) => (
			model.id === modelId
				? { ...model, enabled: !model.enabled }
				: model
		));
		this.emitDidChange();
	}

	public async saveProviderConnection(): Promise<void> {
		const enabledModelIds = this.modelOptions
			.filter((model) => model.enabled)
			.map((model) => model.id);
		const connection = await this.providers.createConnection(this.draftConfig, enabledModelIds);
		await this.providers.setActiveConnection(connection.id);
		await this.loadConnectionChat(connection.id, true);
		this.resetDraft();
		this.screen = 'chat';
		this.error = undefined;
		this.emitDidChange();
	}

	public async setActiveConnection(connectionId: string): Promise<void> {
		if (connectionId === this.activeConnectionId) {
			return;
		}

		await this.providers.setActiveConnection(connectionId);
		await this.loadConnectionChat(connectionId, false);
		this.screen = 'chat';
		this.error = undefined;
		this.emitDidChange();
	}

	public async setSelectedModel(modelId: string): Promise<void> {
		this.selectedModelId = modelId || undefined;
		if (this.chatSession) {
			await this.database.updateSessionSelectedModel(this.chatSession.id, this.selectedModelId);
			this.chatSession = { ...this.chatSession, selectedModelId: this.selectedModelId };
		}
		this.emitDidChange();
	}

	public async setModelSelection(connectionId: string, modelId: string): Promise<void> {
		if (!connectionId || !modelId) {
			return;
		}

		if (connectionId !== this.activeConnectionId) {
			await this.providers.setActiveConnection(connectionId);
			await this.loadConnectionChat(connectionId, true);
		}

		await this.setSelectedModel(modelId);
	}

	public async newChat(): Promise<void> {
		if (!this.activeConnectionId) {
			return;
		}

		const models = await this.providers.listEnabledModels(this.activeConnectionId);
		const selectedModelId = this.selectedModelId ?? models[0]?.id;
		this.chatSession = await this.database.createChatSession(this.activeConnectionId, 'Nuevo chat', selectedModelId);
		this.selectedModelId = selectedModelId;
		this.messages = [];
		this.error = undefined;
		this.screen = 'chat';
		this.emitDidChange();
	}

	public async sendChatMessage(content: string): Promise<void> {
		const prompt = content.trim();
		if (!prompt || !this.activeConnectionId || !this.chatSession || !this.selectedModelId) {
			return;
		}

		const createdAt = new Date().toISOString();
		const userMessage = await this.database.insertMessage({
			id: crypto.randomUUID(),
			sessionId: this.chatSession.id,
			role: 'user',
			content: prompt,
			createdAt,
		});
		this.messages = [...this.messages, userMessage];

		if (this.chatSession.title === 'Nuevo chat') {
			const nextTitle = trimTitle(prompt);
			await this.database.updateSessionTitle(this.chatSession.id, nextTitle);
			this.chatSession = { ...this.chatSession, title: nextTitle };
		}
		await this.database.touchSession(this.chatSession.id);

		const assistantId = crypto.randomUUID();
		const assistantCreatedAt = new Date().toISOString();
		const assistantPlaceholder: ChatMessageRecord = {
			id: assistantId,
			sessionId: this.chatSession.id,
			role: 'assistant',
			content: '',
			createdAt: assistantCreatedAt,
		};
		this.messages = [...this.messages, assistantPlaceholder];
		this.isStreaming = true;
		this.error = undefined;
		this.streamAbortController = new AbortController();
		this.emitDidChange();

		const history: ChatCompletionInputMessage[] = this.messages
			.filter((message) => message.id !== assistantId)
			.map((message) => ({
				role: message.role,
				content: message.content,
			}));

		let assistantContent = '';
		let assistantError: string | undefined;
		try {
			const stream = await this.providers.streamChat({
				connectionId: this.activeConnectionId,
				modelId: this.selectedModelId,
				messages: history,
				signal: this.streamAbortController.signal,
			});

			for await (const chunk of stream) {
				assistantContent += chunk;
				this.messages = this.messages.map((message) => (
					message.id === assistantId
						? { ...message, content: assistantContent }
						: message
				));
				this.emitDidChange();
			}
		} catch (error) {
			assistantError = error instanceof Error ? error.message : 'La respuesta del proveedor fallo.';
			if (!assistantContent) {
				assistantContent = `Error: ${assistantError}`;
			}
			this.error = assistantError;
			this.messages = this.messages.map((message) => (
				message.id === assistantId
					? { ...message, content: assistantContent, errorText: assistantError }
					: message
			));
		} finally {
			this.isStreaming = false;
			this.streamAbortController = undefined;
		}

		await this.database.insertMessage({
			id: assistantId,
			sessionId: this.chatSession.id,
			role: 'assistant',
			content: assistantContent,
			createdAt: assistantCreatedAt,
			errorText: assistantError,
		});
		await this.database.touchSession(this.chatSession.id);
		this.emitDidChange();
	}

	public stopStreaming(): boolean {
		if (!this.streamAbortController) {
			return false;
		}
		this.streamAbortController.abort();
		return true;
	}

	private async refreshFromStorage(): Promise<void> {
		this.connections = await this.providers.listConnections();
		if (this.connections.length === 0) {
			this.screen = 'onboarding';
			this.activeConnectionId = undefined;
			this.selectedModelId = undefined;
			this.chatSession = undefined;
			this.modelOptions = [];
			this.messages = [];
			return;
		}

		const activeConnection = this.connections.find((connection) => connection.isActive) ?? this.connections[0];
		await this.loadConnectionChat(activeConnection.id, true);
		this.screen = 'chat';
	}

	private async loadConnectionChat(connectionId: string, createIfMissing: boolean): Promise<void> {
		this.connections = await this.providers.listConnections();
		this.activeConnectionId = connectionId;
		const models = await this.providers.listEnabledModels(connectionId);
		this.modelOptions = models;
		let session = await this.database.getLatestSession(connectionId);
		if (!session && createIfMissing) {
			session = await this.database.createChatSession(connectionId, 'Nuevo chat', models[0]?.id);
		}

		if (!session) {
			this.chatSession = undefined;
			this.messages = [];
			this.selectedModelId = models[0]?.id;
			return;
		}

		const selectedModelId = resolveSelectedModelId(session.selectedModelId, models);
		if (selectedModelId !== session.selectedModelId) {
			await this.database.updateSessionSelectedModel(session.id, selectedModelId);
			session = { ...session, selectedModelId };
		}

		this.chatSession = session;
		this.selectedModelId = selectedModelId;
		this.messages = await this.database.listMessages(session.id);
	}

	private resetDraft(): void {
		this.draftConfig = { ...DEFAULT_DRAFT };
		this.modelOptions = [];
	}

	private async buildModelSelectorOptions(): Promise<ModelSelectOption[]> {
		const options: ModelSelectOption[] = [];
		for (const connection of this.connections) {
			const models = await this.providers.listEnabledModels(connection.id);
			for (const model of models) {
				options.push({
					value: `${connection.id}::${model.id}`,
					connectionId: connection.id,
					connectionLabel: `${capitalizeProvider(connection.providerKind)} - ${connection.displayName}`,
					providerKind: connection.providerKind,
					modelId: model.id,
					modelLabel: model.label,
				});
			}
		}
		return options;
	}

	private emitDidChange(): void {
		this.onDidChangeEmitter.fire();
	}

	private async ensureScreenMatchesStorage(): Promise<void> {
		if (this.screen !== 'onboarding') {
			return;
		}

		const storedConnections = await this.providers.listConnections();
		if (storedConnections.length === 0) {
			return;
		}

		await this.refreshFromStorage();
	}
}

function resolveSelectedModelId(current: string | undefined, models: ProviderModel[]): string | undefined {
	if (current && models.some((model) => model.id === current)) {
		return current;
	}
	return models[0]?.id;
}

function trimTitle(value: string): string {
	const normalized = value.trim().replace(/\s+/g, ' ');
	return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}

function capitalizeProvider(value: string): string {
	return value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}
