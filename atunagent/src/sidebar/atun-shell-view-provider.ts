import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SidebarViewState } from '../core/types';
import type { HostSupport } from '../host-support';
import { createChatShellHtml } from './webview/chat-shell-html';
import type { IncomingMessage } from './webview/chat-shell-protocol';
import { SidebarViewModel } from './sidebar-view-model';

export class AtunShellViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'atunAgent.shellView';

	private view: vscode.WebviewView | undefined;

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly sidebarViewModel: SidebarViewModel,
		private readonly hostSupport: HostSupport,
	) {}

	public async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'assets'))],
		};
		this.renderWebview(view);
		view.webview.onDidReceiveMessage((message: IncomingMessage) => {
			void this.handleMessage(message);
		});
		view.onDidChangeVisibility(() => {
			if (!view.visible) {
				return;
			}
			this.renderWebview(view);
			void this.postState();
		});
		await this.postState();
	}

	public refresh(): void {
		void this.postState();
	}

	public rerender(): void {
		if (!this.view) {
			return;
		}
		this.renderWebview(this.view);
		void this.postState();
	}

	private renderWebview(view: vscode.WebviewView): void {
		view.webview.html = createChatShellHtml(view.webview, this.context.extensionUri);
	}

	private async handleMessage(message: IncomingMessage): Promise<void> {
		try {
			switch (message.type) {
				case 'ready':
					await this.postState();
					return;
				case 'openProviderPicker':
				case 'openProviderManager':
					await this.sidebarViewModel.openProviderPicker();
					return;
				case 'chooseProvider':
					await this.sidebarViewModel.chooseProvider(message.providerKind);
					return;
				case 'updateProviderDraft':
					await this.sidebarViewModel.updateProviderDraft(message.patch);
					return;
				case 'validateProviderDraft':
					await this.sidebarViewModel.validateProviderDraft();
					return;
				case 'toggleDraftModel':
					await this.sidebarViewModel.toggleDraftModel(message.modelId);
					return;
				case 'saveProviderConnection':
					await this.sidebarViewModel.saveProviderConnection();
					return;
				case 'setModelSelection':
					await this.sidebarViewModel.setModelSelection(message.connectionId, message.modelId);
					return;
				case 'sendChatMessage':
					await this.sidebarViewModel.sendChatMessage(message.content);
					return;
				case 'newChat':
					await this.sidebarViewModel.newChat();
					return;
				case 'openNativeChat':
					if (this.hostSupport.hasChatParticipantApi) {
						await vscode.commands.executeCommand('atun-agent.openNativeChat');
					}
					return;
				case 'back':
					await this.sidebarViewModel.goBack();
					return;
				default:
					return;
			}
		} catch (error) {
			const messageText = error instanceof Error ? error.message : 'Atun Agent action failed.';
			void vscode.window.showErrorMessage(messageText);
			await this.postState();
		}
	}

	private async postState(): Promise<void> {
		if (!this.view) {
			return;
		}

		const state = await this.sidebarViewModel.getState();
		await this.view.webview.postMessage({
			type: 'state',
			...state,
		} satisfies SidebarViewState & { type: 'state' });
	}
}
