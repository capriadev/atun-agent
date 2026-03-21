import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { LocalDatabase } from '../local-database';

suite('Extension Test Suite', () => {
	test('Smoke test', () => {
		assert.strictEqual(true, true);
	});

	test('Registers Atun commands', async () => {
		const extension = vscode.extensions.getExtension('capriadev.atun-agent');
		await extension?.activate();

		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('atun-agent.openChat'));
		assert.ok(commands.includes('atun-agent.focusSidebar'));
		assert.ok(commands.includes('atun-agent.workspace.createFile'));
		assert.ok(commands.includes('atun-agent.workspace.deleteFile'));
		assert.ok(commands.includes('atun-agent.workspace.runTerminal'));
	});

	test('Initializes local database and persists a provider connection', async () => {
		const extension = vscode.extensions.getExtension('capriadev.atun-agent');
		await extension?.activate();

		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atun-agent-db-'));
		try {
			const database = new LocalDatabase({
				storagePath: tempDir,
				extensionPath: extension?.extensionPath ?? path.resolve(__dirname, '../../..'),
			});
			await database.initialize();
			assert.strictEqual(await database.hasConnections(), false);

			await database.createConnection({
				id: 'conn-1',
				providerKind: 'groq',
				displayName: 'Groq Local',
				secretKeyRef: 'provider:conn-1:apiKey',
				isActive: true,
				models: [
					{ id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile', enabled: true },
				],
			});

			assert.strictEqual(await database.hasConnections(), true);
			const active = await database.getActiveConnection();
			assert.ok(active);
			assert.strictEqual(active?.displayName, 'Groq Local');

			const models = await database.listEnabledModels('conn-1');
			assert.strictEqual(models.length, 1);
			assert.strictEqual(models[0]?.id, 'llama-3.3-70b-versatile');
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});
});
