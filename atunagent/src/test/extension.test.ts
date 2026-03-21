import * as assert from 'assert';
import * as vscode from 'vscode';

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
});
