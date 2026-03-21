import * as vscode from 'vscode';

export interface HostSupport {
	hasChatParticipantApi: boolean;
	isSupported: boolean;
	reason?: string;
}

export function detectHostSupport(): HostSupport {
	const api = vscode as typeof vscode & {
		chat?: { createChatParticipant?: unknown };
	};

	const hasChatParticipantApi = typeof api.chat?.createChatParticipant === 'function';
	const isSupported = hasChatParticipantApi;

	return {
		hasChatParticipantApi,
		isSupported,
		reason: isSupported ? undefined : buildReason(hasChatParticipantApi),
	};
}

function buildReason(hasChatParticipantApi: boolean): string {
	if (!hasChatParticipantApi) {
		return 'This editor host does not expose the native Chat Participant API required by Atun Agent.';
	}
	return 'This editor host does not expose the native Chat APIs required by Atun Agent.';
}
