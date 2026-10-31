// Embed sharing: note properties, note content, and selection (command and editor context menu).
// Every share here is a JSON embed (no local image), so the capture server records `request.json`.
import { $$, browser, expect } from "@wdio/globals";
import {
	DEFAULT_WEBHOOK_PATH,
	pluginDataFileExists,
	runCommand,
	useCaptureServer,
} from "../support/plugin";
import type { CapturedRequest } from "../support/captureServer";

const DEFAULT_USERNAME = "Obsidian Share";
const DEFAULT_AVATAR_URL = "https://avatars.githubusercontent.com/u/65011256";
const SUCCESS_NOTICE = "Successfully shared embed to Discord!";
const SELECTION_MENU_TITLE = "Share selection to Discord";

// --- Local helpers (only used by this spec) ---------------------------------------------------

/**
 * Opens a vault note in the active leaf and waits until the plugin and editor are ready for it:
 * the metadata cache has indexed it (frontmatter available), the editor holds its text, and the
 * plugin's `active-leaf-change` handler has read the contents it uses for "share content".
 */
const openNote = async (path: string): Promise<void> => {
	await browser.executeObsidian(async ({ app }, notePath) => {
		const file = app.vault.getAbstractFileByPath(notePath);
		if (!file) throw new Error(`Fixture note not found: ${notePath}`);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await app.workspace.getLeaf(false).openFile(file as any);
	}, path);
	await browser.waitUntil(
		() =>
			browser.executeObsidian(({ app }, notePath, id) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const plugin = (app as any).plugins.plugins[id];
				const file = app.vault.getAbstractFileByPath(notePath);
				if (!file || app.workspace.getActiveFile()?.path !== notePath) return false;
				const indexed = Boolean(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					app.metadataCache.getFileCache(file as any),
				);
				const editorText = app.workspace.activeEditor?.editor?.getValue() ?? "";
				return indexed && editorText.length > 0 && plugin.currentFileContents === editorText;
			}, path, "obsidian-discord-share"),
		{ timeout: 10000, timeoutMsg: `${path} did not become the active, indexed note` },
	);
};

/** Selects the first occurrence of `text` in the active editor. */
const selectText = async (text: string): Promise<void> => {
	await browser.executeObsidian(({ app }, needle) => {
		const editor = app.workspace.activeEditor?.editor;
		if (!editor) throw new Error("No active editor");
		const start = editor.getValue().indexOf(needle);
		if (start === -1) throw new Error(`Text not found in editor: ${needle}`);
		editor.setSelection(editor.offsetToPos(start), editor.offsetToPos(start + needle.length));
		editor.focus();
	}, text);
	await browser.waitUntil(
		() => browser.executeObsidian(({ app }) => app.workspace.activeEditor?.editor?.somethingSelected() ?? false),
		{ timeoutMsg: "Selection did not register in the editor" },
	);
};

/** Text of every notice currently on screen. */
const noticeTexts = (): Promise<string[]> =>
	browser.execute(() =>
		Array.from(document.querySelectorAll(".notice")).map((notice) => notice.textContent ?? ""),
	);

const clearNotices = (): Promise<void> =>
	browser.execute(() => {
		document.querySelectorAll(".notice").forEach((notice) => notice.remove());
	});

const waitForNotice = async (expected: string): Promise<void> => {
	await browser.waitUntil(async () => (await noticeTexts()).some((text) => text.includes(expected)), {
		timeoutMsg: `Notice "${expected}" was not shown`,
	});
};

/** Viewport coordinates of the middle of the current text selection (Obsidian draws it natively). */
const selectionCenter = (): Promise<{ x: number; y: number }> =>
	browser.execute(() => {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return { x: -1, y: -1 };
		const rects = Array.from(selection.getRangeAt(0).getClientRects());
		const rect = rects[Math.floor(rects.length / 2)] ?? selection.getRangeAt(0).getBoundingClientRect();
		return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
	});

/**
 * Under mobile emulation Obsidian never fires `editor-menu` for a right-click or a long press
 * (verified on 1.14.5), so the editor context menu cannot be reached; the command path covers
 * the same handler there. Skips the calling test in that mode only.
 */
const skipOnMobile = async (test: Mocha.Context): Promise<void> => {
	const isMobile = await browser.executeObsidian(({ obsidian }) => obsidian.Platform.isMobile);
	if (isMobile) test.skip();
};

/** Right-clicks the selected text in the editor and clicks the plugin's context menu item. */
const clickSelectionMenuItem = async (): Promise<void> => {
	// On macOS Obsidian shows native OS menus by default, which WebDriver cannot see or click.
	// Switch to its DOM-drawn menus (same menu, same editor-menu event, same plugin handler).
	// Obsidian 1.4.13 reads the preference once at startup into `Menu.useNativeMenu` (the config key
	// only matters on the next launch), so set that flag too. Newer versions react to the config.
	await browser.executeObsidian(({ app, obsidian }) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(app.vault as any).setConfig("nativeMenus", false);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(obsidian.Menu as any).useNativeMenu = false;
	});
	// A menu left over from the previous test must be gone before the next one opens, or the click below
	// can land on a stale item that is being removed (seen on slow CI runners).
	await browser.waitUntil(async () => (await $$(".menu").length) === 0, {
		timeoutMsg: "A previous context menu never closed",
	});
	const { x, y } = await selectionCenter();
	if (x < 0) throw new Error("There is no text selection to right-click");
	await browser
		.action("pointer")
		.move({ x, y, origin: "viewport" })
		.down({ button: 2 })
		.up({ button: 2 })
		.perform();

	await browser.waitUntil(async () => (await $$(".menu .menu-item").length) > 0, {
		timeoutMsg: "The editor context menu did not open",
	});
	let target: WebdriverIO.Element | undefined;
	for (const item of await $$(".menu .menu-item")) {
		if ((await item.getText()).trim() === SELECTION_MENU_TITLE) target = item;
	}
	if (!target) throw new Error(`Context menu has no "${SELECTION_MENU_TITLE}" item`);
	// Wait for the menu to stop moving (it animates in), so the click is not lost on a moving item.
	let lastTop = Number.NaN;
	await browser.waitUntil(
		async () => {
			const { y: top } = await target!.getLocation();
			const settled = top === lastTop;
			lastTop = top;
			return settled;
		},
		{ interval: 150, timeoutMsg: "The context menu item never stopped moving" },
	);
	await target.click();
	await browser.waitUntil(async () => (await $$(".menu").length) === 0, {
		timeoutMsg: "The context menu did not close after choosing the item",
	});
};

/**
 * Registers a test for behavior that is known to be broken in the plugin. `arrange` does the setup
 * and captures the request, and must succeed; it returns the assertions, which state the correct
 * behavior. While the bug exists they fail and the test passes (shown as a known bug). Once the bug
 * is fixed they pass, and the test fails to tell you to turn it into a plain `it`.
 */
const itKnownBug = (bead: string, title: string, arrange: () => Promise<() => void>): void => {
	it(`[known bug ${bead}] ${title}`, async () => {
		const assertions = await arrange();
		let failure: unknown;
		try {
			assertions();
		} catch (error) {
			failure = error;
		}
		if (!failure) throw new Error(`${bead} appears fixed: turn this into a plain it(...)`);
	});
};

// --- Specs ------------------------------------------------------------------------------------

describe("Discord Share embeds", () => {
	const harness = useCaptureServer();

	beforeEach(async () => {
		await clearNotices();
	});

	/** The one request the capture server must have received, and its first embed. */
	const singleEmbedRequest = async (): Promise<{ request: CapturedRequest; embed: any }> => { // eslint-disable-line @typescript-eslint/no-explicit-any
		await harness.server.waitForRequests(1);
		expect(harness.server.requests).toHaveLength(1);
		const request = harness.server.requests[0];
		expect(request.method).toBe("POST");
		expect(request.path).toBe(DEFAULT_WEBHOOK_PATH);
		expect(request.json.embeds).toHaveLength(1);
		return { request, embed: request.json.embeds[0] };
	};

	describe("Share note properties", () => {
		beforeEach(async () => {
			await openNote("properties.md");
			await runCommand("properties");
		});

		it("sends a JSON embed with the default username and avatar", async () => {
			const { request } = await singleEmbedRequest();
			expect(request.headers["content-type"]).toMatch(/^application\/json/);
			expect(request.parts).toBeUndefined();
			expect(request.json.username).toBe(DEFAULT_USERNAME);
			expect(request.json.avatar_url).toBe(DEFAULT_AVATAR_URL);
			expect(await pluginDataFileExists()).toBe(false);
		});

		it("maps title, numeric color, url, description, thumbnail and image", async () => {
			const { embed } = await singleEmbedRequest();
			expect(embed.title).toBe("Fixture Properties Note");
			// ods-color '#8D59D7' -> 0x8D59D7 (141, 89, 215)
			expect(embed.color).toBe(9263575);
			expect(embed.url).toBe("https://example.com/fixture");
			expect(embed.description).toBe("Description taken from the fixture frontmatter");
			expect(embed.thumbnail).toEqual({ url: "https://example.com/thumbnail.png" });
			// A URL image stays in the JSON embed; no attachment is uploaded.
			expect(embed.image).toEqual({ url: "https://example.com/image.png" });
			expect(Number.isNaN(Date.parse(embed.timestamp))).toBe(false);
		});

		it("maps author, footer and fields", async () => {
			const { embed } = await singleEmbedRequest();
			expect(embed.author.name).toBe("Fixture Author");
			expect(embed.author.url).toBe("https://example.com/author");
			expect(embed.footer.text).toBe("Fixture footer");
			expect(embed.fields).toEqual([
				{ name: "Version", value: "1.2.0", inline: true },
				{ name: "Install", value: "Ready", inline: true },
				{ name: "Awesome?", value: "Yes", inline: false },
			]);
		});

		// Discord's embed API names these `icon_url`; the frontmatter (and the plugin's params) use
		// `iconURL`, and DiscordManager.shareEmbed passes the author/footer objects through as-is, so
		// the icons are sent as `iconURL` and Discord ignores them.
		itKnownBug("ods-5bw", "author and footer icons are sent as icon_url", async () => {
			const { embed } = await singleEmbedRequest();
			return () => {
				expect(embed.author.icon_url).toBe("https://example.com/author.png");
				expect(embed.footer.icon_url).toBe("https://example.com/footer.png");
			};
		});

		it("shows the success notice", async () => {
			await singleEmbedRequest();
			await waitForNotice(SUCCESS_NOTICE);
		});
	});

	describe("Share note content", () => {
		beforeEach(async () => {
			await openNote("plain-content.md");
			await runCommand("content");
		});

		it("sends the note body without frontmatter, comments or wikilink syntax", async () => {
			const { request, embed } = await singleEmbedRequest();
			expect(request.headers["content-type"]).toMatch(/^application\/json/);
			expect(embed.title).toBe("plain-content");
			const description: string = embed.description;

			// Frontmatter is gone.
			expect(description).not.toContain("---");
			expect(description).not.toContain("Frontmatter that must be stripped");
			expect(description).not.toContain("tags:");
			// Single- and multi-line comments are gone.
			expect(description).not.toContain("%%");
			expect(description).not.toContain("single-line comment");
			expect(description).not.toContain("multi-line comment");
			// Wikilinks, aliases and embeds lose their brackets (aliases keep the alias text).
			expect(description).not.toContain("[[");
			expect(description).not.toContain("]]");
			expect(description).not.toContain("with-image");
			// Surrounding text survives. Blank-line runs left by removed comments are collapsed
			// for the comparison, since only the visible text is under test.
			expect(description.replace(/\n{3,}/g, "\n\n").trim()).toContain(
				["# Plain content note", "Visible paragraph before the comment."].join("\n\n"),
			);
			expect(description).toContain("An embed of b.png and a trailing sentence.");
			expect(description).toContain("the image note");
		});

		// A plain wikilink followed by an aliased one on the same line: replaceLinkAliases' lazy
		// `\[\[.*?\|` runs across `]]` and drops "A link to [[properties]] and an aliased link to".
		itKnownBug("ods-04w", "keeps a plain wikilink that precedes an aliased one on the same line", async () => {
			const { embed } = await singleEmbedRequest();
			return () => {
				expect(embed.description).toContain("A link to properties and an aliased link to the image note.");
			};
		});

		it("shows the success notice", async () => {
			await singleEmbedRequest();
			await waitForNotice(SUCCESS_NOTICE);
		});
	});

	describe("Share selection", () => {
		const PLAIN_SELECTION = "SELECTED_TEXT_START to be selected SELECTED_TEXT_END";
		// Formatting cases are kept apart from the known plain-then-aliased bug (ods-04w) by
		// selecting the plain and aliased links separately.
		const FORMATTED_SELECTION = "A link to [[properties]]";
		const FORMATTED_RESULT = "A link to properties";
		const ALIAS_SELECTION = "[[with-image|the image note]]";
		const ALIAS_RESULT = "the image note";
		const MIXED_SELECTION = "A link to [[properties]] and an aliased link to [[with-image|the image note]].";
		const MIXED_RESULT = "A link to properties and an aliased link to the image note.";

		it("through the command: sends the selected text", async () => {
			await openNote("selection.md");
			await selectText(PLAIN_SELECTION);
			await runCommand("selection");

			const { request, embed } = await singleEmbedRequest();
			expect(request.headers["content-type"]).toMatch(/^application\/json/);
			expect(request.json.username).toBe(DEFAULT_USERNAME);
			expect(embed.description).toBe(PLAIN_SELECTION);
			await waitForNotice(SUCCESS_NOTICE);
		});

		it("through the command: removes wikilink brackets from the selection", async () => {
			await openNote("plain-content.md");
			await selectText(FORMATTED_SELECTION);
			await runCommand("selection");

			const { embed } = await singleEmbedRequest();
			expect(embed.description).toBe(FORMATTED_RESULT);
			await waitForNotice(SUCCESS_NOTICE);
		});

		it("through the command: replaces an aliased link with its alias", async () => {
			await openNote("plain-content.md");
			await selectText(ALIAS_SELECTION);
			await runCommand("selection");

			const { embed } = await singleEmbedRequest();
			expect(embed.description).toBe(ALIAS_RESULT);
		});

		itKnownBug("ods-04w", "through the command: formats a plain link followed by an aliased link", async () => {
			await openNote("plain-content.md");
			await selectText(MIXED_SELECTION);
			await runCommand("selection");

			const { embed } = await singleEmbedRequest();
			return () => {
				expect(embed.description).toBe(MIXED_RESULT);
			};
		});

		it("through the editor context menu: sends the selected text", async function () {
			await skipOnMobile(this);
			await openNote("selection.md");
			await selectText(PLAIN_SELECTION);
			await clickSelectionMenuItem();

			const { request, embed } = await singleEmbedRequest();
			expect(request.headers["content-type"]).toMatch(/^application\/json/);
			expect(embed.description).toBe(PLAIN_SELECTION);
			await waitForNotice(SUCCESS_NOTICE);
		});

		it("through the editor context menu: removes Obsidian formatting from the selection", async function () {
			await skipOnMobile(this);
			await openNote("plain-content.md");
			await selectText(FORMATTED_SELECTION);
			await clickSelectionMenuItem();

			const { embed } = await singleEmbedRequest();
			expect(embed.description).toBe(FORMATTED_RESULT);
			await waitForNotice(SUCCESS_NOTICE);
		});
	});
});
