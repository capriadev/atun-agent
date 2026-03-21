export type AccessMode = 'isolated' | 'full';
export type AgentMode = 'ask' | 'plan' | 'git' | 'docs';
export type ProviderKind = 'groq';
export type SidebarScreen = 'onboarding' | 'provider-picker' | 'provider-config' | 'chat';
export type ChatRole = 'user' | 'assistant' | 'system';

export interface TokenBreakdown {
	inputTokens: number;
	referenceTokens: number;
	projectTokens: number;
	imageReferenceTokens: number;
	totalTokens: number;
	modelId: string;
}

export interface ProviderDraftConfig {
	providerKind: ProviderKind;
	displayName: string;
	apiKey: string;
}

export interface ProviderCard {
	kind: ProviderKind;
	title: string;
	description: string;
}

export interface ProviderModel {
	id: string;
	label: string;
	enabled: boolean;
}

export interface ProviderConnectionSummary {
	id: string;
	providerKind: ProviderKind;
	displayName: string;
	isActive: boolean;
}

export interface ProviderConnectionRecord extends ProviderConnectionSummary {
	secretKeyRef: string;
	createdAt: string;
	updatedAt: string;
}

export interface ProviderModelRecord extends ProviderModel {
	recordId: string;
	connectionId: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface ChatSessionRecord {
	id: string;
	connectionId: string;
	title: string;
	selectedModelId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ChatMessageRecord {
	id: string;
	sessionId: string;
	role: ChatRole;
	content: string;
	createdAt: string;
	errorText?: string;
}

export interface ProviderValidationResult {
	ok: boolean;
	models: ProviderModel[];
	error?: string;
}

export interface ChatCompletionInputMessage {
	role: ChatRole;
	content: string;
}

export interface SidebarViewState {
	screen: SidebarScreen;
	providerCards: ProviderCard[];
	draftConfig: ProviderDraftConfig;
	modelOptions: ProviderModel[];
	connections: ProviderConnectionSummary[];
	activeConnectionId?: string;
	selectedModelId?: string;
	chatSession?: ChatSessionRecord;
	messages: ChatMessageRecord[];
	isValidatingProvider: boolean;
	isStreaming: boolean;
	error?: string;
	nativeChatAvailable: boolean;
}
