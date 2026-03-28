import type { ProviderKind } from '../../core/types';

export type IncomingMessage =
	| { type: 'ready' }
	| { type: 'openProviderPicker' }
	| { type: 'chooseProvider'; providerKind: ProviderKind }
	| { type: 'updateProviderDraft'; patch: { displayName?: string; apiKey?: string } }
	| { type: 'validateProviderDraft' }
	| { type: 'toggleDraftModel'; modelId: string }
	| { type: 'saveProviderConnection' }
	| { type: 'setModelSelection'; connectionId: string; modelId: string }
	| { type: 'sendChatMessage'; content: string }
	| { type: 'newChat' }
	| { type: 'openProviderManager' }
	| { type: 'openNativeChat' }
	| { type: 'back' };
