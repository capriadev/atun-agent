import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import { AtunChatViewProvider } from './chat-view';

export function activate(context: vscode.ExtensionContext) {
	const state = new AtunAgentState(context);
	const chatViewProvider = new AtunChatViewProvider(context, state);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AtunChatViewProvider.viewType, chatViewProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		state.onDidChange(() => chatViewProvider.refresh()),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('atun-agent.openChat', async () => {
			await focusSidebar();
		}),
		vscode.commands.registerCommand('atun-agent.focusSidebar', async () => {
			await focusSidebar();
		}),
		vscode.commands.registerCommand('atun-agent.stopResponse', async () => {
			if (!state.stopActiveRequest()) {
				void vscode.window.showInformationMessage('No hay respuesta activa para pausar.');
			}
		}),
	);
}

async function focusSidebar(): Promise<void> {
	const preferSecondary = vscode.workspace
		.getConfiguration('atunAgent')
		.get<boolean>('preferSecondarySideBar', true);

	if (preferSecondary) {
		await tryExecute('workbench.action.toggleSecondarySideBarVisibility');
		await tryExecute('workbench.action.moveViewContainerToSecondarySideBar', 'workbench.view.extension.atunAgentSidebar');
	}

	await vscode.commands.executeCommand('workbench.view.extension.atunAgentSidebar');
}

async function tryExecute(command: string, ...args: unknown[]): Promise<void> {
	try {
		await vscode.commands.executeCommand(command, ...args);
	} catch {
		// Best effort only.
	}
}

export function deactivate() {
}