/**
 * A non-2xx response from a Discord webhook. Carries the HTTP status and the
 * response body so callers can branch on the status instead of parsing the
 * message.
 */
export class WebhookError extends Error {
	status: number;
	text: string;

	constructor(status: number, text: string) {
		super(`HTTP ${status}: ${text}`);
		// Keeps instanceof working when Error is subclassed under older compile targets
		Object.setPrototypeOf(this, WebhookError.prototype);
		this.name = "WebhookError";
		this.status = status;
		this.text = text;
	}
}
