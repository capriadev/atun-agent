import * as vscode from 'vscode';
import { createExtensionServices } from './bootstrap/create-extension-services';
import { registerAtunChatParticipant } from './chat-participant';
import { registerAtunCommands, revealSidebarOnFirstActivation } from './commands/register-commands';
import { detectHostSupport } from './host-support';
import { AtunShellViewProvider } from './sidebar/atun-shell-view-provider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const hostSupport = detectHostSupport();
	const services = await createExtensionServices(context, hostSupport);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AtunShellViewProvider.viewType, services.shellViewProvider, {
			webviewOptions: { retainContextWhenHidden: false },
		}),
		services.sidebarViewModel.onDidChange(() => services.shellViewProvider.refresh()),
	);

	if (hostSupport.hasChatParticipantApi) {
		context.subscriptions.push(registerAtunChatParticipant(context, services.database));
	}

	registerAtunCommands({
		context,
		hostSupport,
		state: services.state,
		tools: services.tools,
		sidebarViewModel: services.sidebarViewModel,
	});

	await revealSidebarOnFirstActivation(context);
}

export function deactivate(): void {}
