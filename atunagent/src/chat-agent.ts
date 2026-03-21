import * as path from 'node:path';
import * as vscode from 'vscode';
import { iconUri } from './icons';
import { AtunAgentState } from './agent-state';
import type { AccessMode, TokenBreakdown } from './types';

const TEXT_FILE_EXTENSIONS = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.json',
	'.md',
	'.txt',
	'.yml',
	'.yaml',
	'.toml',
	'.xml',
	'.html',
	'.css',
	'.scss',
	'.sql',
	'.py',
	'.java',
	'.go',
	'.rs',
	'.c',
	'.cpp',
	'.h',
	'.hpp',
	'.cs',
	'.sh',
	'.ps1',
	'.env',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']);

interface ReferenceBundle {
	referenceText: string;
	imageReferenceText: string;
}

export function registerAtunParticipant(
	context: vscode.ExtensionContext,
	state: AtunAgentState,
): vscode.ChatParticipant {
	const participant = vscode.chat.createChatParticipant('atun-agent.atun', async (request, chatContext, response, token) => {
		const linkedSource = new vscode.CancellationTokenSource();
		const tokenSubscription = token.onCancellationRequested(() => linkedSource.cancel());
		state.setActiveRequestCancellation(linkedSource);

		try {
			if (request.command === 'skills') {
				response.markdown(
					`### Skills disponibles\n- \`agent-ask\`\n- \`agent-plan\`\n- \`agent-git\`\n- \`agent-docs\`\n- \`agent-debuger\`\n- \`agent-translator\``,
				);
				return;
			}

			if (request.command === 'access') {
				const next = normalizeAccessMode(request.prompt);
				await state.setAccessMode(next);
				response.markdown(`Access actualizado a **${next === 'full' ? 'Full' : 'Isolated'}**.`);
				return;
			}

			if (request.command === 'thinking') {
				const next = normalizeBoolean(request.prompt, !state.thinkingMode);
				await state.setThinkingMode(next);
				response.markdown(`Thinking mode: **${next ? 'ON' : 'OFF'}**.`);
				return;
			}

			const model = await resolveModel(request.model, state.modelOverrideId);
			const referenceBundle = await collectReferenceBundle(request.references, token);
			const projectDescriptor = await collectProjectDescriptor();
			const tokenBreakdown = await buildTokenBreakdown(
				model,
				request.prompt,
				referenceBundle.referenceText,
				referenceBundle.imageReferenceText,
				projectDescriptor,
				token,
			);

			await state.setLastTokenBreakdown(tokenBreakdown);
			response.progress(
				`Model: ${model.name} | Tokens => input:${tokenBreakdown.inputTokens} refs:${tokenBreakdown.referenceTokens} project:${tokenBreakdown.projectTokens} total:${tokenBreakdown.totalTokens}`,
			);

			const messages = buildMessages(request, chatContext, state, referenceBundle, projectDescriptor);
			const result = await model.sendRequest(messages, {}, linkedSource.token);
			for await (const chunk of result.text) {
				response.markdown(chunk);
			}

			for (const reference of request.references) {
				if (reference.value instanceof vscode.Uri) {
					response.reference(reference.value, iconUri(context, 'hash.svg'));
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			return { errorDetails: { message } };
		} finally {
			tokenSubscription.dispose();
			linkedSource.dispose();
			state.setActiveRequestCancellation(undefined);
		}
	});

	participant.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'assets', 'icons', 'logo', 'atunagent.svg'));
	participant.followupProvider = {
		provideFollowups: () => [
			{ prompt: '/skills', label: '/skills' },
			{ prompt: '/thinking on', label: 'thinking on' },
			{ prompt: '/access full', label: 'access full' },
		],
	};

	return participant;
}

function normalizeAccessMode(rawPrompt: string): AccessMode {
	return /\bfull\b/i.test(rawPrompt) ? 'full' : 'isolated';
}

function normalizeBoolean(rawPrompt: string, fallback: boolean): boolean {
	if (/\b(on|true|1|high)\b/i.test(rawPrompt)) {
		return true;
	}
	if (/\b(off|false|0|low)\b/i.test(rawPrompt)) {
		return false;
	}
	return fallback;
}

async function resolveModel(baseModel: vscode.LanguageModelChat, modelOverrideId?: string): Promise<vscode.LanguageModelChat> {
	if (!modelOverrideId) {
		return baseModel;
	}

	try {
		const [overrideModel] = await vscode.lm.selectChatModels({ id: modelOverrideId });
		return overrideModel ?? baseModel;
	} catch {
		return baseModel;
	}
}

function buildMessages(
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	state: AtunAgentState,
	references: ReferenceBundle,
	projectDescriptor: string,
): vscode.LanguageModelChatMessage[] {
	const messages: vscode.LanguageModelChatMessage[] = [];
	const history = context.history.slice(-6);
	for (const turn of history) {
		if (turn instanceof vscode.ChatRequestTurn) {
			messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
			continue;
		}
		if (turn instanceof vscode.ChatResponseTurn) {
			const text = turn.response
				.filter((part) => part instanceof vscode.ChatResponseMarkdownPart)
				.map((part) => part.value.value)
				.join('\n')
				.trim();
			if (text) {
				messages.push(vscode.LanguageModelChatMessage.Assistant(text));
			}
		}
	}

	const behavior = [
		'You are Atun Agent integrated in VS Code.',
		`Access mode: ${state.accessMode}.`,
		`Reasoning mode: ${state.thinkingMode ? 'high' : 'normal'}.`,
		'If access mode is isolated, avoid destructive/system-level instructions.',
	];

	const promptSections = [
		`[Agent Context]\n${behavior.join('\n')}`,
		request.prompt,
		references.referenceText ? `\n[Attached References]\n${references.referenceText}` : '',
		references.imageReferenceText ? `\n[Image References]\n${references.imageReferenceText}` : '',
		projectDescriptor ? `\n[Project Snapshot]\n${projectDescriptor}` : '',
	].filter((entry) => entry.length > 0);

	messages.push(vscode.LanguageModelChatMessage.User(promptSections.join('\n\n')));
	return messages;
}

async function buildTokenBreakdown(
	model: vscode.LanguageModelChat,
	prompt: string,
	referenceText: string,
	imageReferenceText: string,
	projectDescriptor: string,
	token: vscode.CancellationToken,
): Promise<TokenBreakdown> {
	const inputTokens = await countTokensSafe(model, prompt, token);
	const referenceTokens = await countTokensSafe(model, referenceText, token);
	const imageReferenceTokens = await countTokensSafe(model, imageReferenceText, token);
	const projectTokens = await countTokensSafe(model, projectDescriptor, token);

	return {
		inputTokens,
		referenceTokens,
		imageReferenceTokens,
		projectTokens,
		totalTokens: inputTokens + referenceTokens + imageReferenceTokens + projectTokens,
		modelId: model.id,
	};
}

async function countTokensSafe(
	model: vscode.LanguageModelChat,
	text: string,
	token: vscode.CancellationToken,
): Promise<number> {
	if (!text.trim()) {
		return 0;
	}

	try {
		return await model.countTokens(text, token);
	} catch {
		return Math.max(1, Math.ceil(text.length / 4));
	}
}

async function collectReferenceBundle(
	references: readonly vscode.ChatPromptReference[],
	token: vscode.CancellationToken,
): Promise<ReferenceBundle> {
	const textParts: string[] = [];
	const imageParts: string[] = [];

	for (const reference of references) {
		if (token.isCancellationRequested) {
			break;
		}
		const value = reference.value;
		const description = reference.modelDescription ?? reference.id;

		if (typeof value === 'string') {
			textParts.push(`[${description}]\n${value}`);
			continue;
		}

		if (value instanceof vscode.Location) {
			const document = await vscode.workspace.openTextDocument(value.uri);
			const line = document.lineAt(value.range.start.line).text;
			textParts.push(`[${description} | ${document.uri.fsPath}:${value.range.start.line + 1}]\n${line}`);
			continue;
		}

		if (value instanceof vscode.Uri) {
			const extension = path.extname(value.fsPath).toLowerCase();
			if (IMAGE_EXTENSIONS.has(extension)) {
				imageParts.push(`[${description}] ${value.fsPath}`);
				continue;
			}

			if (TEXT_FILE_EXTENSIONS.has(extension) || extension === '') {
				try {
					const bytes = await vscode.workspace.fs.readFile(value);
					const content = Buffer.from(bytes).toString('utf8').slice(0, 12000);
					textParts.push(`[${description} | ${value.fsPath}]\n${content}`);
				} catch {
					textParts.push(`[${description}] ${value.fsPath}`);
				}
				continue;
			}

			textParts.push(`[${description}] ${value.fsPath}`);
			continue;
		}

		try {
			textParts.push(`[${description}]\n${JSON.stringify(value).slice(0, 6000)}`);
		} catch {
			textParts.push(`[${description}] [Unsupported reference value]`);
		}
	}

	return {
		referenceText: textParts.join('\n\n'),
		imageReferenceText: imageParts.join('\n'),
	};
}

async function collectProjectDescriptor(): Promise<string> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return '';
	}

	const files = await vscode.workspace.findFiles(
		'**/*',
		'**/{node_modules,.git,.vscode-test,dist,out,coverage}/**',
		200,
	);

	const lines: string[] = [];
	for (const file of files) {
		lines.push(vscode.workspace.asRelativePath(file, false));
	}

	const openDocs = vscode.workspace.textDocuments
		.filter((doc) => !doc.isUntitled && doc.uri.scheme === 'file')
		.slice(0, 10)
		.map((doc) => `open:${vscode.workspace.asRelativePath(doc.uri, false)}`);

	return [...lines, ...openDocs].join('\n');
}
