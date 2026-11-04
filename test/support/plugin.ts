// Helpers for e2e specs: plugin handle, settings injection, and the capture server lifecycle.
//
// Settings are injected into the running plugin instance and never persisted (no saveData), so the
// sandbox vault never gets a data.json. They live only in the plugin instance, so a plugin reload
// (browser.reloadObsidian, disable/enable) resets them: inject again after any reload.
import { $$, browser } from "@wdio/globals";
import type { TFile } from "obsidian";
import { obsidianPage } from "wdio-obsidian-service";
import { startCaptureServer } from "./captureServer";
import type { CaptureServer, CaptureServerOptions } from "./captureServer";

export const PLUGIN_ID = "obsidian-discord-share";

/** Command ids as registered in Obsidian (the plugin id is prefixed by Obsidian). */
export const COMMANDS = {
	attachment: `${PLUGIN_ID}:discord:share-attachment`,
	properties: `${PLUGIN_ID}:discord:share-current-note-properties`,
	content: `${PLUGIN_ID}:discord:share-current-note-content`,
	selection: `${PLUGIN_ID}:discord:share-selection`,
} as const;

export type CommandName = keyof typeof COMMANDS;

export interface TestWebhook {
	description: string;
	/** Usually `server.urlFor(...)`; webhook URLs never appear as literals in specs. */
	url: string;
}

export interface SettingsInjection {
	/** Replaces `discordWebhookURL`. */
	webhooks?: TestWebhook[];
	/** Replaces `attachmentFormats`, e.g. ["png", "jpg"]. */
	attachmentFormats?: string[];
	/** Any other top-level settings, e.g. `customBotUsername`, `embedDefaultValues`. Replaced as a whole. */
	settings?: Record<string, unknown>;
}

/** Attachment formats used when a test does not choose its own. */
export const DEFAULT_ATTACHMENT_FORMATS = ["png"];

/** Path of the default test webhook on the capture server. */
export const DEFAULT_WEBHOOK_PATH = "/api/webhooks/1/test";

/**
 * Resets the plugin's in-memory settings to its defaults, then applies `injection`.
 * Not persisted. Call it again after any plugin reload.
 */
export const injectSettings = async (injection: SettingsInjection = {}): Promise<void> => {
	const values: Record<string, unknown> = { ...injection.settings };
	if (injection.webhooks) values.discordWebhookURL = injection.webhooks;
	if (injection.attachmentFormats) values.attachmentFormats = injection.attachmentFormats;
	await browser.executeObsidian(({ app }, id, overrides) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const plugin = (app as any).plugins.plugins[id];
		if (!plugin) throw new Error(`Plugin ${id} is not loaded`);
		// loadSettings only assigns plugin.settings; it does not write data.json.
		plugin.loadSettings({});
		Object.assign(plugin.settings, overrides);
	}, PLUGIN_ID, values);
};

/** Reads the plugin's current in-memory settings (a JSON copy). */
export const readSettings = async (): Promise<Record<string, unknown>> =>
	browser.executeObsidian(({ app }, id) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return JSON.parse(JSON.stringify((app as any).plugins.plugins[id].settings));
	}, PLUGIN_ID);

/** Runs one of the plugin's share commands through Obsidian's command palette registry. */
export const runCommand = async (name: CommandName): Promise<void> => {
	await browser.executeObsidianCommand(COMMANDS[name]);
};

/** Ids of the plugin's registered commands, sorted. */
export const registeredCommandIds = async (): Promise<string[]> =>
	browser.executeObsidian(({ app }, id) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const commands = (app as any).commands.commands as Record<string, unknown>;
		return Object.keys(commands).filter((key) => key.startsWith(`${id}:`)).sort();
	}, PLUGIN_ID);

/** Whether the plugin is loaded and enabled. */
export const isPluginLoaded = async (): Promise<boolean> =>
	browser.executeObsidian(({ app }, id) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return Boolean((app as any).plugins.plugins[id]);
	}, PLUGIN_ID);

/** Whether the sandbox vault contains the plugin's data.json (it must never). */
export const pluginDataFileExists = async (): Promise<boolean> =>
	browser.executeObsidian(async ({ app }, id) => {
		return app.vault.adapter.exists(`${app.vault.configDir}/plugins/${id}/data.json`);
	}, PLUGIN_ID);

export interface CaptureHarness {
	/** The capture server; valid inside tests and hooks once registered by `useCaptureServer`. */
	readonly server: CaptureServer;
	/** Full URL on the capture server for the default test webhook. */
	readonly webhookUrl: string;
}

export interface UseCaptureServerOptions extends CaptureServerOptions {
	/** Settings injected before each test. Defaults to one webhook named "test" and png attachments. */
	inject?: (server: CaptureServer) => SettingsInjection;
	/** Skip the per-test vault reset (default: reset). */
	resetVault?: boolean;
}

/**
 * Call inside a `describe`. Registers hooks that
 *  - start one capture server for the suite (`before`) and close it (`after`),
 *  - before each test: clear captured requests and responses, reset the vault files to the fixture,
 *    and re-inject settings (one webhook pointing at the server, png attachments).
 *
 * Returns a handle; read `.server` inside tests, not at describe time.
 */
export const useCaptureServer = (options: UseCaptureServerOptions = {}): CaptureHarness => {
	let server: CaptureServer | undefined;
	const { inject, resetVault = true, ...serverOptions } = options;

	before(async () => {
		server = await startCaptureServer(serverOptions);
	});

	beforeEach(async () => {
		if (!server) throw new Error("capture server is not running");
		server.reset();
		if (resetVault) await obsidianPage.resetVault();
		await injectSettings(
			inject
				? inject(server)
				: {
					webhooks: [{ description: "test", url: server.urlFor(DEFAULT_WEBHOOK_PATH) }],
					attachmentFormats: DEFAULT_ATTACHMENT_FORMATS,
				},
		);
	});

	after(async () => {
		await server?.close();
		server = undefined;
	});

	return {
		get server() {
			if (!server) throw new Error("capture server is not running");
			return server;
		},
		get webhookUrl() {
			return this.server.urlFor(DEFAULT_WEBHOOK_PATH);
		},
	};
};

// --- UI helpers: selection, the webhook picker (a suggest modal) and notices ---------------------

/** Opens selection.md and selects the marked sentence in its editor. */
export const selectSentence = async () => {
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
export const textsOf = async (selector: string): Promise<string[]> =>
	browser.execute(
		(sel) => Array.from(document.querySelectorAll(sel)).map((el) => (el.textContent || "").trim()),
		selector,
	);

/** Waits for a suggest modal and returns the text of its suggestions. */
export const suggestionTexts = async (): Promise<string[]> => {
	await browser.waitUntil(async () => (await textsOf(".modal-container .suggestion-item")).length > 0, {
		timeoutMsg: "no suggest modal with suggestions appeared",
	});
	return textsOf(".modal-container .suggestion-item");
};

/** Clicks the suggestion whose text is exactly `text`. */
export const chooseSuggestion = async (text: string) => {
	const index = (await suggestionTexts()).indexOf(text);
	if (index === -1) throw new Error(`suggestion "${text}" not found`);
	const items = await $$(".modal-container .suggestion-item");
	// Under mobile emulation the prompt slides in as a drawer, and a click on a moving item is lost
	// or intercepted, so wait until the item holds still before clicking.
	let lastTop = Number.NaN;
	await browser.waitUntil(async () => {
		const { y } = await items[index].getLocation();
		const settled = y === lastTop;
		lastTop = y;
		return settled;
	}, { interval: 150, timeoutMsg: `suggestion "${text}" never stopped moving` });
	await items[index].click();
};

export const noticeTexts = async (): Promise<string[]> => textsOf(".notice-container .notice");

/** Waits until a notice satisfying `predicate` is visible and returns its text. */
export const waitForNotice = async (predicate: (text: string) => boolean): Promise<string> => {
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

/** Whether any modal (such as the webhook picker) is open. */
export const modalOpen = async (): Promise<boolean> => (await textsOf(".modal-container")).length > 0;

/** Removes every notice from the screen, so a test only sees notices it caused itself. */
export const clearNotices = async (): Promise<void> => {
	await browser.execute(() => {
		document.querySelectorAll(".notice").forEach((notice) => notice.remove());
	});
};

export { obsidianPage };
