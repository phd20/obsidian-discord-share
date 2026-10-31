import { browser, $, $$, expect } from "@wdio/globals";
import { obsidianPage, runCommand, useCaptureServer } from "../support/plugin";
import type { CapturedPart, CapturedRequest } from "../support/captureServer";

const NESTED_IMAGE = "img/nested/b.png";
const ROOT_IMAGE = "attachments/b.png";

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

const noticeTexts = async (): Promise<string[]> =>
	browser.execute(() => Array.from(document.querySelectorAll(".notice"), (notice) => notice.textContent ?? ""));

/** Waits for a notice with exactly this text. */
const expectNotice = async (text: string): Promise<void> => {
	await browser.waitUntil(async () => (await noticeTexts()).includes(text), {
		timeout: 10000,
		timeoutMsg: `Notice "${text}" was not shown; notices: ${JSON.stringify(await noticeTexts())}`,
	});
};

/** Clears notices left over from an earlier test so a notice assertion cannot match a stale one. */
const clearNotices = async (): Promise<void> => {
	await browser.execute(() => document.querySelectorAll(".notice").forEach((notice) => notice.remove()));
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

describe("Discord Share attachments", () => {
	const harness = useCaptureServer();

	beforeEach(async () => {
		await clearNotices();
	});

	it("shares the chosen attachment from a nested folder", async () => {
		const nestedBytes = await readVaultBytes(NESTED_IMAGE);
		const rootBytes = await readVaultBytes(ROOT_IMAGE);
		// The fixture only proves anything if the two files differ.
		expect(nestedBytes.equals(rootBytes)).toBe(false);

		await runCommand("attachment");
		await pickAttachment(NESTED_IMAGE);

		const [request] = await harness.server.waitForRequests(1);
		expect(harness.server.requests).toHaveLength(1);
		expect(request.path).toBe("/api/webhooks/1/test");

		const file = filePart(request);
		expect(file.filename).toBe("b.png");
		expect(file.bytes.equals(nestedBytes)).toBe(true);
		expect(file.bytes.equals(rootBytes)).toBe(false);

		expect(request.payloadJson).toEqual({
			username: expect.any(String),
			avatar_url: expect.any(String),
		});
		expect(request.payloadJson.username).not.toBe("");
		expect(request.payloadJson.avatar_url).not.toBe("");

		await expectNotice("Successfully shared b.png to Discord!");
	});

	it("attaches the local image of an ods-image property", async () => {
		await obsidianPage.openFile("with-image.md");
		// The embed params are read from the metadata cache, which re-indexes after the vault reset.
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
		// Both fixture images are named b.png and the link carries no folder, so which one Obsidian
		// resolves is its call; only the shape of the embed is asserted here.
		expect(request.payloadJson.embeds).toHaveLength(1);
		expect(request.payloadJson.embeds[0].image.url).toBe("attachment://b.png");

		await expectNotice("Successfully shared embed to Discord!");
	});

	it("sends a filename with a space and non-ASCII characters intact", async () => {
		const name = "my pic é 日本.png";
		const bytes = await readVaultBytes(ROOT_IMAGE);
		await browser.executeObsidian(async ({ app }, fileName, base64) => {
			const binary = atob(base64);
			const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
			await app.vault.createBinary(fileName, data.buffer);
		}, name, bytes.toString("base64"));

		await runCommand("attachment");
		await pickAttachment(name);

		const [request] = await harness.server.waitForRequests(1);
		expect(harness.server.requests).toHaveLength(1);
		const file = filePart(request);
		expect(file.filename).toBe(name);
		expect(file.bytes.equals(bytes)).toBe(true);

		await expectNotice(`Successfully shared ${name} to Discord!`);
	});
});
