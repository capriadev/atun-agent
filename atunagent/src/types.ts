export type AccessMode = 'isolated' | 'full';
export type AgentMode = 'ask' | 'plan' | 'git' | 'docs';

export interface TokenBreakdown {
	inputTokens: number;
	referenceTokens: number;
	projectTokens: number;
	imageReferenceTokens: number;
	totalTokens: number;
	modelId: string;
}
