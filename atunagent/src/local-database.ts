import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import initSqlJs, { type Database, type SqlValue, type Statement } from 'sql.js';
import type {
	ChatMessageRecord,
	ChatRole,
	ChatSessionRecord,
	ProviderConnectionRecord,
	ProviderConnectionSummary,
	ProviderKind,
	ProviderModel,
	ProviderModelRecord,
} from './types';

interface LocalDatabaseOptions {
	storagePath: string;
	extensionPath: string;
}

interface ConnectionInsertInput {
	id: string;
	providerKind: ProviderKind;
	displayName: string;
	secretKeyRef: string;
	isActive: boolean;
	models: ProviderModel[];
}

interface MessageInsertInput {
	id: string;
	sessionId: string;
	role: ChatRole;
	content: string;
	createdAt: string;
	errorText?: string;
}

const SCHEMA_VERSION = '1';

export class LocalDatabase {
	private readonly dbFilePath: string;
	private database: Database | undefined;
	private operationQueue: Promise<void> = Promise.resolve();

	public constructor(private readonly options: LocalDatabaseOptions) {
		this.dbFilePath = path.join(options.storagePath, 'atun-agent.sqlite');
	}

	public async initialize(): Promise<void> {
		await fs.mkdir(this.options.storagePath, { recursive: true });

		const SQL = await initSqlJs({
			locateFile: (file: string) => path.join(this.options.extensionPath, 'assets', 'vendor', file),
		});

		let bytes: Uint8Array | undefined;
		try {
			bytes = new Uint8Array(await fs.readFile(this.dbFilePath));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}

		this.database = bytes ? new SQL.Database(bytes) : new SQL.Database();
		await this.transaction(async () => {
			this.database?.run(`
				CREATE TABLE IF NOT EXISTS app_settings (
					key TEXT PRIMARY KEY,
					value TEXT NOT NULL
				);
				CREATE TABLE IF NOT EXISTS provider_connections (
					id TEXT PRIMARY KEY,
					provider_kind TEXT NOT NULL,
					display_name TEXT NOT NULL,
					secret_key_ref TEXT NOT NULL,
					is_active INTEGER NOT NULL,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				CREATE TABLE IF NOT EXISTS provider_models (
					id TEXT PRIMARY KEY,
					connection_id TEXT NOT NULL,
					model_id TEXT NOT NULL,
					model_label TEXT NOT NULL,
					enabled INTEGER NOT NULL,
					sort_order INTEGER NOT NULL,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				CREATE TABLE IF NOT EXISTS chat_sessions (
					id TEXT PRIMARY KEY,
					connection_id TEXT NOT NULL,
					title TEXT NOT NULL,
					selected_model_id TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL
				);
				CREATE TABLE IF NOT EXISTS chat_messages (
					id TEXT PRIMARY KEY,
					session_id TEXT NOT NULL,
					role TEXT NOT NULL,
					content TEXT NOT NULL,
					created_at TEXT NOT NULL,
					error_text TEXT
				);
			`);

			this.run(
				'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
				['schema_version', SCHEMA_VERSION],
			);
		});
	}

	public async transaction<T>(callback: () => Promise<T> | T): Promise<T> {
		return this.withLock(async () => {
			const db = this.requireDatabase();
			db.run('BEGIN IMMEDIATE TRANSACTION');
			try {
				const result = await callback();
				db.run('COMMIT');
				await this.persist();
				return result;
			} catch (error) {
				try {
					db.run('ROLLBACK');
				} catch {
					// ignore rollback failures
				}
				throw error;
			}
		});
	}

	public async hasConnections(): Promise<boolean> {
		return this.withLock(async () => {
			const row = this.getSingle<{ total: number }>(
				'SELECT COUNT(*) as total FROM provider_connections',
				[],
				(stmt) => ({ total: Number(stmt.getAsObject().total ?? 0) }),
			);
			return (row?.total ?? 0) > 0;
		});
	}

	public async getConnectionSummaries(): Promise<ProviderConnectionSummary[]> {
		return this.withLock(async () => this.getAll(
			'SELECT id, provider_kind, display_name, is_active FROM provider_connections ORDER BY is_active DESC, updated_at DESC',
			[],
			(stmt) => {
				const row = stmt.getAsObject();
				return {
					id: String(row.id),
					providerKind: String(row.provider_kind) as ProviderKind,
					displayName: String(row.display_name),
					isActive: Number(row.is_active) === 1,
				};
			},
		));
	}

	public async getActiveConnection(): Promise<ProviderConnectionRecord | undefined> {
		return this.withLock(async () => this.getSingleConnection(
			'SELECT * FROM provider_connections WHERE is_active = 1 LIMIT 1',
			[],
		));
	}

	public async getConnectionById(connectionId: string): Promise<ProviderConnectionRecord | undefined> {
		return this.withLock(async () => this.getSingleConnection(
			'SELECT * FROM provider_connections WHERE id = ? LIMIT 1',
			[connectionId],
		));
	}

	public async createConnection(input: ConnectionInsertInput): Promise<void> {
		await this.transaction(async () => {
			const now = nowIso();

			this.run('UPDATE provider_connections SET is_active = 0, updated_at = ?', [now]);
			this.run(
				`INSERT INTO provider_connections
					(id, provider_kind, display_name, secret_key_ref, is_active, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					input.id,
					input.providerKind,
					input.displayName,
					input.secretKeyRef,
					input.isActive ? 1 : 0,
					now,
					now,
				],
			);

			for (const [index, model] of input.models.entries()) {
				this.run(
					`INSERT INTO provider_models
						(id, connection_id, model_id, model_label, enabled, sort_order, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						`${input.id}:${index}:${model.id}`,
						input.id,
						model.id,
						model.label,
						model.enabled ? 1 : 0,
						index,
						now,
						now,
					],
				);
			}
		});
	}

	public async setActiveConnection(connectionId: string): Promise<void> {
		await this.transaction(async () => {
			const now = nowIso();
			this.run('UPDATE provider_connections SET is_active = 0, updated_at = ?', [now]);
			this.run('UPDATE provider_connections SET is_active = 1, updated_at = ? WHERE id = ?', [now, connectionId]);
		});
	}

	public async listModelsForConnection(connectionId: string): Promise<ProviderModelRecord[]> {
		return this.withLock(async () => this.getAll(
			'SELECT * FROM provider_models WHERE connection_id = ? ORDER BY sort_order ASC, model_label ASC',
			[connectionId],
			mapProviderModelRow,
		));
	}

	public async listEnabledModels(connectionId: string): Promise<ProviderModelRecord[]> {
		return this.withLock(async () => this.getAll(
			'SELECT * FROM provider_models WHERE connection_id = ? AND enabled = 1 ORDER BY sort_order ASC, model_label ASC',
			[connectionId],
			mapProviderModelRow,
		));
	}

	public async getLatestSession(connectionId: string): Promise<ChatSessionRecord | undefined> {
		return this.withLock(async () => this.getSingle(
			'SELECT * FROM chat_sessions WHERE connection_id = ? ORDER BY updated_at DESC LIMIT 1',
			[connectionId],
			mapChatSessionRow,
		));
	}

	public async createChatSession(connectionId: string, title: string, selectedModelId?: string): Promise<ChatSessionRecord> {
		return this.transaction(async () => {
			const createdAt = nowIso();
			const session: ChatSessionRecord = {
				id: crypto.randomUUID(),
				connectionId,
				title,
				selectedModelId,
				createdAt,
				updatedAt: createdAt,
			};

			this.run(
				`INSERT INTO chat_sessions
					(id, connection_id, title, selected_model_id, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
				[
					session.id,
					session.connectionId,
					session.title,
					session.selectedModelId ?? null,
					session.createdAt,
					session.updatedAt,
				],
			);

			return session;
		});
	}

	public async updateSessionSelectedModel(sessionId: string, selectedModelId?: string): Promise<void> {
		await this.transaction(async () => {
			this.run(
				'UPDATE chat_sessions SET selected_model_id = ?, updated_at = ? WHERE id = ?',
				[selectedModelId ?? null, nowIso(), sessionId],
			);
		});
	}

	public async updateSessionTitle(sessionId: string, title: string): Promise<void> {
		await this.transaction(async () => {
			this.run('UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?', [title, nowIso(), sessionId]);
		});
	}

	public async touchSession(sessionId: string): Promise<void> {
		await this.transaction(async () => {
			this.run('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [nowIso(), sessionId]);
		});
	}

	public async listMessages(sessionId: string): Promise<ChatMessageRecord[]> {
		return this.withLock(async () => this.getAll(
			'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
			[sessionId],
			mapChatMessageRow,
		));
	}

	public async insertMessage(input: MessageInsertInput): Promise<ChatMessageRecord> {
		return this.transaction(async () => {
			this.run(
				`INSERT INTO chat_messages
					(id, session_id, role, content, created_at, error_text)
				VALUES (?, ?, ?, ?, ?, ?)`,
				[
					input.id,
					input.sessionId,
					input.role,
					input.content,
					input.createdAt,
					input.errorText ?? null,
				],
			);

			return {
				id: input.id,
				sessionId: input.sessionId,
				role: input.role,
				content: input.content,
				createdAt: input.createdAt,
				errorText: input.errorText,
			};
		});
	}

	public async updateMessage(messageId: string, content: string, errorText?: string): Promise<void> {
		await this.transaction(async () => {
			this.run(
				'UPDATE chat_messages SET content = ?, error_text = ? WHERE id = ?',
				[content, errorText ?? null, messageId],
			);
		});
	}

	private async persist(): Promise<void> {
		const data = this.requireDatabase().export();
		await fs.writeFile(this.dbFilePath, Buffer.from(data));
	}

	private async withLock<T>(callback: () => Promise<T>): Promise<T> {
		const next = this.operationQueue.then(callback, callback);
		this.operationQueue = next.then(() => undefined, () => undefined);
		return next;
	}

	private requireDatabase(): Database {
		if (!this.database) {
			throw new Error('Local database is not initialized.');
		}
		return this.database;
	}

	private run(sql: string, params: SqlValue[] = []): void {
		this.requireDatabase().run(sql, params);
	}

	private getSingleConnection(sql: string, params: SqlValue[]): ProviderConnectionRecord | undefined {
		return this.getSingle(sql, params, mapProviderConnectionRow);
	}

	private getSingle<T>(sql: string, params: SqlValue[], mapper: (stmt: Statement) => T): T | undefined {
		const stmt = this.requireDatabase().prepare(sql, params);
		try {
			if (!stmt.step()) {
				return undefined;
			}
			return mapper(stmt);
		} finally {
			stmt.free();
		}
	}

	private getAll<T>(sql: string, params: SqlValue[], mapper: (stmt: Statement) => T): T[] {
		const stmt = this.requireDatabase().prepare(sql, params);
		const rows: T[] = [];
		try {
			while (stmt.step()) {
				rows.push(mapper(stmt));
			}
			return rows;
		} finally {
			stmt.free();
		}
	}
}

function mapProviderConnectionRow(stmt: Statement): ProviderConnectionRecord {
	const row = stmt.getAsObject();
	return {
		id: String(row.id),
		providerKind: String(row.provider_kind) as ProviderKind,
		displayName: String(row.display_name),
		secretKeyRef: String(row.secret_key_ref),
		isActive: Number(row.is_active) === 1,
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
	};
}

function mapProviderModelRow(stmt: Statement): ProviderModelRecord {
	const row = stmt.getAsObject();
	return {
		recordId: String(row.id),
		connectionId: String(row.connection_id),
		id: String(row.model_id),
		label: String(row.model_label),
		enabled: Number(row.enabled) === 1,
		sortOrder: Number(row.sort_order),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
	};
}

function mapChatSessionRow(stmt: Statement): ChatSessionRecord {
	const row = stmt.getAsObject();
	return {
		id: String(row.id),
		connectionId: String(row.connection_id),
		title: String(row.title),
		selectedModelId: row.selected_model_id === null || row.selected_model_id === undefined
			? undefined
			: String(row.selected_model_id),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
	};
}

function mapChatMessageRow(stmt: Statement): ChatMessageRecord {
	const row = stmt.getAsObject();
	return {
		id: String(row.id),
		sessionId: String(row.session_id),
		role: String(row.role) as ChatRole,
		content: String(row.content),
		createdAt: String(row.created_at),
		errorText: row.error_text === null || row.error_text === undefined ? undefined : String(row.error_text),
	};
}

function nowIso(): string {
	return new Date().toISOString();
}
