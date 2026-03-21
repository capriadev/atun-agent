import * as path from 'node:path';
import * as vscode from 'vscode';

export function iconUri(context: vscode.ExtensionContext, fileName: string): vscode.Uri {
	return vscode.Uri.file(path.join(context.extensionPath, 'assets', 'icons', fileName));
}
