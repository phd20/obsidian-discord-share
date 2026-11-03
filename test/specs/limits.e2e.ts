// Embed limit validation: an embed Discord would reject is refused before any webhook is asked for
// or any request is sent, and a rejection the plugin did not predict is shown readably.
// Selections are generated in the editor (no large fixture is committed); the capture server stands
// in for Discord, so "nothing was sent" is asserted on `harness.server.requests`.
import { browser, expect } from "@wdio/globals";
import type { TFile } from "obsidian";
import {
	DEFAULT_ATTACHMENT_FORMATS,
	DEFAULT_WEBHOOK_PATH,
	clearNotices,
	injectSettings,
	modalOpen,
	readSettings,
	runCommand,
	textsOf,
	useCaptureServer,
	waitForNotice,
} from "../support/plugin";

const FAILURE_PREFIX = "Failed to share embed to Discord.";
const isFailure = (text: string) => text.startsWith(FAILURE_PREFIX);
const isSuccess = (text: string) => text.startsWith("Successfully shared embed to Discord");

/**
 * Replaces the text of selection.md with a short line plus `length` copies of `char` and selects exactly
 * those copies. `char` must be a single UTF-16 unit (the editor offsets are in units). Plain characters
 * pass through the plugin's Markdown clean-up unchanged, so the embed's description is exactly `length`
 * characters.
 */
const selectGeneratedText = async (length: number, char = "x"): Promise<void> => {
	await browser.executeObsidian(async ({ app }, count, fill) => {
		const file = app.vault.getAbstractFileByPath("selection.md") as TFile;
		await app.workspace.getLeaf(false).openFile(file);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const editor = (app.workspace as any).activeEditor.editor;
		const prefix = "Selection source note.\n\n";
		editor.setValue(`${prefix}${fill.repeat(count)}\n`);
		editor.setSelection(editor.offsetToPos(prefix.length), editor.offsetToPos(prefix.length + count));
	}, length, char);
	await browser.waitUntil(
		async () =>
			browser.executeObsidian(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				({ app }) => (app.workspace as any).activeEditor?.editor?.getSelection().length,
			).then((selected) => selected === length),
		{ timeoutMsg: `a selection of ${length} characters was not applied in the editor` },
	);
};

describe("Embed limit validation", () => {
	const harness = useCaptureServer();

	beforeEach(async () => {
		await clearNotices();
	});

	/** Injects the default webhook plus embed defaults on top of the plugin's own defaults. */
	const injectEmbedDefaults = async (defaults: { title?: string; footerText?: string }) => {
		const current = (await readSettings()).embedDefaultValues as Record<string, unknown>;
		await injectSettings({
			webhooks: [{ description: "test", url: harness.server.urlFor(DEFAULT_WEBHOOK_PATH) }],
			attachmentFormats: DEFAULT_ATTACHMENT_FORMATS,
			settings: {
				embedDefaultValues: {
					...current,
					...(defaults.title !== undefined && { embedDefaultTitle: defaults.title }),
					// The footer is only used when all of its values are set, so give it an icon URL too.
					...(defaults.footerText !== undefined && {
						embedDefaultFooter: { text: defaults.footerText, iconURL: "https://example.com/icon.png" },
					}),
				},
			},
		});
	};

	it("refuses an over-limit selection and sends nothing", async () => {
		await selectGeneratedText(5000);
		await runCommand("selection");

		const notice = await waitForNotice(isFailure);
		expect(notice).toContain("Description is 5,000 characters; Discord allows 4,096.");
		expect(harness.server.requests).toHaveLength(0);
	});

	it("does not show the webhook picker for an over-limit selection when two webhooks are configured", async () => {
		await injectSettings({
			webhooks: [
				{ description: "First hook", url: harness.server.urlFor("/api/webhooks/1/first") },
				{ description: "Second hook", url: harness.server.urlFor("/api/webhooks/2/second") },
			],
			attachmentFormats: DEFAULT_ATTACHMENT_FORMATS,
		});
		await selectGeneratedText(5000);
		await runCommand("selection");

		// The notice proves the share ran to its end; only then does "no picker" mean anything.
		await waitForNotice(isFailure);
		expect(await modalOpen()).toBe(false);
		expect(await textsOf(".prompt")).toEqual([]);
		expect(await textsOf(".modal-container .suggestion-item")).toEqual([]);
		expect(harness.server.requests).toHaveLength(0);
	});

	it("sends a selection of exactly 4096 characters", async () => {
		await selectGeneratedText(4096);
		await runCommand("selection");

		const [request] = await harness.server.waitForRequests(1);
		await waitForNotice(isSuccess);
		expect(request.json.embeds[0].description).toHaveLength(4096);
		expect(harness.server.requests).toHaveLength(1);
	});

	it("refuses an embed whose parts are each within limits but whose total is over 6000", async () => {
		// Default title 256 + default footer 2000 + description 4000 = 6256, with every part at or under its own limit.
		await injectEmbedDefaults({ title: "t".repeat(256), footerText: "f".repeat(2000) });
		await selectGeneratedText(4000);
		await runCommand("selection");

		const notice = await waitForNotice(isFailure);
		expect(notice).toContain("Total embed text is");
		expect(notice).toContain("in total.");
		expect(notice).not.toContain("Title is");
		expect(notice).not.toContain("Description is");
		expect(notice).not.toContain("Footer text is");
		expect(harness.server.requests).toHaveLength(0);
	});

	it("shows a readable notice when Discord rejects an in-limit embed with only an index", async () => {
		harness.server.setResponse(400, { embeds: ["0"] });
		await selectGeneratedText(100);
		await runCommand("selection");

		const notice = await waitForNotice(isFailure);
		expect(notice).toContain("400");
		expect(notice).toContain("did not say which part");
		expect(notice).not.toContain("{");
		expect(harness.server.requests).toHaveLength(1);
	});

	it("lists every exceeded limit in one notice", async () => {
		await injectEmbedDefaults({ title: "t".repeat(300) });
		await selectGeneratedText(5000);
		await runCommand("selection");

		const notice = await waitForNotice(isFailure);
		expect(notice).toContain("Title is 300 characters; Discord allows 256.");
		expect(notice).toContain("Description is 5,000 characters; Discord allows 4,096.");
		expect(harness.server.requests).toHaveLength(0);
	});

	/** Makes `path` the active note. */
	const openNote = async (path: string): Promise<void> => {
		await browser.executeObsidian(async ({ app }, notePath) => {
			const file = app.vault.getAbstractFileByPath(notePath) as TFile;
			await app.workspace.getLeaf(false).openFile(file);
		}, path);
	};

	// plain-content.md has frontmatter (title, tags) but no ods- properties, so with no defaults set
	// the embed would have nothing to show, which Discord rejects without saying why.
	// Discord also caps an embed at roughly 10 KB of UTF-8, which Chinese text (3 bytes per character) reaches
	// at about 3,380 characters, well under the 4,096-character limit.
	it("refuses text that is within the character limit but over the byte cap", async () => {
		await selectGeneratedText(3500, "漢");
		await runCommand("selection");

		const notice = await waitForNotice(isFailure);
		expect(notice).toContain("Embed text is 10,500 bytes; Discord allows about 10,000.");
		expect(notice).not.toContain("Description is");
		expect(harness.server.requests).toHaveLength(0);
	});

	it("sends 4096 two-byte characters", async () => {
		await selectGeneratedText(4096, "é");
		await runCommand("selection");

		const [request] = await harness.server.waitForRequests(1);
		await waitForNotice(isSuccess);
		expect([...request.json.embeds[0].description]).toHaveLength(4096);
	});

	it("refuses an embed with nothing to show", async () => {
		await openNote("plain-content.md");
		await runCommand("properties");

		const notice = await waitForNotice(isFailure);
		expect(notice).toContain("Nothing to share: the embed has no title, description, fields, footer, author or image.");
		expect(harness.server.requests).toHaveLength(0);
	});

	it("sends the same note when a default title is set", async () => {
		await injectEmbedDefaults({ title: "Default title" });
		await openNote("plain-content.md");
		await runCommand("properties");

		const [request] = await harness.server.waitForRequests(1);
		await waitForNotice(isSuccess);
		expect(request.json.embeds[0].title).toBe("Default title");
	});
});
