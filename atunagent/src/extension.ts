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
			await safeFocusSidebar();
		}),
		vscode.commands.registerCommand('atun-agent.focusSidebar', async () => {
			await safeFocusSidebar();
		}),
		vscode.commands.registerCommand('atun-agent.stopResponse', async () => {
			if (!state.stopActiveRequest()) {
				void vscode.window.showInformationMessage('No hay respuesta activa para pausar.');
			}
		}),
	);

	void revealOnFirstActivation(context);
}

async function safeFocusSidebar(): Promise<void> {
	try {
		await focusSidebar();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'No se pudo abrir la vista de Atun Agent.';
		void vscode.window.showErrorMessage(message);
	}
}

async function focusSidebar(): Promise<void> {
	const preferSecondary = vscode.workspace
		.getConfiguration('atunAgent')
		.get<boolean>('preferSecondarySideBar', true);

	if (preferSecondary) {
		await tryExecute('workbench.action.toggleSecondarySideBarVisibility');
		await tryExecute('workbench.action.moveViewContainerToSecondarySideBar', 'workbench.view.extension.atunAgentSidebar');
	}

	const opened = (await tryExecute('workbench.action.openView', AtunChatViewProvider.viewType))
		|| (await tryExecute('workbench.view.extension.atunAgentSidebar'))
		|| (await tryExecute('workbench.action.openView', 'workbench.view.extension.atunAgentSidebar'));

	if (!opened) {
		throw new Error('Atun Agent view no disponible. Reinicia VS Code o reinstala la extension.');
	}
}

async function revealOnFirstActivation(context: vscode.ExtensionContext): Promise<void> {
	const shouldAutoReveal = vscode.workspace
		.getConfiguration('atunAgent')
		.get<boolean>('autoRevealOnStartup', true);
	if (!shouldAutoReveal) {
		return;
	}

	const key = 'atunAgent.didAutoReveal';
	const didAutoReveal = context.globalState.get<boolean>(key, false);
	if (didAutoReveal) {
		return;
	}

	await safeFocusSidebar();
	await context.globalState.update(key, true);
}

async function tryExecute(command: string, ...args: unknown[]): Promise<boolean> {
	try {
		await vscode.commands.executeCommand(command, ...args);
		return true;
	} catch {
		// Best effort only.
		return false;
	}
}

export function deactivate() {
}
