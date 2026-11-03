const MAX_RAW_LENGTH = 300;

/**
 * Turns a Discord webhook error response into a sentence for a notice.
 * Discord's field-error shape ({ "username": ["..."] }) is rewritten in plain
 * words; anything else falls back to `HTTP <status>: <text>`. Never throws.
 */
export function describeDiscordError(status: number, text: string): string {
	const fieldErrors = parseFieldErrors(text);
	if (fieldErrors) {
		const message = describeFieldErrors(status, fieldErrors);
		if (message) return message;
	}
	return describeRaw(status, text);
}

function parseFieldErrors(text: string): Record<string, string[]> | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return null;
	}
	const record = parsed as Record<string, unknown>;
	for (const value of Object.values(record)) {
		if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
			return null;
		}
	}
	return record as Record<string, string[]>;
}

function describeFieldErrors(status: number, errors: Record<string, string[]>): string {
	const parts: string[] = [];
	let reportedEmbedIndex = false;
	for (const [key, messages] of Object.entries(errors)) {
		for (const message of messages) {
			if (key === "embeds" && /^\d+$/.test(message)) {
				if (!reportedEmbedIndex) {
					reportedEmbedIndex = true;
					parts.push(
						`Discord rejected the embed (HTTP ${status}) but did not say which part. Check the title, description, fields, URLs and color.`,
					);
				}
				continue;
			}
			parts.push(`${humanizeKey(key)}: ${message} (HTTP ${status})`);
		}
	}
	return parts.join(" ");
}

function humanizeKey(key: string): string {
	if (key === "avatar_url") return "Avatar URL";
	const spaced = key.replace(/_/g, " ");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function describeRaw(status: number, text: string): string {
	if (!text) return `HTTP ${status}`;
	const shown = text.length > MAX_RAW_LENGTH ? `${text.slice(0, MAX_RAW_LENGTH)}…` : text;
	return `HTTP ${status}: ${shown}`;
}
