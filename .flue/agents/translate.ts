import type { FlueContext } from '@flue/sdk/client';
import * as v from 'valibot';
import { requireSecret } from '../lib/auth.ts';

export const triggers = { webhook: true };

const Payload = v.object({
	secret: v.optional(v.string()),
	text: v.optional(v.string(), 'Hello world'),
	language: v.optional(v.string(), 'French'),
});

export default async function ({ init, payload, env }: FlueContext) {
	requireSecret(payload, env);
	const { text, language } = v.parse(Payload, payload ?? {});

	const agent = await init({ model: env.MODEL_ID ?? 'anthropic/claude-sonnet-4-6' });
	const session = await agent.session();

	return await session.prompt(`Translate this to ${language}: "${text}"`, {
		result: v.object({
			translation: v.string(),
			confidence: v.picklist(['low', 'medium', 'high']),
		}),
	});
}
