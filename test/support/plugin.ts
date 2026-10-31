// Helpers for e2e specs: plugin handle, settings injection, and the capture server lifecycle.
//
// Settings are injected into the running plugin instance and never persisted (no saveData), so the
// sandbox vault never gets a data.json. They live only in the plugin instance, so a plugin reload
// (browser.reloadObsidian, disable/enable) resets them: inject again after any reload.
import { browser } from "@wdio/globals";
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

export { obsidianPage };
