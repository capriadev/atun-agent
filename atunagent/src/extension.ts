import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import { registerAtunParticipant } from './chat-agent';
import { AtunControlsProvider } from './controls-view';

export function activate(context: vscode.ExtensionContext) {
	const state = new AtunAgentState(context);
	const controlsProvider = new AtunControlsProvider(context, state);
	const treeView = vscode.window.createTreeView('atunAgent.controls', {
		treeDataProvider: controlsProvider,
	});

	const participant = registerAtunParticipant(context, state);
	context.subscriptions.push(treeView, participant);
	context.subscriptions.push(state.onDidChange(() => controlsProvider.refresh()));

	context.subscriptions.push(
		vscode.commands.registerCommand('atun-agent.openChat', async () => {
			await openChat('@atun ');
		}),
		vscode.commands.registerCommand('atun-agent.focusSidebar', async () => {
			const preferSecondary = vscode.workspace
				.getConfiguration('atunAgent')
				.get<boolean>('preferSecondarySideBar', true);
			if (preferSecondary) {
				await tryExecute('workbench.action.toggleSecondarySideBarVisibility');
				await tryExecute('workbench.action.moveViewContainerToSecondarySideBar', 'workbench.view.extension.atunAgentSidebar');
			}
			await vscode.commands.executeCommand('workbench.view.extension.atunAgentSidebar');
		}),
		vscode.commands.registerCommand('atun-agent.setAccessMode', async () => {
			const picked = await vscode.window.showQuickPick(
				[
					{ label: 'Isolated', value: 'isolated' as const, description: 'Conservative workspace scope' },
					{ label: 'Full', value: 'full' as const, description: 'Full project operations' },
				],
				{ title: 'Atun Agent Access Mode', placeHolder: 'Selecciona access mode' },
			);
			if (!picked) {
				return;
			}
			await state.setAccessMode(picked.value);
		}),
		vscode.commands.registerCommand('atun-agent.toggleThinkingMode', async () => {
			await state.setThinkingMode(!state.thinkingMode);
		}),
		vscode.commands.registerCommand('atun-agent.setModelOverride', async () => {
			const models = await vscode.lm.selectChatModels({});
			const items: Array<{ label: string; detail: string; value?: string }> = [
				{ label: 'UI selected model', detail: 'Use the chat UI selector', value: undefined },
				...models.map((model) => ({
					label: model.name,
					detail: `${model.vendor}/${model.family} (${model.id})`,
					value: model.id,
				})),
			];
			const picked = await vscode.window.showQuickPick(items, {
				title: 'Atun Agent Model Override',
				placeHolder: 'Elegi modelo fijo o usa selector de chat',
			});
			if (!picked) {
				return;
			}
			await state.setModelOverrideId(picked.value);
		}),
		vscode.commands.registerCommand('atun-agent.stopResponse', async () => {
			if (!state.stopActiveRequest()) {
				void vscode.window.showInformationMessage('No hay respuesta activa para pausar.');
			}
		}),
		vscode.commands.registerCommand('atun-agent.openSkillsCommand', async () => {
			await openChat('@atun /skills');
		}),
		vscode.commands.registerCommand('atun-agent.showHashHint', async () => {
			await openChat('@atun ');
			void vscode.window.showInformationMessage('Usa # en el chat para agregar archivos o imagenes.');
		}),
		vscode.commands.registerCommand('atun-agent.useSkillPrompt', async (skill: string) => {
			await openChat(`@atun /skills\nUsar skill: ${skill}`);
		}),
	);
}

async function openChat(initialQuery?: string): Promise<void> {
	const candidates = ['workbench.action.chat.open', 'chat.action.open'];
	for (const commandId of candidates) {
		try {
			if (initialQuery) {
				await vscode.commands.executeCommand(commandId, { query: initialQuery });
			} else {
				await vscode.commands.executeCommand(commandId);
			}
			return;
		} catch {
			// try next candidate
		}
	}

	throw new Error('No se pudo abrir la vista de chat nativa de VS Code.');
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
