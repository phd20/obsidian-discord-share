// Keeps Discord webhook URLs out of test output. A webhook URL carries its secret token in the path,
// so a URL that reaches a log, a failure message or a CI transcript is a leaked credential.
//
// Redaction is pattern-based (anything shaped like a webhook URL) plus exact-match for the URL the run
// was configured with, whatever host it points at.

export const REDACTED = "[redacted webhook url]";

/** Absolute URLs whose path ends in `/webhooks/<id>/<token>`, with an optional query string. */
const WEBHOOK_URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>`]*\/webhooks\/\d+\/[\w-]+(?:\?[^\s"'<>`]*)?/gi;

/** The same path without a scheme or host, e.g. in an error that only echoes the request path. */
const WEBHOOK_PATH = /\/?webhooks\/\d+\/[\w-]+(?:\?[^\s"'<>`]*)?/gi;

/** Tokens shorter than this are not worth masking on their own (they would mangle ordinary words). */
const MIN_TOKEN_LENGTH = 12;

const secrets = new Set<string>();

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Registers a configured URL so `redact` removes it exactly, even when it does not look like a
 * Discord webhook (a capture-server URL, a proxy). Also registers the URL without its query string
 * and its last path segment (the token) when that is long enough to be unambiguous.
 */
export const registerSecret = (value: string | undefined): void => {
	const secret = (value ?? "").trim();
	if (!secret) return;
	secrets.add(secret);
	try {
		const url = new URL(secret);
		if (url.search) secrets.add(secret.replace(url.search, ""));
		const token = url.pathname.split("/").filter(Boolean).pop() ?? "";
		if (token.length >= MIN_TOKEN_LENGTH) secrets.add(token);
	} catch {
		// Not a URL: the exact value is still registered.
	}
};

/** Forgets every registered secret (tests only). */
export const clearSecrets = (): void => secrets.clear();

/** Replaces webhook URLs, and any registered secret, in `text`. */
export const redact = (text: string): string => {
	let result = text;
	// Longest first so a URL is replaced whole before its own token is looked for.
	Array.from(secrets)
		.sort((a, b) => b.length - a.length)
		.forEach((secret) => {
			result = result.replace(new RegExp(escapeRegExp(secret), "g"), REDACTED);
		});
	return result.replace(WEBHOOK_URL, REDACTED).replace(WEBHOOK_PATH, REDACTED);
};

/** Redacts the message, stack and cause of an error, returning a new error to throw instead. */
export const redactError = (error: unknown): Error => {
	if (!(error instanceof Error)) return new Error(redact(String(error)));
	const clean = new Error(redact(error.message));
	clean.name = error.name;
	if (error.stack) clean.stack = redact(error.stack);
	return clean;
};

const INSTALLED = Symbol.for("obsidian-discord-share.redactedStream");

type WritableLike = { write: (...args: any[]) => any; [INSTALLED]?: boolean }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Masks webhook URLs in everything written to these streams (default: stdout and stderr). wdio's
 * reporters and the worker output pass through the launcher's stdout, so installing this from the
 * config covers them. A URL split across two separate writes is not caught.
 */
export const installOutputRedaction = (streams: WritableLike[] = [process.stdout, process.stderr]): void => {
	streams.forEach((stream) => {
		if (stream[INSTALLED]) return;
		const original = stream.write.bind(stream);
		stream.write = (chunk: unknown, ...rest: unknown[]) => {
			const text = typeof chunk === "string" ? chunk : chunk instanceof Uint8Array ? Buffer.from(chunk).toString("utf8") : undefined;
			return original(text === undefined ? chunk : redact(text), ...rest);
		};
		stream[INSTALLED] = true;
	});
};
