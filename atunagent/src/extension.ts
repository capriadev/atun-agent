import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import { registerAtunChatParticipant } from './chat-participant';
import { AtunShellViewProvider } from './chat-view';
import { detectHostSupport } from './host-support';
import { LocalDatabase } from './local-database';
import { ProviderRegistry } from './provider-registry';
import { SecretsService } from './secrets-service';
import { SidebarViewModel } from './sidebar-view-model';
import { WorkspaceTools, type WorkspaceActionResult } from './workspace-tools';

const SHELL_CONTAINER_COMMAND = 'workbench.view.extension.atunAgentSidebar';
const CHAT_QUERY = '@atun ';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const hostSupport = detectHostSupport();
	const state = new AtunAgentState(context);
	const tools = new WorkspaceTools(state);
	const database = new LocalDatabase({
		storagePath: context.globalStorageUri.fsPath,
		extensionPath: context.extensionPath,
	});
	await database.initialize();

	const secrets = new SecretsService(context);
	const providers = new ProviderRegistry(database, secrets);
	const sidebarViewModel = new SidebarViewModel(database, providers, hostSupport.isSupported);
	await sidebarViewModel.initialize();

	const shellViewProvider = new AtunShellViewProvider(context, sidebarViewModel, hostSupport);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AtunShellViewProvider.viewType, shellViewProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
		sidebarViewModel.onDidChange(() => shellViewProvider.refresh()),
	);

	if (hostSupport.hasChatParticipantApi) {
		context.subscriptions.push(registerAtunChatParticipant(context, database));
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('atun-agent.openChat', async () => {
			await safeFocusSidebar();
		}),
		vscode.commands.registerCommand('atun-agent.view.settings', async () => {
			void vscode.window.showInformationMessage('Settings toolbar action is not implemented yet.');
		}),
		vscode.commands.registerCommand('atun-agent.view.history', async () => {
			void vscode.window.showInformationMessage('History toolbar action is not implemented yet.');
		}),
		vscode.commands.registerCommand('atun-agent.view.newChat', async () => {
			await safeFocusSidebar();
			await sidebarViewModel.newChat();
		}),
		vscode.commands.registerCommand('atun-agent.view.ghostChat', async () => {
			void vscode.window.showInformationMessage('Ghost chat toolbar action is not implemented yet.');
		}),
		vscode.commands.registerCommand('atun-agent.openNativeChat', async () => {
			await safeOpenNativeChat(hostSupport);
		}),
		vscode.commands.registerCommand('atun-agent.focusSidebar', async () => {
			await safeFocusSidebar();
		}),
		vscode.commands.registerCommand('atun-agent.stopResponse', async () => {
			if (!sidebarViewModel.stopStreaming()) {
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

	await revealOnFirstActivation(context);
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
		const message = error instanceof Error ? error.message : 'Cannot open Atun native chat.';
		void vscode.window.showErrorMessage(message);
	}
}

async function openNativeChat(hostSupport: ReturnType<typeof detectHostSupport>): Promise<void> {
	if (!hostSupport.hasChatParticipantApi) {
		throw new Error(`${hostSupport.reason ?? 'Native chat is unavailable.'} Use a compatible VS Code host with Chat enabled.`);
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
