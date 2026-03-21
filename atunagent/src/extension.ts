import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import { registerAtunChatParticipant } from './chat-participant';
import { AtunShellViewProvider } from './chat-view';
import { detectHostSupport } from './host-support';
import { WorkspaceTools, type WorkspaceActionResult } from './workspace-tools';

const SHELL_CONTAINER_COMMAND = 'workbench.view.extension.atunAgentSidebar';
const CHAT_QUERY = '@atun ';

export function activate(context: vscode.ExtensionContext): void {
	const hostSupport = detectHostSupport();
	const state = new AtunAgentState(context);
	const tools = new WorkspaceTools(state);
	const shellViewProvider = new AtunShellViewProvider(context, state, hostSupport);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AtunShellViewProvider.viewType, shellViewProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		state.onDidChange(() => shellViewProvider.refresh()),
	);

	if (hostSupport.isSupported) {
		context.subscriptions.push(registerAtunChatParticipant(context, state, tools));
	} else {
		console.warn(`[Atun Agent] Native chat integration disabled: ${hostSupport.reason ?? 'unsupported host'}`);
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('atun-agent.openChat', async () => {
			await safeOpenNativeChat(hostSupport);
		}),
		vscode.commands.registerCommand('atun-agent.focusSidebar', async () => {
			await safeFocusSidebar();
		}),
		vscode.commands.registerCommand('atun-agent.stopResponse', async () => {
			if (!state.stopActiveRequest()) {
				void vscode.window.showInformationMessage('No active Atun response to stop.');
			}
		}),
		vscode.commands.registerCommand('atun-agent.addContextFiles', async () => {
			await addContextFiles(state);
		}),
		vscode.commands.registerCommand('atun-agent.workspace.createFile', async () => {
			const pathArg = await vscode.window.showInputBox({
				title: 'Atun Agent',
				prompt: 'Create file (relative workspace path)',
				placeHolder: 'src/new-file.ts',
			});
			if (!pathArg) {
				return;
			}
			await showActionResult(await tools.createFile(pathArg, '', 'command'));
		}),
		vscode.commands.registerCommand('atun-agent.workspace.deleteFile', async () => {
			const listing = await tools.listFiles('**/*');
			if (!listing.lines || listing.lines.length === 0) {
				void vscode.window.showInformationMessage('No workspace files available to delete.');
				return;
			}
			const picked = await vscode.window.showQuickPick(listing.lines.slice(0, 200), {
				title: 'Atun Agent',
				placeHolder: 'Pick file to delete (to trash)',
			});
			if (!picked) {
				return;
			}
			await showActionResult(await tools.deleteFileToTrash(picked, 'command'));
		}),
		vscode.commands.registerCommand('atun-agent.workspace.runTerminal', async () => {
			const commandText = await vscode.window.showInputBox({
				title: 'Atun Agent',
				prompt: 'Terminal command',
				placeHolder: 'npm test',
			});
			if (!commandText) {
				return;
			}
			await showActionResult(await tools.runTerminalCommand(commandText, 'command'));
		}),
	);

	void revealOnFirstActivation(context);
}

async function addContextFiles(state: AtunAgentState): Promise<void> {
	const picked = await vscode.window.showOpenDialog({
		canSelectMany: true,
		canSelectFiles: true,
		canSelectFolders: false,
		openLabel: 'Add to Atun context',
	});
	if (!picked || picked.length === 0) {
		return;
	}
	await state.addContextFiles(picked);
	void vscode.window.showInformationMessage(`Added ${picked.length} file(s) to Atun context.`);
}

async function safeOpenNativeChat(hostSupport: ReturnType<typeof detectHostSupport>): Promise<void> {
	try {
		await openNativeChat(hostSupport);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Cannot open Atun chat.';
		void vscode.window.showErrorMessage(message);
	}
}

async function openNativeChat(hostSupport: ReturnType<typeof detectHostSupport>): Promise<void> {
	if (!hostSupport.isSupported) {
		throw new Error(`${hostSupport.reason ?? 'Native chat is unavailable.'} Use VS Code 1.110+ with Chat enabled and a compatible chat model provider.`);
	}

	const opened = (await tryExecute('workbench.action.chat.open', { query: CHAT_QUERY, isPartialQuery: true }))
		|| (await tryExecute('workbench.action.chat.open', CHAT_QUERY))
		|| (await tryExecute('workbench.action.chat.open'))
		|| (await tryExecute('chat.open', CHAT_QUERY));
	if (!opened) {
		throw new Error('Native chat view is not available. Verify VS Code Chat is enabled.');
	}
}

async function safeFocusSidebar(): Promise<void> {
	try {
		await focusSidebar();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Cannot focus Atun sidebar.';
		void vscode.window.showErrorMessage(message);
	}
}

async function focusSidebar(): Promise<void> {
	const preferSecondary = vscode.workspace
		.getConfiguration('atunAgent')
		.get<boolean>('preferSecondarySideBar', true);

	if (preferSecondary) {
		await tryExecute('workbench.action.toggleSecondarySideBarVisibility');
		await tryExecute('workbench.action.moveViewContainerToSecondarySideBar', SHELL_CONTAINER_COMMAND);
	}

	const opened = (await tryExecute('workbench.action.openView', AtunShellViewProvider.viewType))
		|| (await tryExecute(SHELL_CONTAINER_COMMAND))
		|| (await tryExecute('workbench.action.openView', SHELL_CONTAINER_COMMAND));

	if (!opened) {
		throw new Error('Atun Agent sidebar unavailable. Reload VS Code and reinstall extension.');
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
	const alreadyRevealed = context.globalState.get<boolean>(key, false);
	if (alreadyRevealed) {
		return;
	}

	await safeFocusSidebar();
	await context.globalState.update(key, true);
}

async function showActionResult(result: WorkspaceActionResult): Promise<void> {
	if (result.ok) {
		void vscode.window.showInformationMessage(result.message);
		return;
	}
	void vscode.window.showErrorMessage(result.message);
}

async function tryExecute(command: string, ...args: unknown[]): Promise<boolean> {
	try {
		await vscode.commands.executeCommand(command, ...args);
		return true;
	} catch {
		return false;
	}
}

export function deactivate(): void {}
