import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const extensionDir = join(root, 'atunagent');

const extensionPackagePath = join(extensionDir, 'package.json');
const extensionPkg = JSON.parse(readFileSync(extensionPackagePath, 'utf8'));

const extensionName = extensionPkg.name;
const extensionVersion = extensionPkg.version;
if (!extensionName || !extensionVersion) {
	throw new Error('Invalid extension package.json: name/version are required.');
}

const versionDir = join(root, 'packages', `v${extensionVersion}`);
if (!existsSync(versionDir)) {
	mkdirSync(versionDir, { recursive: true });
}

const outputVsix = join(versionDir, `${extensionName}-${extensionVersion}.vsix`);

console.log(`[atun-agent] Packaging VSIX -> ${outputVsix}`);

const command = `npx --yes @vscode/vsce package --out "${outputVsix}"`;
execSync(command, {
	cwd: extensionDir,
	stdio: 'inherit',
	env: process.env,
});

console.log('[atun-agent] VSIX ready.');