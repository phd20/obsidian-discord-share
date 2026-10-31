// Delivery must not depend on the destination's CORS headers. The capture server runs in no-CORS
// mode: no CORS headers on any response, and OPTIONS (preflight) requests rejected with 405.
// A renderer fetch() to another origin is blocked in that mode (the JSON embed needs a preflight,
// and even a "simple" multipart POST cannot be read back without Access-Control-Allow-Origin, so
// the plugin would report a failure); requestUrl goes through the main process and is unaffected.
import { $, $$, browser, expect } from "@wdio/globals";
import { obsidianPage, runCommand, useCaptureServer } from "../support/plugin";
import type { CapturedPart, CapturedRequest } from "../support/captureServer";

const NESTED_IMAGE = "img/nested/b.png";
const ROOT_IMAGE = "attachments/b.png";

// --- Local helpers (same shape as in attachments.e2e.ts and embeds.e2e.ts) --------------------

/** Bytes of a vault file, read through Obsidian's vault API (vault-relative POSIX path). */
const readVaultBytes = async (vaultPath: string): Promise<Buffer> => {
	const base64 = await browser.executeObsidian(async ({ app }, filePath) => {
		const bytes = new Uint8Array(await app.vault.adapter.readBinary(filePath));
		let binary = "";
		bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
		return btoa(binary);
	}, vaultPath);
	return Buffer.from(base64, "base64");
};

const filePart = (request: CapturedRequest): CapturedPart => {
	const part = request.parts?.find((p) => p.name === "files[0]");
	if (!part) throw new Error(`No files[0] part; got ${JSON.stringify(request.parts?.map((p) => p.name))}`);
	return part;
};

const noticeTexts = (): Promise<string[]> =>
	browser.execute(() => Array.from(document.querySelectorAll(".notice"), (notice) => notice.textContent ?? ""));

/** Waits for a notice with exactly this text. */
const expectNotice = async (text: string): Promise<void> => {
	await browser.waitUntil(async () => (await noticeTexts()).includes(text), {
		timeout: 10000,
		timeoutMsg: `Notice "${text}" was not shown; notices: ${JSON.stringify(await noticeTexts())}`,
	});
};

/** Clears notices left over from an earlier test so a notice assertion cannot match a stale one. */
const clearNotices = (): Promise<void> =>
	browser.execute(() => document.querySelectorAll(".notice").forEach((notice) => notice.remove()));

/** Opens a vault note and waits until it is the active, indexed note. */
const openNote = async (path: string): Promise<void> => {
	await obsidianPage.openFile(path);
	await browser.waitUntil(
		() =>
			browser.executeObsidian(({ app }, notePath) => {
				const file = app.vault.getAbstractFileByPath(notePath);
				if (!file || app.workspace.getActiveFile()?.path !== notePath) return false;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return Boolean(app.metadataCache.getFileCache(file as any)?.frontmatter);
			}, path),
		{ timeout: 10000, timeoutMsg: `${path} did not become the active, indexed note` },
	);
};

/** Picks the entry with this vault path in the open attachment picker (a FuzzySuggestModal). */
const pickAttachment = async (vaultPath: string): Promise<void> => {
	const input = await $(".prompt .prompt-input");
	await input.waitForDisplayed({ timeout: 10000 });
	await input.setValue(vaultPath);
	let target: WebdriverIO.Element | undefined;
	await browser.waitUntil(async () => {
		for (const item of await $$(".prompt .suggestion-item")) {
			if ((await item.getText()).trim() === vaultPath) {
				target = item;
				return true;
			}
		}
		return false;
	}, { timeout: 10000, timeoutMsg: `Picker never listed ${vaultPath}` });
	await target!.click();
};

// --- Specs ------------------------------------------------------------------------------------

describe("Discord Share without CORS headers", () => {
	const harness = useCaptureServer({ cors: false });

	beforeEach(async () => {
		await clearNotices();
	});

	/** A preflight would be rejected (405) and fetch() would then never send the real request. */
	const expectNoPreflight = (): void => {
		expect(harness.server.preflights).toHaveLength(0);
	};

	it("serves no CORS headers and rejects preflights (the mode under test)", async () => {
		// Guards the other tests: if the server still sent CORS headers they would prove nothing.
		const preflight = await fetch(harness.webhookUrl, { method: "OPTIONS" }).catch(() => undefined);
		// Node's fetch has no CORS check, so the server's own answer is visible here.
		expect(preflight?.status).toBe(405);
		expect(preflight?.headers.get("access-control-allow-origin")).toBeNull();
		harness.server.reset();
	});

	it("shares an embed as JSON", async () => {
		await openNote("properties.md");
		await runCommand("properties");

		const [request] = await harness.server.waitForRequests(1);
		expect(harness.server.requests).toHaveLength(1);
		expect(request.method).toBe("POST");
		expect(request.path).toBe("/api/webhooks/1/test");
		expect(request.headers["content-type"]).toMatch(/^application\/json/);
		expect(request.json.embeds).toHaveLength(1);
		expect(request.json.embeds[0].title).toBe("Fixture Properties Note");
		expect(request.responseStatus).toBe(204);

		await expectNotice("Successfully shared embed to Discord!");
		expectNoPreflight();
	});

	it("shares an attachment as multipart", async () => {
		const nestedBytes = await readVaultBytes(NESTED_IMAGE);
		const rootBytes = await readVaultBytes(ROOT_IMAGE);
		expect(nestedBytes.equals(rootBytes)).toBe(false);

		await runCommand("attachment");
		await pickAttachment(NESTED_IMAGE);

		const [request] = await harness.server.waitForRequests(1);
		expect(harness.server.requests).toHaveLength(1);
		expect(request.method).toBe("POST");
		expect(request.headers["content-type"]).toMatch(/^multipart\/form-data/);

		const file = filePart(request);
		expect(file.filename).toBe("b.png");
		expect(file.bytes.equals(nestedBytes)).toBe(true);
		expect(request.responseStatus).toBe(204);

		await expectNotice("Successfully shared b.png to Discord!");
		expectNoPreflight();
	});

	it("shares an embed with a local image as multipart", async () => {
		await openNote("with-image.md");
		await browser.waitUntil(
			() => browser.executeObsidian(({ app }) => {
				const file = app.vault.getAbstractFileByPath("with-image.md") as import("obsidian").TFile;
				return Boolean(app.metadataCache.getFileCache(file)?.frontmatter?.["ods-image"]);
			}),
			{ timeout: 10000, timeoutMsg: "with-image.md frontmatter was never indexed" },
		);
		await runCommand("properties");

		const [request] = await harness.server.waitForRequests(1);
		expect(harness.server.requests).toHaveLength(1);
		expect(request.headers["content-type"]).toMatch(/^multipart\/form-data/);
		expect(filePart(request).filename).toBe("b.png");
		expect(request.payloadJson.embeds).toHaveLength(1);
		expect(request.payloadJson.embeds[0].image.url).toBe("attachment://b.png");
		expect(request.responseStatus).toBe(204);

		await expectNotice("Successfully shared embed to Discord!");
		expectNoPreflight();
	});
});
