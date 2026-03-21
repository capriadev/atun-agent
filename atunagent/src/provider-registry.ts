import { GroqProviderAdapter } from './groq-provider';
import { LocalDatabase } from './local-database';
import { SecretsService } from './secrets-service';
import type {
	ChatCompletionInputMessage,
	ProviderCard,
	ProviderConnectionSummary,
	ProviderDraftConfig,
	ProviderKind,
	ProviderModel,
	ProviderValidationResult,
} from './types';

interface StreamChatInput {
	connectionId: string;
	modelId: string;
	messages: ChatCompletionInputMessage[];
	signal?: AbortSignal;
}

export class ProviderRegistry {
	private readonly groqAdapter = new GroqProviderAdapter();

	public constructor(
		private readonly database: LocalDatabase,
		private readonly secrets: SecretsService,
	) {}

	public listSupportedProviders(): ProviderCard[] {
		return [
			{
				kind: 'groq',
				title: 'Groq',
				description: 'Conecta modelos compatibles con OpenAI servidos por Groq.',
			},
		];
	}

	public async validateAndListModels(draft: ProviderDraftConfig): Promise<ProviderValidationResult> {
		try {
			this.assertSupportedProvider(draft.providerKind);
			const apiKey = draft.apiKey.trim();
			if (!apiKey) {
				return { ok: false, models: [], error: 'Ingresá una API key para listar modelos.' };
			}

			const models = await this.groqAdapter.listModels(apiKey);
			return { ok: true, models };
		} catch (error) {
			return {
				ok: false,
				models: [],
				error: error instanceof Error ? error.message : 'No se pudieron cargar los modelos del proveedor.',
			};
		}
	}

	public async createConnection(
		draft: ProviderDraftConfig,
		enabledModelIds: readonly string[],
	): Promise<ProviderConnectionSummary> {
		this.assertSupportedProvider(draft.providerKind);

		const displayName = draft.displayName.trim();
		if (!displayName) {
			throw new Error('El nombre personalizado es obligatorio.');
		}

		const validation = await this.validateAndListModels(draft);
		if (!validation.ok) {
			throw new Error(validation.error ?? 'No se pudo validar el proveedor.');
		}

		const enabledSet = new Set(enabledModelIds);
		const models = validation.models.map((model) => ({
			...model,
			enabled: enabledSet.has(model.id),
		}));
		if (!models.some((model) => model.enabled)) {
			throw new Error('Seleccioná al menos un modelo para habilitar la conexión.');
		}

		const connectionId = crypto.randomUUID();
		const secretKeyRef = await this.secrets.setApiKey(connectionId, draft.apiKey.trim());

		await this.database.createConnection({
			id: connectionId,
			providerKind: draft.providerKind,
			displayName,
			secretKeyRef,
			isActive: true,
			models,
		});

		return {
			id: connectionId,
			providerKind: draft.providerKind,
			displayName,
			isActive: true,
		};
	}

	public async listConnections(): Promise<ProviderConnectionSummary[]> {
		return this.database.getConnectionSummaries();
	}

	public async setActiveConnection(connectionId: string): Promise<void> {
		await this.database.setActiveConnection(connectionId);
	}

	public async listEnabledModels(connectionId: string): Promise<ProviderModel[]> {
		const records = await this.database.listEnabledModels(connectionId);
		return records.map((item) => ({
			id: item.id,
			label: item.label,
			enabled: item.enabled,
		}));
	}

	public async streamChat(input: StreamChatInput): Promise<AsyncGenerator<string, void, void>> {
		const connection = await this.database.getConnectionById(input.connectionId);
		if (!connection) {
			throw new Error('La conexión seleccionada no existe.');
		}

		const apiKey = await this.secrets.getApiKey(connection.id);
		if (!apiKey) {
			throw new Error('No se encontró la API key de la conexión seleccionada.');
		}

		switch (connection.providerKind) {
			case 'groq':
				return this.groqAdapter.streamChat(apiKey, input.modelId, input.messages, input.signal);
			default:
				throw new Error(`Proveedor no soportado: ${assertNever(connection.providerKind)}`);
		}
	}

	private assertSupportedProvider(providerKind: ProviderKind): void {
		if (providerKind !== 'groq') {
			throw new Error(`Proveedor no soportado: ${providerKind}`);
		}
	}
}

function assertNever(value: never): string {
	return String(value);
}
