export type AccessMode = 'isolated' | 'full';

export interface TokenBreakdown {
	inputTokens: number;
	referenceTokens: number;
	projectTokens: number;
	imageReferenceTokens: number;
	totalTokens: number;
	modelId: string;
}
