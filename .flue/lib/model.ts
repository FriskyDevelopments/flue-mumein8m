/**
 * Model + provider settings for every agent, driven by env.
 *
 *   MODEL_ID      provider/model-id, e.g. openai/gpt-5.5 or deepseek/deepseek-v4-pro.
 *                 Must be a model Flue knows; your gateway receives that model id.
 *   LLM_BASE_URL  optional. Route MODEL_ID's provider through your own gateway
 *                 (LiteLLM-style proxy, metered token service, etc.).
 *   LLM_API_KEY   optional. Key sent to the gateway instead of the provider's
 *                 own env key (e.g. OPENAI_API_KEY).
 *
 * Without LLM_BASE_URL the provider is called directly with its normal key.
 */
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';

type Env = Record<string, string | undefined>;

export function modelInit(env: Env) {
	const model = env.MODEL_ID || DEFAULT_MODEL;
	const baseUrl = env.LLM_BASE_URL?.trim();
	if (!baseUrl) return { model };

	const provider = model.slice(0, model.indexOf('/'));
	return {
		model,
		providers: {
			[provider]: {
				baseUrl,
				...(env.LLM_API_KEY ? { apiKey: env.LLM_API_KEY } : {}),
			},
		},
	};
}
