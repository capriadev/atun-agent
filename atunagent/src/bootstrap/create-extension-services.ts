import type * as vscode from 'vscode';
import { AtunAgentState } from '../agent-state';
import type { HostSupport } from '../host-support';
import { ProviderRegistry } from '../providers/provider-registry';
import { AtunShellViewProvider } from '../sidebar/atun-shell-view-provider';
import { SidebarViewModel } from '../sidebar/sidebar-view-model';
import { LocalDatabase } from '../storage/local-database';
import { SecretsService } from '../storage/secrets-service';
import { WorkspaceTools } from '../workspace-tools';

export interface ExtensionServices {
	state: AtunAgentState;
	tools: WorkspaceTools;
	database: LocalDatabase;
	providers: ProviderRegistry;
	sidebarViewModel: SidebarViewModel;
	shellViewProvider: AtunShellViewProvider;
}

export async function createExtensionServices(
	context: vscode.ExtensionContext,
	hostSupport: HostSupport,
): Promise<ExtensionServices> {
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

	return {
		state,
		tools,
		database,
		providers,
		sidebarViewModel,
		shellViewProvider,
	};
}
