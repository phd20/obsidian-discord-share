import { browser, expect } from "@wdio/globals";
import {
	COMMANDS,
	isPluginLoaded,
	pluginDataFileExists,
	readSettings,
	registeredCommandIds,
	runCommand,
	useCaptureServer,
} from "../support/plugin";

describe("Discord Share smoke", () => {
	const harness = useCaptureServer();

	it("loads the plugin", async () => {
		expect(await isPluginLoaded()).toBe(true);
	});

	it("registers the four share commands", async () => {
		expect(await registeredCommandIds()).toEqual(Object.values(COMMANDS).sort());
		expect(Object.values(COMMANDS)).toHaveLength(4);
	});

	it("injects a single webhook without persisting it", async () => {
		const settings = await readSettings();
		expect(settings.discordWebhookURL).toEqual([{ description: "test", url: harness.webhookUrl }]);
		expect(await pluginDataFileExists()).toBe(false);
	});

	it("posts to the injected webhook when a share command runs", async () => {
		await browser.executeObsidian(async ({ app }) => {
			await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath("plain-content.md") as import("obsidian").TFile);
		});
		await runCommand("content");
		const [request] = await harness.server.waitForRequests(1);
		expect(harness.server.requests).toHaveLength(1);
		expect(request.path).toBe("/api/webhooks/1/test");
		expect(request.json.embeds).toHaveLength(1);
		expect(await pluginDataFileExists()).toBe(false);
	});
});
