import * as vscode from 'vscode';

export class SecretsService {
	public constructor(private readonly context: vscode.ExtensionContext) {}

	public async setApiKey(connectionId: string, apiKey: string): Promise<string> {
		const secretKeyRef = this.getApiKeyRef(connectionId);
		await this.context.secrets.store(secretKeyRef, apiKey);
		return secretKeyRef;
	}

	public async getApiKey(connectionId: string): Promise<string | undefined> {
		return this.context.secrets.get(this.getApiKeyRef(connectionId));
	}

	public async deleteApiKey(connectionId: string): Promise<void> {
		await this.context.secrets.delete(this.getApiKeyRef(connectionId));
	}

	public getApiKeyRef(connectionId: string): string {
		return `provider:${connectionId}:apiKey`;
	}
}
