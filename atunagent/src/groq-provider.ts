import type { ChatCompletionInputMessage, ProviderModel } from './types';

export class GroqProviderAdapter {
	private readonly baseUrl = 'https://api.groq.com/openai/v1';

	public async listModels(apiKey: string): Promise<ProviderModel[]> {
		const response = await fetch(`${this.baseUrl}/models`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (!response.ok) {
			throw new Error(await toApiError(response, 'Cannot list Groq models.'));
		}

		const payload = await response.json() as { data?: Array<{ id?: string }> };
		const models = (payload.data ?? [])
			.map((item) => item.id?.trim())
			.filter((value): value is string => Boolean(value))
			.sort((left, right) => left.localeCompare(right))
			.map((id) => ({ id, label: id, enabled: false }));

		if (models.length === 0) {
			throw new Error('Groq returned no models for this API key.');
		}

		return models;
	}

	public async *streamChat(
		apiKey: string,
		modelId: string,
		messages: ChatCompletionInputMessage[],
		signal?: AbortSignal,
	): AsyncGenerator<string, void, void> {
		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: modelId,
				messages,
				stream: true,
			}),
			signal,
		});

		if (!response.ok) {
			throw new Error(await toApiError(response, 'Cannot stream Groq chat completion.'));
		}

		if (!response.body) {
			throw new Error('Groq response body is empty.');
		}

		const decoder = new TextDecoder();
		const reader = response.body.getReader();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			let boundary = buffer.indexOf('\n');
			while (boundary >= 0) {
				const rawLine = buffer.slice(0, boundary).trim();
				buffer = buffer.slice(boundary + 1);
				boundary = buffer.indexOf('\n');

				if (!rawLine.startsWith('data:')) {
					continue;
				}

				const data = rawLine.slice(5).trim();
				if (!data || data === '[DONE]') {
					continue;
				}

				const payload = JSON.parse(data) as {
					choices?: Array<{ delta?: { content?: string } }>;
				};
				const chunk = payload.choices?.[0]?.delta?.content ?? '';
				if (chunk) {
					yield chunk;
				}
			}
		}
	}
}

async function toApiError(response: Response, fallback: string): Promise<string> {
	try {
		const payload = await response.json() as { error?: { message?: string } };
		return payload.error?.message ?? `${fallback} HTTP ${response.status}`;
	} catch {
		return `${fallback} HTTP ${response.status}`;
	}
}
