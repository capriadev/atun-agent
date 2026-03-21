import * as vscode from 'vscode';
import type { AccessMode, TokenBreakdown } from './types';

const ACCESS_KEY = 'atunAgent.accessMode';
const THINKING_KEY = 'atunAgent.thinkingMode';
const MODEL_OVERRIDE_KEY = 'atunAgent.modelOverrideId';
const TOKENS_KEY = 'atunAgent.lastTokenBreakdown';

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
