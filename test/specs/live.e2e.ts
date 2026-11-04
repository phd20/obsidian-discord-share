// Optional live check: sends one embed and one attachment to a real Discord webhook.
//
// Runs only when DISCORD_TEST_WEBHOOK_URL is set (gitignored .env.test locally, a repository secret in
// CI). Otherwise every test here is reported as skipped. The URL is a credential, so it is never
// written into a message: failures are rethrown through `redacted`, and wdio.conf.mts masks it in
// the console output.
//
// Success is read from the plugin's own notices ("Successfully shared ..." is only shown after a 2xx
// response), so this keeps working if the plugin moves from fetch() to Obsidian's requestUrl().
import { $, $$, browser } from "@wdio/globals";
import { getLiveWebhookUrl, redacted } from "../support/liveEnv";
import { PLUGIN_ID, injectSettings, obsidianPage, runCommand } from "../support/plugin";

const NOTE = "properties.md";
const ATTACHMENT = "attachments/b.png";

const noticeTexts = (): Promise<string[]> =>
	browser.execute(() => Array.from(document.querySelectorAll(".notice"), (notice) => notice.textContent ?? ""));

const clearNotices = (): Promise<void> =>
	browser.execute(() => document.querySelectorAll(".notice").forEach((notice) => notice.remove()));

/** Waits for the plugin to report the outcome, and fails with its failure notice (status and Discord's reply). */
const expectSuccessNotice = async (success: string): Promise<void> => {
	let failure: string | undefined;
	try {
		// waitUntil swallows errors thrown by its condition, so the failure notice is kept on the side.
		await browser.waitUntil(
			async () => {
				const notices = await noticeTexts();
				failure = notices.find((text) => text.startsWith("Failed to share"));
				return failure !== undefined || notices.includes(success);
			},
			{ timeout: 20000 },
		);
	} catch {
		throw new Error(`No "${success}" notice shown`);
	}
	if (failure) throw new Error(`Discord did not accept the request: ${failure}`);
};

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

const EMBED_DESCRIPTION_LIMIT = 4096;
const LIVE_PREFIX = "ods live check: ";

/**
 * Writes `body` to a new note in the sandbox vault (nothing long is committed), opens it, and waits until
 * the plugin has read it: the content command shares the text the plugin cached when the note became active.
 */
const openGeneratedNote = async (path: string, body: string): Promise<void> => {
	await browser.executeObsidian(async ({ app }, notePath, text) => {
		const existing = app.vault.getAbstractFileByPath(notePath);
		if (existing) await app.vault.delete(existing);
		await app.vault.create(notePath, text);
	}, path, body);
	await obsidianPage.openFile(path);
	await browser.waitUntil(
		() => browser.executeObsidian(({ app }, id, text) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const plugin = (app as any).plugins.plugins[id];
			return app.workspace.getActiveFile()?.path !== undefined && plugin.currentFileContents === text;
		}, PLUGIN_ID, body),
		{ timeout: 10000, timeoutMsg: `The plugin never picked up the contents of ${path}` },
	);
};

const webhookUrl = getLiveWebhookUrl();

// Reported as skipped (Mocha "pending") when the variable is unset; nothing in the block runs then.
(webhookUrl ? describe : describe.skip)("Live Discord check", () => {
	beforeEach(async () => {
		await redacted(async () => {
			await obsidianPage.resetVault();
			await injectSettings({
				webhooks: [{ description: "live", url: webhookUrl! }],
				attachmentFormats: ["png"],
			});
			await clearNotices();
		});
	});

	it("sends an embed that Discord accepts", async () => {
		await redacted(async () => {
			await obsidianPage.openFile(NOTE);
			// The embed fields are read from the metadata cache, which re-indexes after the vault reset.
			await browser.waitUntil(
				() => browser.executeObsidian(({ app }, path) => {
					const file = app.vault.getAbstractFileByPath(path) as import("obsidian").TFile;
					return Boolean(app.metadataCache.getFileCache(file)?.frontmatter?.["ods-title"]);
				}, NOTE),
				{ timeout: 10000, timeoutMsg: `${NOTE} frontmatter was never indexed` },
			);
			await runCommand("properties");
			await expectSuccessNotice("Successfully shared embed to Discord!");
		});
	});

	it("sends an attachment that Discord accepts", async () => {
		await redacted(async () => {
			await runCommand("attachment");
			await pickAttachment(ATTACHMENT);
			await expectSuccessNotice("Successfully shared b.png to Discord!");
		});
	});

	it("accepts a description of 4096 code points that is 4596 UTF-16 units long", async () => {
		await redacted(async () => {
			// 16 + 500 emoji (2 UTF-16 units each) + 3580 = 4096 code points, 4596 units, 5.6 KB (under Discord's ~10 KB cap).
			const body = `${LIVE_PREFIX}${"😀".repeat(500)}${"x".repeat(3580)}`;
			if ([...body].length !== EMBED_DESCRIPTION_LIMIT || body.length !== 4596) {
				throw new Error("The generated body is not 4096 code points / 4596 UTF-16 units");
			}
			await openGeneratedNote("live-code-points.md", body);
			await runCommand("content");
			await expectSuccessNotice("Successfully shared embed to Discord!");
		});
	});

	it("ignores trailing whitespace when counting the description", async () => {
		await redacted(async () => {
			// 4096 characters, then 3 spaces and a newline: only the trimmed text counts.
			const text = `${LIVE_PREFIX}${"y".repeat(EMBED_DESCRIPTION_LIMIT - LIVE_PREFIX.length)}`;
			const body = `${text}   \n`;
			if ([...text].length !== EMBED_DESCRIPTION_LIMIT) throw new Error("The generated text is not 4096 characters");
			await openGeneratedNote("live-trailing-whitespace.md", body);
			await runCommand("content");
			await expectSuccessNotice("Successfully shared embed to Discord!");
		});
	});
});
