import { $, $$, browser, expect } from "@wdio/globals";
import type { TFile } from "obsidian";
import { runCommand, injectSettings, useCaptureServer } from "../support/plugin";
import { DISCORD_ATTACHMENT_LIMIT_BYTES, writeOversizedPng } from "../support/oversized";

// Local helpers: modal and notice access used only by this spec.
const FIRST_PATH = "/api/webhooks/1/first";
const SECOND_PATH = "/api/webhooks/2/second";

/** Opens selection.md and selects the marked sentence in its editor. */
const selectSentence = async () => {
	await browser.executeObsidian(async ({ app }) => {
		const file = app.vault.getAbstractFileByPath("selection.md") as TFile;
		await app.workspace.getLeaf(false).openFile(file);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const editor = (app.workspace as any).activeEditor.editor;
		const text: string = editor.getValue();
		const start = text.indexOf("SELECTED_TEXT_START");
		const end = text.indexOf("SELECTED_TEXT_END") + "SELECTED_TEXT_END".length;
		editor.setSelection(editor.offsetToPos(start), editor.offsetToPos(end));
	});
	await browser.waitUntil(
		async () =>
			browser.executeObsidian(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				({ app }) => (app.workspace as any).activeEditor?.editor?.somethingSelected() === true,
			),
		{ timeoutMsg: "selection was not applied in the editor" },
	);
};

/** Texts of the elements matching `selector`, read in one round trip. */
const textsOf = async (selector: string): Promise<string[]> =>
	browser.execute(
		(sel) => Array.from(document.querySelectorAll(sel)).map((el) => (el.textContent || "").trim()),
		selector,
	);

/** Waits for a suggest modal and returns the text of its suggestions. */
const suggestionTexts = async (): Promise<string[]> => {
	await browser.waitUntil(async () => (await textsOf(".modal-container .suggestion-item")).length > 0, {
		timeoutMsg: "no suggest modal with suggestions appeared",
	});
	return textsOf(".modal-container .suggestion-item");
};

/** Clicks the suggestion whose text is exactly `text`. */
const chooseSuggestion = async (text: string) => {
	const index = (await suggestionTexts()).indexOf(text);
	if (index === -1) throw new Error(`suggestion "${text}" not found`);
	const items = await $$(".modal-container .suggestion-item");
	await items[index].click();
};

const noticeTexts = async (): Promise<string[]> => textsOf(".notice-container .notice");

/** Waits until a notice satisfying `predicate` is visible and returns its text. */
const waitForNotice = async (predicate: (text: string) => boolean): Promise<string> => {
	let found = "";
	await browser.waitUntil(
		async () => {
			const match = (await noticeTexts()).find(predicate);
			if (match) found = match;
			return Boolean(match);
		},
		{ timeoutMsg: "expected notice did not appear" },
	);
	return found;
};

const modalOpen = async (): Promise<boolean> => (await textsOf(".modal-container")).length > 0;

describe("Webhook picker and error notices", () => {
	const harness = useCaptureServer();

	describe("webhook picker", () => {
		it("with exactly one webhook, shares without showing the picker", async () => {
			await selectSentence();
			await runCommand("selection");
			const [request] = await harness.server.waitForRequests(1);
			expect(request.path).toBe("/api/webhooks/1/test");
			expect(await modalOpen()).toBe(false);
		});

		it("with two webhooks, lists both and sends only to the chosen one", async () => {
			await injectSettings({
				webhooks: [
					{ description: "First hook", url: harness.server.urlFor(FIRST_PATH) },
					{ description: "Second hook", url: harness.server.urlFor(SECOND_PATH) },
				],
			});
			await selectSentence();
			await runCommand("selection");

			expect(await suggestionTexts()).toEqual(["First hook", "Second hook"]);
			// Nothing is sent before a webhook is chosen.
			expect(harness.server.requests).toHaveLength(0);

			await chooseSuggestion("Second hook");
			const [request] = await harness.server.waitForRequests(1);
			await waitForNotice((text) => text.startsWith("Successfully shared embed to Discord"));

			expect(request.path).toBe(SECOND_PATH);
			expect(harness.server.requests.filter((r) => r.path === FIRST_PATH)).toHaveLength(0);
			expect(harness.server.requests).toHaveLength(1);
			expect(request.json.embeds[0].description).toContain("SELECTED_TEXT_START");
		});
	});

	describe("error notices", () => {
		it("413 on an oversized attachment shows the 8MB notice", async () => {
			// The oversized file is generated on demand and written straight into the sandbox vault.
			const basePath = await browser.executeObsidian(({ app }) => (app.vault.adapter as unknown as { basePath: string }).basePath);
			writeOversizedPng(basePath, "big.png");
			await browser.waitUntil(
				async () =>
					browser.executeObsidian(({ app }) => app.vault.getAbstractFileByPath("big.png") !== null),
				{ timeoutMsg: "Obsidian did not index big.png" },
			);

			harness.server.setResponse(413, "Request entity too large");
			await runCommand("attachment");
			const input = await $(".modal-container .prompt-input");
			await input.waitForDisplayed();
			await input.setValue("big.png");
			await browser.waitUntil(async () => (await suggestionTexts()).includes("big.png"));
			await chooseSuggestion("big.png");

			const notice = await waitForNotice((text) => text.startsWith("Failed to share big.png"));
			expect(notice).toBe("Failed to share big.png to Discord. Attachments must be smaller than 8MB.");
			const [request] = harness.server.requests;
			expect(harness.server.requests).toHaveLength(1);
			const upload = request.parts?.find((part) => part.name === "files[0]");
			expect(upload?.filename).toBe("big.png");
			expect(upload?.size).toBeGreaterThan(DISCORD_ATTACHMENT_LIMIT_BYTES);
		});

		it("500 on an embed shows a failure notice with the status", async () => {
			harness.server.setResponse(500, "Internal Server Error");
			await selectSentence();
			await runCommand("selection");

			const notice = await waitForNotice((text) => text.startsWith("Failed to share embed to Discord."));
			expect(notice).toContain("500");
			expect(harness.server.requests).toHaveLength(1);
		});
	});
});
