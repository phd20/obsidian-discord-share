import { $, browser, expect } from "@wdio/globals";
import {
	chooseSuggestion,
	clearNotices,
	injectSettings,
	modalOpen,
	runCommand,
	selectSentence,
	suggestionTexts,
	useCaptureServer,
	waitForNotice,
} from "../support/plugin";
import { DISCORD_ATTACHMENT_LIMIT_BYTES, writeOversizedPng } from "../support/oversized";

const FIRST_PATH = "/api/webhooks/1/first";
const SECOND_PATH = "/api/webhooks/2/second";

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
		// Notices stay up for several seconds, so a previous test's notice must not satisfy this test's wait.
		beforeEach(async () => {
			await clearNotices();
		});

		/** Writes big.png into the sandbox vault and shares it as an attachment. */
		const shareBigPng = async () => {
			// The oversized file is generated on demand and written straight into the sandbox vault.
			const basePath = await browser.executeObsidian(({ app }) => (app.vault.adapter as unknown as { basePath: string }).basePath);
			writeOversizedPng(basePath, "big.png");
			await browser.waitUntil(
				async () =>
					browser.executeObsidian(({ app }) => app.vault.getAbstractFileByPath("big.png") !== null),
				{ timeoutMsg: "Obsidian did not index big.png" },
			);

			await runCommand("attachment");
			const input = await $(".modal-container .prompt-input");
			await input.waitForDisplayed();
			await input.setValue("big.png");
			await browser.waitUntil(async () => (await suggestionTexts()).includes("big.png"));
			await chooseSuggestion("big.png");
		};

		it("413 on an oversized attachment says the file is larger than the server accepts", async () => {
			harness.server.setResponse(413, "Request entity too large");
			await shareBigPng();

			const notice = await waitForNotice((text) => text.startsWith("Failed to share big.png"));
			expect(notice).toBe("Failed to share big.png to Discord. The file is larger than this Discord server accepts.");
			const [request] = harness.server.requests;
			expect(harness.server.requests).toHaveLength(1);
			const upload = request.parts?.find((part) => part.name === "files[0]");
			expect(upload?.filename).toBe("big.png");
			expect(upload?.size).toBeGreaterThan(DISCORD_ATTACHMENT_LIMIT_BYTES);
		});

		it("a 400 whose body contains 413 is reported as a 400, not as an oversized file", async () => {
			// A plain string body that is not Discord's field-error shape, so the notice falls back to the raw text.
			harness.server.setResponse(400, '{"message":"code 413"}');
			await shareBigPng();

			const notice = await waitForNotice((text) => text.startsWith("Failed to share big.png"));
			expect(notice).not.toContain("larger than this Discord server accepts");
			expect(notice).toContain("400");
			expect(harness.server.requests).toHaveLength(1);
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
