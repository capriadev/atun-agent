import * as vscode from 'vscode';
import { LocalDatabase } from './storage/local-database';

const CHAT_PARTICIPANT_ID = 'atun-agent.atun';

export function registerAtunChatParticipant(
	context: vscode.ExtensionContext,
	database: LocalDatabase,
): vscode.ChatParticipant {
	const participant = vscode.chat.createChatParticipant(CHAT_PARTICIPANT_ID, async (_request, _chatContext, stream) => {
		const activeConnection = await database.getActiveConnection();
		if (!activeConnection) {
			stream.markdown('Atun Agent todavia no esta configurado. Abri la sidebar de Atun Agent y conecta Groq para continuar.');
			return { metadata: {} };
		}

		const models = await database.listEnabledModels(activeConnection.id);
		if (models.length === 0) {
			stream.markdown('La conexion activa no tiene modelos habilitados. Volve a la sidebar y activa al menos un modelo.');
			return { metadata: {} };
		}

		stream.markdown('Atun Agent usa por ahora el chat propio de la sidebar. Abri la sidebar, elegi el modelo y continua la conversacion desde ahi.');
		return { metadata: {} };
	});

	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icons', 'ghost-chat.svg');
	return participant;
}
