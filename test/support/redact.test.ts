import { clearSecrets, installOutputRedaction, redact, redactError, REDACTED, registerSecret } from "./redact";
import { getLiveWebhookUrl, loadEnvFile, parseEnvFile, redacted } from "./liveEnv";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Fake URLs are assembled at runtime so no webhook-shaped literal exists in the repository.
const host = ["discord", "com"].join(".");
const fakeToken = ["Zk", "Qx", "Wm", "Pl", "Rt", "Yv", "Nb", "Hj"].join("");
const fakeUrl = `https://${host}/api/webhooks/${"1".repeat(18)}/${fakeToken}`;

afterEach(() => {
	clearSecrets();
	jest.restoreAllMocks();
});

describe("redact", () => {
	it("masks a Discord webhook URL", () => {
		const text = `POST ${fakeUrl} failed`;
		expect(redact(text)).toBe(`POST ${REDACTED} failed`);
	});

	it("masks versioned, discordapp and query-string forms", () => {
		const variants = [
			fakeUrl.replace("/api/", "/api/v10/"),
			fakeUrl.replace("discord.com", "discordapp.com"),
			`${fakeUrl}?wait=true&thread_id=5`,
		];
		variants.forEach((variant) => expect(redact(`x ${variant} y`)).toBe(`x ${REDACTED} y`));
	});

	it("masks a URL inside JSON and quotes", () => {
		const text = JSON.stringify({ url: fakeUrl });
		expect(redact(text)).not.toContain(fakeToken);
		expect(JSON.parse(redact(text)).url).toBe(REDACTED);
	});

	it("masks a bare webhook path", () => {
		expect(redact(`/api/webhooks/${"2".repeat(18)}/${fakeToken}`)).not.toContain(fakeToken);
	});

	it("leaves unrelated text and ordinary URLs alone", () => {
		const text = "Successfully shared embed to Discord! https://example.com/a/b?c=d";
		expect(redact(text)).toBe(text);
	});

	it("masks a registered secret that does not look like a webhook", () => {
		const local = `http://127.0.0.1:5123/hooks/${fakeToken}?x=1`;
		expect(redact(local)).toBe(local);
		registerSecret(local);
		expect(redact(`fetch ${local} failed`)).toBe(`fetch ${REDACTED} failed`);
		expect(redact(`just the token ${fakeToken}`)).toBe(`just the token ${REDACTED}`);
	});

	it("ignores blank secrets", () => {
		registerSecret("   ");
		registerSecret(undefined);
		expect(redact("plain")).toBe("plain");
	});
});

describe("redactError", () => {
	it("masks message and stack, keeping the error name", () => {
		const error = new TypeError(`bad ${fakeUrl}`);
		error.stack = `TypeError: bad ${fakeUrl}\n    at somewhere`;
		const clean = redactError(error);
		expect(clean.name).toBe("TypeError");
		expect(clean.message).not.toContain(fakeToken);
		expect(clean.stack).not.toContain(fakeToken);
	});

	it("handles thrown non-errors", () => {
		expect(redactError(`oops ${fakeUrl}`).message).toBe(`oops ${REDACTED}`);
	});
});

describe("installOutputRedaction", () => {
	it("masks strings and buffers written to a stream, once", () => {
		const written: string[] = [];
		const stream = { write: (chunk: unknown) => (written.push(String(chunk)), true) };
		installOutputRedaction([stream]);
		installOutputRedaction([stream]); // a second install must not wrap again
		stream.write(`line ${fakeUrl}\n`);
		stream.write(Buffer.from(`buf ${fakeUrl}`));
		expect(written).toEqual([`line ${REDACTED}\n`, `buf ${REDACTED}`]);
	});
});

describe("a failing live code path", () => {
	it("does not print or throw the webhook URL", async () => {
		registerSecret(fakeUrl);
		const printed: string[] = [];
		const capture = (chunk: unknown) => (printed.push(String(chunk)), true);
		const stdout = { write: capture };
		const stderr = { write: capture };
		installOutputRedaction([stdout, stderr]);

		// Mimics the live spec: the request fails and the error echoes the URL it was sent to.
		const failingLiveTest = () =>
			redacted(async () => {
				stdout.write(`posting to ${fakeUrl}\n`);
				throw new Error(`HTTP 401 from ${fakeUrl}: invalid webhook token`);
			});

		const error = await failingLiveTest().then(
			() => undefined,
			(e: Error) => e,
		);
		expect(error).toBeInstanceOf(Error);
		stderr.write(`${error!.stack}\n`);

		expect(error!.message).toContain("HTTP 401");
		expect(error!.message).not.toContain(fakeToken);
		printed.concat(error!.message, error!.stack ?? "").forEach((text) => expect(text).not.toContain(fakeToken));
		expect(printed.join("")).toContain(REDACTED);
	});
});

describe("live env", () => {
	it("parses env files", () => {
		const text = ["# comment", "", "A=1", "export B = two # note", `C="quoted # kept"`, "D='x y'", "E="].join("\n");
		expect(parseEnvFile(text)).toEqual({ A: "1", B: "two", C: "quoted # kept", D: "x y", E: "" });
	});

	it("loads a file without overriding the environment, and ignores a missing file", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-env-"));
		const file = path.join(dir, ".env.test");
		fs.writeFileSync(file, "DISCORD_TEST_WEBHOOK_URL=from-file\nOTHER=fromfile\n");
		const env: NodeJS.ProcessEnv = { OTHER: "already" };
		loadEnvFile(file, env);
		expect(env).toEqual({ DISCORD_TEST_WEBHOOK_URL: "from-file", OTHER: "already" });
		expect(() => loadEnvFile(path.join(dir, "missing"), {})).not.toThrow();
		fs.rmSync(dir, { recursive: true });
	});

	it("treats unset and blank as not configured", () => {
		expect(getLiveWebhookUrl({})).toBeUndefined();
		expect(getLiveWebhookUrl({ DISCORD_TEST_WEBHOOK_URL: "  " })).toBeUndefined();
		expect(getLiveWebhookUrl({ DISCORD_TEST_WEBHOOK_URL: " x " })).toBe("x");
	});
});
