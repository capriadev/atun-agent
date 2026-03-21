import * as path from 'node:path';
import * as vscode from 'vscode';
import { AtunAgentState } from './agent-state';
import type { AgentMode } from './types';
import { WorkspaceTools } from './workspace-tools';

interface AtunChatResult extends vscode.ChatResult {
	metadata: {
		command?: string;
	};
}

const CHAT_PARTICIPANT_ID = 'atun-agent.atun';
const MAX_FILE_CONTEXT = 12000;

export function registerAtunChatParticipant(
	context: vscode.ExtensionContext,
	state: AtunAgentState,
	tools: WorkspaceTools,
): vscode.ChatParticipant {
	const participant = vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, async (request, chatContext, stream, token) => {
		const command = request.command;
		if (command) {
			const commandResult = await handleSlashCommand(command, request, stream, tools);
			return { metadata: { command: commandResult.command } };
		}

		const model = await resolveModel(request.model, state.modelOverrideId);
		const prompt = await buildPrompt(request, chatContext, state);
		const messages = toLanguageModelMessages(chatContext, prompt);
		const requestCancellation = new vscode.CancellationTokenSource();
		const tokenDisposable = token.onCancellationRequested(() => requestCancellation.cancel());
		state.setActiveRequestCancellation(requestCancellation);

		try {
			const response = await model.sendRequest(messages, {}, requestCancellation.token);
			for await (const chunk of response.text) {
				stream.markdown(chunk);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown chat error';
			stream.markdown(`Error: ${message}`);
		} finally {
			tokenDisposable.dispose();
			requestCancellation.dispose();
			state.setActiveRequestCancellation(undefined);
		}

		return { metadata: {} };
	});

	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icons', 'ghost-chat.svg');
	participant.followupProvider = {
		provideFollowups(result) {
			const command = (result.metadata as { command?: string } | undefined)?.command;
			if (command === 'list' || command === 'read') {
				return [
					{ prompt: 'Show me a safe edit plan for this workspace', label: 'Plan next edit' },
					{ prompt: '/create src/new-file.ts\n```ts\nexport {};\n```', label: 'Create file' },
				];
			}
			if (command === 'create' || command === 'update') {
				return [
					{ prompt: 'Review this change and propose tests', label: 'Review change' },
					{ prompt: '/terminal npm test', label: 'Run tests in terminal' },
				];
			}
			return [
				{ prompt: '/list src/**/*', label: 'List workspace files' },
				{ prompt: '/read README.md', label: 'Read README.md' },
			];
		},
	};

	return participant;
}

function toLanguageModelMessages(
	chatContext: vscode.ChatContext,
	currentPrompt: string,
): vscode.LanguageModelChatMessage[] {
	const messages: vscode.LanguageModelChatMessage[] = [];

	for (const item of chatContext.history.slice(-10)) {
		if (item instanceof vscode.ChatRequestTurn) {
			messages.push(vscode.LanguageModelChatMessage.User(item.prompt));
			continue;
		}

		if (item instanceof vscode.ChatResponseTurn) {
			const text = item.response
				.map((part) => (part instanceof vscode.ChatResponseMarkdownPart ? part.value.value : ''))
				.join('\n')
				.trim();
			if (text) {
				messages.push(vscode.LanguageModelChatMessage.Assistant(text));
			}
		}
	}

	messages.push(vscode.LanguageModelChatMessage.User(currentPrompt));
	return messages;
}

async function buildPrompt(
	request: vscode.ChatRequest,
	chatContext: vscode.ChatContext,
	state: AtunAgentState,
): Promise<string> {
	const modeInstruction = getModeInstruction(state.agentMode);
	const accessInstruction = state.accessMode === 'full'
		? 'Access mode is full. File and terminal actions may execute only when explicit confirmation was granted.'
		: 'Access mode is isolated. Do not execute mutating operations.';
	const historyHint = chatContext.history.length > 0
		? `Conversation turns in context: ${chatContext.history.length}.`
		: 'No previous conversation context.';
	const promptReferences = await readPromptReferences(request.references);
	const persistedContext = await readPersistedContextFiles(state.contextFileUris);

	return [
		'[Atun Agent]',
		accessInstruction,
		modeInstruction,
		historyHint,
		request.prompt,
		promptReferences ? `[Prompt References]\n${promptReferences}` : '',
		persistedContext ? `[Pinned Context Files]\n${persistedContext}` : '',
	]
		.filter((item) => item.length > 0)
		.join('\n\n');
}

async function handleSlashCommand(
	command: string,
	request: vscode.ChatRequest,
	stream: vscode.ChatResponseStream,
	tools: WorkspaceTools,
): Promise<{ command: string }> {
	switch (command) {
		case 'list': {
			stream.progress('Listing workspace files...');
			const result = await tools.listFiles(request.prompt);
			stream.markdown(result.message);
			if (result.lines && result.lines.length > 0) {
				stream.markdown(`\n\`\`\`text\n${result.lines.join('\n')}\n\`\`\``);
			}
			break;
		}
		case 'read': {
			stream.progress('Reading workspace file...');
			const result = await tools.readFile(request.prompt.trim());
			stream.markdown(result.message);
			if (result.lines && result.lines.length > 0) {
				stream.markdown(`\n\`\`\`\n${result.lines.join('\n')}\n\`\`\``);
			}
			if (result.uri) {
				stream.reference(result.uri);
			}
			break;
		}
		case 'create': {
			const parsed = tools.parsePathAndContent(request.prompt);
			if (!parsed) {
				stream.markdown('Usage: `/create relative/path.ext` then file content in following lines.');
				break;
			}
			stream.progress(`Creating ${parsed.pathArg}...`);
			const result = await tools.createFile(parsed.pathArg, parsed.content, 'chat');
			stream.markdown(result.message);
			if (result.uri) {
				stream.reference(result.uri);
			}
			break;
		}
		case 'update': {
			const parsed = tools.parsePathAndContent(request.prompt);
			if (!parsed || !parsed.content.trim()) {
				stream.markdown('Usage: `/update relative/path.ext` and include new file content.');
				break;
			}
			stream.progress(`Updating ${parsed.pathArg}...`);
			const result = await tools.updateFile(parsed.pathArg, parsed.content, 'chat');
			stream.markdown(result.message);
			if (result.uri) {
				stream.reference(result.uri);
			}
			break;
		}
		case 'delete': {
			const pathArg = request.prompt.trim();
			if (!pathArg) {
				stream.markdown('Usage: `/delete relative/path.ext`');
				break;
			}
			stream.progress(`Deleting ${pathArg} to trash...`);
			const result = await tools.deleteFileToTrash(pathArg, 'chat');
			stream.markdown(result.message);
			break;
		}
		case 'terminal': {
			stream.progress('Running terminal command...');
			const result = await tools.runTerminalCommand(request.prompt, 'chat');
			stream.markdown(result.message);
			break;
		}
		default:
			stream.markdown(`Unsupported command: /${command}`);
			break;
	}

	return { command };
}

async function resolveModel(
	requestModel: vscode.LanguageModelChat,
	overrideId: string | undefined,
): Promise<vscode.LanguageModelChat> {
	if (!overrideId) {
		return requestModel;
	}

	const selected = await vscode.lm.selectChatModels({ id: overrideId });
	return selected[0] ?? requestModel;
}

function getModeInstruction(mode: AgentMode): string {
	if (mode === 'plan') {
		return 'Mode plan: provide decision-complete implementation plans before code changes.';
	}
	if (mode === 'git') {
		return 'Mode git: prioritize patch quality and clear commit-ready output.';
	}
	if (mode === 'docs') {
		return 'Mode docs: prioritize concise and accurate documentation quality.';
	}
	return 'Mode ask: answer directly and execute requested coding tasks.';
}

async function readPersistedContextFiles(files: readonly vscode.Uri[]): Promise<string> {
	const parts: string[] = [];
	for (const uri of files.slice(0, 12)) {
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const content = Buffer.from(bytes).toString('utf8').slice(0, MAX_FILE_CONTEXT);
			parts.push(`### ${vscode.workspace.asRelativePath(uri, false)}\n${content}`);
		} catch {
			parts.push(`### ${vscode.workspace.asRelativePath(uri, false)}\n[Failed to read file]`);
		}
	}
	return parts.join('\n\n');
}

async function readPromptReferences(references: readonly vscode.ChatPromptReference[]): Promise<string> {
	if (references.length === 0) {
		return '';
	}

	const parts: string[] = [];
	for (const reference of references) {
		const value = reference.value;
		if (typeof value === 'string') {
			parts.push(`- ${value}`);
			continue;
		}

		const uri = toUri(value);
		if (!uri) {
			continue;
		}

		const extension = path.extname(uri.fsPath).toLowerCase();
		if (IMAGE_EXTENSIONS.has(extension)) {
			parts.push(`### ${vscode.workspace.asRelativePath(uri, false)}\n[Image reference]`);
			continue;
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const content = Buffer.from(bytes).toString('utf8').slice(0, MAX_FILE_CONTEXT);
			parts.push(`### ${vscode.workspace.asRelativePath(uri, false)}\n${content}`);
		} catch {
			parts.push(`### ${vscode.workspace.asRelativePath(uri, false)}\n[Failed to read reference]`);
		}
	}

	return parts.join('\n\n');
}

function toUri(value: unknown): vscode.Uri | undefined {
	if (value instanceof vscode.Uri) {
		return value;
	}

	if (value instanceof vscode.Location) {
		return value.uri;
	}

	if (
		typeof value === 'object'
		&& value !== null
		&& 'uri' in value
		&& (value as { uri?: unknown }).uri instanceof vscode.Uri
	) {
		return (value as { uri: vscode.Uri }).uri;
	}

	return undefined;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']);
