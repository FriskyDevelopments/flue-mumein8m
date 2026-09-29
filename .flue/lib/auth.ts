/**
 * Shared-secret gate for webhook agents.
 *
 * Flue's handler context does not expose request headers, so the secret
 * travels in the JSON payload as `secret`. Fails closed: if FLUE_SECRET is
 * not configured, every request is rejected.
 */
export class UnauthorizedError extends Error {
	constructor() {
		super('unauthorized');
		this.name = 'UnauthorizedError';
	}
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export function requireSecret(payload: unknown, env: Record<string, string | undefined>): void {
	const expected = env.FLUE_SECRET;
	const given =
		payload && typeof payload === 'object' && 'secret' in payload
			? (payload as { secret?: unknown }).secret
			: undefined;
	if (!expected || typeof given !== 'string' || !timingSafeEqual(given, expected)) {
		throw new UnauthorizedError();
	}
}
