import * as vscode from 'vscode';
import type { AccessMode, AgentMode, TokenBreakdown } from './types';

const ACCESS_KEY = 'atunAgent.accessMode';
const THINKING_KEY = 'atunAgent.thinkingMode';
const AGENT_MODE_KEY = 'atunAgent.agentMode';
const MODEL_OVERRIDE_KEY = 'atunAgent.modelOverrideId';
const TOKENS_KEY = 'atunAgent.lastTokenBreakdown';
const CONTEXT_FILES_KEY = 'atunAgent.contextFiles';

export class AtunAgentState {
	private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();

	private activeRequestCancellation: vscode.CancellationTokenSource | undefined;

	public readonly onDidChange = this.onDidChangeEmitter.event;

	public constructor(private readonly context: vscode.ExtensionContext) {}

	public get accessMode(): AccessMode {
		const configValue = vscode.workspace.getConfiguration('atunAgent').get<AccessMode>('accessMode');
		const stored = this.context.workspaceState.get<AccessMode>(ACCESS_KEY, configValue ?? 'isolated');
		return stored === 'full' ? 'full' : 'isolated';
	}

	public async setAccessMode(mode: AccessMode): Promise<void> {
		await this.context.workspaceState.update(ACCESS_KEY, mode);
		this.onDidChangeEmitter.fire();
	}

	public get thinkingMode(): boolean {
		return this.context.workspaceState.get<boolean>(THINKING_KEY, true);
	}

	public async setThinkingMode(enabled: boolean): Promise<void> {
		await this.context.workspaceState.update(THINKING_KEY, enabled);
		this.onDidChangeEmitter.fire();
	}

	public get agentMode(): AgentMode {
		const stored = this.context.workspaceState.get<AgentMode>(AGENT_MODE_KEY, 'ask');
		return isAgentMode(stored) ? stored : 'ask';
	}

	public async setAgentMode(mode: AgentMode): Promise<void> {
		await this.context.workspaceState.update(AGENT_MODE_KEY, mode);
		this.onDidChangeEmitter.fire();
	}

	public get modelOverrideId(): string | undefined {
		return this.context.workspaceState.get<string | undefined>(MODEL_OVERRIDE_KEY);
	}

	public async setModelOverrideId(modelId: string | undefined): Promise<void> {
		await this.context.workspaceState.update(MODEL_OVERRIDE_KEY, modelId);
		this.onDidChangeEmitter.fire();
	}

	public get lastTokenBreakdown(): TokenBreakdown | undefined {
		return this.context.workspaceState.get<TokenBreakdown | undefined>(TOKENS_KEY);
	}

	public async setLastTokenBreakdown(value: TokenBreakdown): Promise<void> {
		await this.context.workspaceState.update(TOKENS_KEY, value);
		this.onDidChangeEmitter.fire();
	}

	public get contextFileUris(): vscode.Uri[] {
		const stored = this.context.workspaceState.get<string[]>(CONTEXT_FILES_KEY, []);
		return stored
			.map((value) => {
				try {
					return vscode.Uri.parse(value);
				} catch {
					return undefined;
				}
			})
			.filter((value): value is vscode.Uri => Boolean(value));
	}

	public async addContextFiles(uris: readonly vscode.Uri[]): Promise<void> {
		if (uris.length === 0) {
			return;
		}
		const current = new Set(this.contextFileUris.map((item) => item.toString()));
		for (const uri of uris) {
			current.add(uri.toString());
		}
		await this.context.workspaceState.update(CONTEXT_FILES_KEY, Array.from(current.values()));
		this.onDidChangeEmitter.fire();
	}

	public async clearContextFiles(): Promise<void> {
		await this.context.workspaceState.update(CONTEXT_FILES_KEY, []);
		this.onDidChangeEmitter.fire();
	}

	public setActiveRequestCancellation(source: vscode.CancellationTokenSource | undefined): void {
		if (this.activeRequestCancellation && this.activeRequestCancellation !== source) {
			this.activeRequestCancellation.dispose();
		}
		this.activeRequestCancellation = source;
		this.onDidChangeEmitter.fire();
	}

	public hasRunningRequest(): boolean {
		return Boolean(this.activeRequestCancellation);
	}

	public stopActiveRequest(): boolean {
		if (!this.activeRequestCancellation) {
			return false;
		}
		this.activeRequestCancellation.cancel();
		this.activeRequestCancellation.dispose();
		this.activeRequestCancellation = undefined;
		this.onDidChangeEmitter.fire();
		return true;
	}
}

function isAgentMode(value: string): value is AgentMode {
	return value === 'ask' || value === 'plan' || value === 'git' || value === 'docs';
}
