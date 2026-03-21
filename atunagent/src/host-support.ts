import * as vscode from 'vscode';

export interface HostSupport {
	hasChatParticipantApi: boolean;
	hasLanguageModelApi: boolean;
	isSupported: boolean;
	reason?: string;
}

export function detectHostSupport(): HostSupport {
	const api = vscode as typeof vscode & {
		chat?: { createChatParticipant?: unknown };
		lm?: { selectChatModels?: unknown };
	};

	const hasChatParticipantApi = typeof api.chat?.createChatParticipant === 'function';
	const hasLanguageModelApi = typeof api.lm?.selectChatModels === 'function';
	const isSupported = hasChatParticipantApi && hasLanguageModelApi;

	return {
		hasChatParticipantApi,
		hasLanguageModelApi,
		isSupported,
		reason: isSupported ? undefined : buildReason(hasChatParticipantApi, hasLanguageModelApi),
	};
}

function buildReason(hasChatParticipantApi: boolean, hasLanguageModelApi: boolean): string {
	if (!hasChatParticipantApi && !hasLanguageModelApi) {
		return 'This editor host does not expose the native Chat and Language Model APIs required by Atun Agent.';
	}

	if (!hasChatParticipantApi) {
		return 'This editor host does not expose the native Chat Participant API required by Atun Agent.';
	}

	return 'This editor host does not expose the native Language Model API required by Atun Agent.';
}
