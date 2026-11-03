import * as fs from "fs";
import * as path from "path";
import { describeDiscordError } from "./describeDiscordError";

const NO_PART =
	"Discord rejected the embed (HTTP 400) but did not say which part. Check the title, description, fields, URLs and color.";

interface FixtureEntry {
	status: number;
	body: unknown;
}

const fixtures = JSON.parse(
	fs.readFileSync(path.join(__dirname, "../../test/fixtures/discord-webhook-errors.json"), "utf8"),
) as Record<string, FixtureEntry | string>;

const entries = Object.entries(fixtures).filter(([name]) => !name.startsWith("_")) as [
	string,
	FixtureEntry,
][];

describe("describeDiscordError", () => {
	describe("recorded Discord responses", () => {
		it("loads the fixtures", () => {
			expect(entries.length).toBeGreaterThan(0);
		});

		it.each(entries)("%s never leaks raw JSON", (_name, { status, body }) => {
			const result = describeDiscordError(status, JSON.stringify(body));
			expect(result).not.toMatch(/[{}]/);
			expect(result).toContain(`HTTP ${status}`);
		});

		it("explains an embed rejected by index only", () => {
			for (const name of [
				"embedDescriptionTooLong",
				"embedTitleTooLong",
				"tooManyFields",
				"invalidUrl",
				"colorOutOfRange",
			]) {
				const { status, body } = fixtures[name] as FixtureEntry;
				expect(describeDiscordError(status, JSON.stringify(body))).toBe(NO_PART);
			}
		});

		it("passes Discord's embed total message through", () => {
			const { status, body } = fixtures.embedTotalOver6000 as FixtureEntry;
			expect(describeDiscordError(status, JSON.stringify(body))).toBe(
				"Embeds: Embed size exceeds maximum size of 6000 (HTTP 400)",
			);
		});

		it("labels the username error", () => {
			const { status, body } = fixtures.usernameTooLong as FixtureEntry;
			expect(describeDiscordError(status, JSON.stringify(body))).toBe(
				"Username: Must be between 1 and 80 in length. (HTTP 400)",
			);
		});
	});

	describe("field-error shape", () => {
		it("explains embeds: [\"0\"] without naming the index", () => {
			expect(describeDiscordError(400, '{"embeds":["0"]}')).toBe(NO_PART);
		});

		it("says it once for several embed indexes", () => {
			expect(describeDiscordError(400, '{"embeds":["0","1","12"]}')).toBe(NO_PART);
		});

		it("passes a non-numeric embeds message through", () => {
			expect(describeDiscordError(400, '{"embeds":["Something odd"]}')).toBe(
				"Embeds: Something odd (HTTP 400)",
			);
		});

		it("does not treat a partly numeric embeds message as an index", () => {
			expect(describeDiscordError(400, '{"embeds":["0 too many"]}')).toBe(
				"Embeds: 0 too many (HTTP 400)",
			);
		});

		it("labels username", () => {
			expect(describeDiscordError(400, '{"username":["Too long"]}')).toBe(
				"Username: Too long (HTTP 400)",
			);
		});

		it("labels avatar_url as Avatar URL", () => {
			expect(describeDiscordError(400, '{"avatar_url":["Not a valid URL"]}')).toBe(
				"Avatar URL: Not a valid URL (HTTP 400)",
			);
		});

		it("humanizes an unknown key", () => {
			expect(describeDiscordError(400, '{"thread_name":["Required"]}')).toBe(
				"Thread name: Required (HTTP 400)",
			);
		});

		it("joins several messages with a single space", () => {
			expect(describeDiscordError(400, '{"username":["A","B"],"embeds":["Big"]}')).toBe(
				"Username: A (HTTP 400) Username: B (HTTP 400) Embeds: Big (HTTP 400)",
			);
		});

		it("combines an embed index sentence with other errors", () => {
			expect(describeDiscordError(400, '{"embeds":["0"],"username":["Bad"]}')).toBe(
				`${NO_PART} Username: Bad (HTTP 400)`,
			);
		});

		it("uses the given status", () => {
			expect(describeDiscordError(422, '{"username":["Bad"]}')).toBe("Username: Bad (HTTP 422)");
		});
	});

	describe("message shape", () => {
		it("explains Discord's embed byte limit", () => {
			const { status, body } = fixtures.embedBytesOver as FixtureEntry;
			expect(describeDiscordError(status, JSON.stringify(body))).toBe(
				"Message size exceeds maximum allowed. Oversized fields: message.embeds=16414 (HTTP 413). Discord also limits the size of an embed in bytes; emoji and some scripts take up to 4 bytes per character, so shorten the text.",
			);
		});

		it("reports a rate limit without retry_after", () => {
			const { status, body } = fixtures.rateLimited as FixtureEntry;
			const result = describeDiscordError(status, JSON.stringify(body));
			expect(result).toBe("You are being rate limited. (HTTP 429)");
			expect(result).not.toContain("retry_after");
		});

		it("shows the message with an unknown code", () => {
			expect(describeDiscordError(400, '{"message":"Invalid Webhook Token","code":50027}')).toBe(
				"Invalid Webhook Token (HTTP 400)",
			);
		});

		it("adds the byte hint only for code 40005 mentioning message.embeds", () => {
			expect(describeDiscordError(413, '{"message":"Too big: message.embeds=1","code":1}')).toBe(
				"Too big: message.embeds=1 (HTTP 413)",
			);
			expect(describeDiscordError(413, '{"message":"Too big: message.files=1","code":40005}')).toBe(
				"Too big: message.files=1 (HTTP 413)",
			);
		});

		it("prefers the field-error shape", () => {
			expect(describeDiscordError(400, '{"username":["Bad"]}')).toBe("Username: Bad (HTTP 400)");
		});
	});

	describe("fallback", () => {
		it("truncates a long non-JSON body to 300 characters plus an ellipsis", () => {
			const html = "<html>" + "x".repeat(994);
			expect(html).toHaveLength(1000);
			const result = describeDiscordError(502, html);
			expect(result).toBe(`HTTP 502: ${html.slice(0, 300)}…`);
			expect(result).toContain("502");
		});

		it("does not append an ellipsis at exactly 300 characters", () => {
			const text = "y".repeat(300);
			expect(describeDiscordError(500, text)).toBe(`HTTP 500: ${text}`);
		});

		it("shows a short non-JSON body as is", () => {
			expect(describeDiscordError(413, "Request entity too large")).toBe(
				"HTTP 413: Request entity too large",
			);
		});

		it("reports only the status for empty text", () => {
			expect(describeDiscordError(500, "")).toBe("HTTP 500");
		});

		it("falls back for a JSON array", () => {
			expect(describeDiscordError(400, '["a"]')).toBe('HTTP 400: ["a"]');
		});

		it("falls back for a JSON number, string and null", () => {
			expect(describeDiscordError(400, "42")).toBe("HTTP 400: 42");
			expect(describeDiscordError(400, '"oops"')).toBe('HTTP 400: "oops"');
			expect(describeDiscordError(400, "null")).toBe("HTTP 400: null");
		});

		it("falls back when a value is not an array", () => {
			expect(describeDiscordError(400, '{"embeds":"Invalid","code":50027}')).toBe(
				'HTTP 400: {"embeds":"Invalid","code":50027}',
			);
		});

		it("falls back when message is not a string", () => {
			expect(describeDiscordError(400, '{"message":42,"code":50027}')).toBe(
				'HTTP 400: {"message":42,"code":50027}',
			);
			expect(describeDiscordError(400, '{"message":{"a":1}}')).toBe('HTTP 400: {"message":{"a":1}}');
		});

		it("falls back when message is an empty string", () => {
			expect(describeDiscordError(400, '{"message":"","code":1}')).toBe(
				'HTTP 400: {"message":"","code":1}',
			);
		});

		it("falls back when an array holds non-strings", () => {
			expect(describeDiscordError(400, '{"embeds":[0]}')).toBe('HTTP 400: {"embeds":[0]}');
		});

		it("falls back for mixed array contents", () => {
			expect(describeDiscordError(400, '{"embeds":["0",1]}')).toBe('HTTP 400: {"embeds":["0",1]}');
		});

		it("falls back for an object with no messages", () => {
			expect(describeDiscordError(400, "{}")).toBe("HTTP 400: {}");
			expect(describeDiscordError(400, '{"embeds":[]}')).toBe('HTTP 400: {"embeds":[]}');
		});

		it("does not throw on malformed JSON", () => {
			expect(() => describeDiscordError(400, '{"embeds":["0"')).not.toThrow();
		});
	});
});
