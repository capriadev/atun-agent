import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import { iconUri } from './icons';

type ControlItemKey =
	| 'access'
	| 'thinking'
	| 'model'
	| 'response'
	| 'slash'
	| 'hash'
	| 'tokens'
	| 'agent-ask'
	| 'agent-plan'
	| 'agent-git'
	| 'agent-docs';

class ControlItem extends vscode.TreeItem {
	public constructor(
		label: string,
		public readonly key: ControlItemKey,
		options: {
			description?: string;
			tooltip?: string;
			icon?: vscode.Uri;
			command?: vscode.Command;
		},
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.description = options.description;
		this.tooltip = options.tooltip;
		this.iconPath = options.icon;
		this.command = options.command;
		this.contextValue = key;
	}
}

export class AtunControlsProvider implements vscode.TreeDataProvider<ControlItem> {
	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ControlItem | undefined>();

	public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

	public constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly state: AtunAgentState,
	) {}

	public refresh(): void {
		this.onDidChangeTreeDataEmitter.fire(undefined);
	}

	public getTreeItem(element: ControlItem): vscode.TreeItem {
		return element;
	}

	public getChildren(): ControlItem[] {
		const tokenStats = this.state.lastTokenBreakdown;
		const isRunning = this.state.hasRunningRequest();

		return [
			new ControlItem('Access', 'access', {
				description: this.state.accessMode === 'full' ? 'Full' : 'Isolated',
				tooltip: 'Cambiar access mode',
				icon:
					this.state.accessMode === 'full'
						? iconUri(this.context, 'full-access.svg')
						: iconUri(this.context, 'Isolated-access.svg'),
				command: { command: 'atun-agent.setAccessMode', title: 'Set Access' },
			}),
			new ControlItem('Thinking', 'thinking', {
				description: this.state.thinkingMode ? 'On' : 'Off',
				tooltip: 'Alternar modo de razonamiento',
				icon: iconUri(this.context, 'thinking.svg'),
				command: { command: 'atun-agent.toggleThinkingMode', title: 'Toggle Thinking' },
			}),
			new ControlItem('Model', 'model', {
				description: this.state.modelOverrideId ?? 'UI selected',
				tooltip: 'Seleccionar modelo fijo u operar con el selector nativo',
				icon: iconUri(this.context, 'model.svg'),
				command: { command: 'atun-agent.setModelOverride', title: 'Set Model Override' },
			}),
			new ControlItem('Response', 'response', {
				description: isRunning ? 'Pause available' : 'Play',
				tooltip: isRunning ? 'Frenar respuesta actual' : 'Abrir chat y enviar',
				icon: iconUri(this.context, isRunning ? 'pause.svg' : 'play.svg'),
				command: { command: isRunning ? 'atun-agent.stopResponse' : 'atun-agent.openChat', title: 'Response Control' },
			}),
			new ControlItem('Slash', 'slash', {
				description: '/skills',
				tooltip: 'Llamar skills por slash command',
				icon: iconUri(this.context, 'slash.svg'),
				command: { command: 'atun-agent.openSkillsCommand', title: 'Slash Skills' },
			}),
			new ControlItem('Hash', 'hash', {
				description: '# files',
				tooltip: 'Agregar archivos al prompt',
				icon: iconUri(this.context, 'hash.svg'),
				command: { command: 'atun-agent.showHashHint', title: 'Hash Add Files' },
			}),
			new ControlItem('Tokens', 'tokens', {
				description: tokenStats ? `${tokenStats.totalTokens}` : 'No data',
				tooltip: tokenStats
					? `input:${tokenStats.inputTokens} refs:${tokenStats.referenceTokens} project:${tokenStats.projectTokens} images:${tokenStats.imageReferenceTokens} model:${tokenStats.modelId}`
					: 'Todavia no hay una medicion',
				icon: iconUri(this.context, 'fishing-history.svg'),
			}),
			new ControlItem('Agent Ask', 'agent-ask', {
				icon: iconUri(this.context, 'agent-ask.svg'),
				command: {
					command: 'atun-agent.useSkillPrompt',
					title: 'Agent Ask',
					arguments: ['ask'],
				},
			}),
			new ControlItem('Agent Plan', 'agent-plan', {
				icon: iconUri(this.context, 'agent-plan.svg'),
				command: {
					command: 'atun-agent.useSkillPrompt',
					title: 'Agent Plan',
					arguments: ['plan'],
				},
			}),
			new ControlItem('Agent Git', 'agent-git', {
				icon: iconUri(this.context, 'agent-git.svg'),
				command: {
					command: 'atun-agent.useSkillPrompt',
					title: 'Agent Git',
					arguments: ['git'],
				},
			}),
			new ControlItem('Agent Docs', 'agent-docs', {
				icon: iconUri(this.context, 'agent-docs.svg'),
				command: {
					command: 'atun-agent.useSkillPrompt',
					title: 'Agent Docs',
					arguments: ['docs'],
				},
			}),
		];
	}
}
