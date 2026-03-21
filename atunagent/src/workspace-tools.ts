import * as path from 'node:path';
import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';

export interface WorkspaceActionResult {
	ok: boolean;
	message: string;
	uri?: vscode.Uri;
	lines?: string[];
}

export class WorkspaceTools {
	public constructor(private readonly state: AtunAgentState) {}

	public async listFiles(pattern: string): Promise<WorkspaceActionResult> {
		const include = pattern.trim() || '**/*';
		const files = await vscode.workspace.findFiles(include, DEFAULT_EXCLUDE_GLOB, 200);
		const lines = files.map((uri) => vscode.workspace.asRelativePath(uri, false));
		if (lines.length === 0) {
			return { ok: true, message: `No files found for pattern "${include}".`, lines: [] };
		}
		return {
			ok: true,
			message: `Found ${lines.length} files for pattern "${include}".`,
			lines,
		};
	}

	public async readFile(pathArg: string): Promise<WorkspaceActionResult> {
		const uri = this.resolveWorkspaceUri(pathArg);
		if (!uri) {
			return { ok: false, message: 'Path is required and must be inside the current workspace.' };
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(bytes).toString('utf8');
			await this.openInEditor(uri);
			return { ok: true, message: `Read ${vscode.workspace.asRelativePath(uri, false)}.`, uri, lines: text.split(/\r?\n/).slice(0, 120) };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown read error';
			return { ok: false, message: `Cannot read file: ${message}` };
		}
	}

	public async createFile(pathArg: string, content: string, source: 'chat' | 'command'): Promise<WorkspaceActionResult> {
		const guard = await this.guardWriteOperation(
			`Create file "${pathArg}"?`,
			source,
		);
		if (!guard.ok) {
			return guard;
		}

		const uri = this.resolveWorkspaceUri(pathArg);
		if (!uri) {
			return { ok: false, message: 'Path is required and must be inside the current workspace.' };
		}

		try {
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
			await this.openInEditor(uri);
			return { ok: true, message: `Created ${vscode.workspace.asRelativePath(uri, false)}.`, uri };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown create error';
			return { ok: false, message: `Cannot create file: ${message}` };
		}
	}

	public async updateFile(pathArg: string, content: string, source: 'chat' | 'command'): Promise<WorkspaceActionResult> {
		const guard = await this.guardWriteOperation(
			`Update file "${pathArg}"?`,
			source,
		);
		if (!guard.ok) {
			return guard;
		}

		const uri = this.resolveWorkspaceUri(pathArg);
		if (!uri) {
			return { ok: false, message: 'Path is required and must be inside the current workspace.' };
		}

		try {
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
			await this.openInEditor(uri);
			return { ok: true, message: `Updated ${vscode.workspace.asRelativePath(uri, false)}.`, uri };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown update error';
			return { ok: false, message: `Cannot update file: ${message}` };
		}
	}

	public async deleteFileToTrash(pathArg: string, source: 'chat' | 'command'): Promise<WorkspaceActionResult> {
		const deleteMode = vscode.workspace
			.getConfiguration('atunAgent')
			.get<string>('workspace.deleteMode', 'trash');
		if (deleteMode !== 'trash') {
			return { ok: false, message: `Delete mode "${deleteMode}" is not supported.` };
		}

		const guard = await this.guardWriteOperation(
			`Delete "${pathArg}" to system trash?`,
			source,
		);
		if (!guard.ok) {
			return guard;
		}

		const uri = this.resolveWorkspaceUri(pathArg);
		if (!uri) {
			return { ok: false, message: 'Path is required and must be inside the current workspace.' };
		}

		try {
			await vscode.workspace.fs.delete(uri, { useTrash: true, recursive: false });
			return { ok: true, message: `Moved ${vscode.workspace.asRelativePath(uri, false)} to trash.` };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown delete error';
			return { ok: false, message: `Delete aborted: cannot move file to trash (${message}).` };
		}
	}

	public async runTerminalCommand(commandText: string, source: 'chat' | 'command'): Promise<WorkspaceActionResult> {
		const trimmed = commandText.trim();
		if (!trimmed) {
			return { ok: false, message: 'Terminal command cannot be empty.' };
		}

		const guard = await this.guardWriteOperation(
			`Run terminal command?\n\n${trimmed}`,
			source,
		);
		if (!guard.ok) {
			return guard;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		const task = new vscode.Task(
			{ type: 'shell' },
			workspaceFolder ?? vscode.TaskScope.Workspace,
			`Atun: ${trimmed.slice(0, 42)}`,
			'Atun Agent',
			new vscode.ShellExecution(trimmed, {
				cwd: workspaceFolder?.uri.fsPath,
			}),
		);
		task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Always,
			panel: vscode.TaskPanelKind.Dedicated,
			focus: false,
			showReuseMessage: false,
		};

		try {
			const execution = await vscode.tasks.executeTask(task);
			const end = await waitTaskEnd(execution);
			if (typeof end === 'number' && end !== 0) {
				return { ok: false, message: `Terminal command finished with exit code ${end}.` };
			}
			return {
				ok: true,
				message: typeof end === 'number'
					? `Terminal command finished with exit code ${end}.`
					: 'Terminal command started in integrated terminal.',
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown terminal error';
			return { ok: false, message: `Cannot run terminal command: ${message}` };
		}
	}

	public parsePathAndContent(prompt: string): { pathArg: string; content: string } | undefined {
		const lines = prompt.split(/\r?\n/);
		const pathArg = lines.shift()?.trim() ?? '';
		if (!pathArg) {
			return undefined;
		}

		const rawContent = lines.join('\n').trim();
		if (!rawContent) {
			return { pathArg, content: '' };
		}

		return { pathArg, content: unwrapFencedCode(rawContent) };
	}

	private async guardWriteOperation(prompt: string, source: 'chat' | 'command'): Promise<WorkspaceActionResult> {
		const accessMode = this.state.accessMode;
		if (accessMode !== 'full') {
			return { ok: false, message: 'Blocked: access mode is isolated. Switch to full access to execute this action.' };
		}

		const requireConfirm = vscode.workspace
			.getConfiguration('atunAgent')
			.get<boolean>('workspace.requireConfirm', true);
		if (!requireConfirm) {
			return { ok: true, message: 'Confirmed by configuration.' };
		}

		const confirmed = await vscode.window.showWarningMessage(
			prompt,
			{ modal: source === 'chat' },
			'Confirm',
		);
		if (confirmed !== 'Confirm') {
			return { ok: false, message: 'Action canceled by user.' };
		}

		return { ok: true, message: 'Action confirmed.' };
	}

	private resolveWorkspaceUri(inputPath: string): vscode.Uri | undefined {
		const trimmed = inputPath.trim();
		if (!trimmed) {
			return undefined;
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return undefined;
		}

		const candidate = path.isAbsolute(trimmed)
			? vscode.Uri.file(path.normalize(trimmed))
			: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, trimmed));
		const owningFolder = vscode.workspace.getWorkspaceFolder(candidate);
		if (!owningFolder) {
			return undefined;
		}

		return candidate;
	}

	private async openInEditor(uri: vscode.Uri): Promise<void> {
		const document = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(document, { preview: false });
	}
}

const DEFAULT_EXCLUDE_GLOB = '**/{node_modules,.git,.vscode-test,dist,out,coverage,packages}/**';

function unwrapFencedCode(content: string): string {
	const trimmed = content.trim();
	const match = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
	return match ? match[1] : content;
}

async function waitTaskEnd(execution: vscode.TaskExecution): Promise<number | undefined> {
	return new Promise<number | undefined>((resolve) => {
		const timeout = setTimeout(() => {
			dispose();
			resolve(undefined);
		}, 2500);

		const disposable = vscode.tasks.onDidEndTaskProcess((event) => {
			if (event.execution !== execution) {
				return;
			}
			clearTimeout(timeout);
			dispose();
			resolve(event.exitCode);
		});

		function dispose(): void {
			disposable.dispose();
		}
	});
}
