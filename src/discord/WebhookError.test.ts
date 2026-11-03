import { WebhookError } from "./WebhookError";

describe("WebhookError", () => {
	const error = new WebhookError(413, "Request entity too large");

	it("carries the status and the response text", () => {
		expect(error.status).toBe(413);
		expect(error.text).toBe("Request entity too large");
	});

	it("keeps the HTTP <status>: <text> message", () => {
		expect(error.message).toBe("HTTP 413: Request entity too large");
	});

	it("is an instance of Error and of WebhookError", () => {
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(WebhookError);
	});
});
