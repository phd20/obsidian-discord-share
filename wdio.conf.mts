import * as fs from "fs";
import * as path from "path";
import { browser } from "@wdio/globals";
import { setUpLiveEnv } from "./test/support/liveEnv";

// Loads the gitignored .env.test (DISCORD_TEST_WEBHOOK_URL for the optional live check) and masks
// the webhook URL in all console output. Runs in the launcher and in every worker.
setUpLiveEnv(path.resolve(".env.test"));

// Obsidian versions to test, as space-separated "appVersion/installerVersion" pairs.
// Override with e.g. OBSIDIAN_VERSIONS="latest/latest" for a quick local run.
// A run aimed at the live spec alone (npm run test:e2e:live) defaults to latest only, so each message is posted once.
const liveOnly = process.argv.some((arg) => arg.includes("live.e2e"));
const versions: [string, string][] = (process.env.OBSIDIAN_VERSIONS || (liveOnly ? "latest/latest" : "earliest/earliest latest/latest"))
	.split(/\s+/)
	.filter(Boolean)
	.map((pair) => {
		const [app, installer = app] = pair.split("/");
		return [app, installer];
	});

// Every wdio worker launches its own Obsidian, so keep the default low.
const maxInstances = Number(process.env.WDIO_MAX_INSTANCES) || 1;

// OBSIDIAN_EMULATE_MOBILE=1 runs the selected versions with Obsidian's mobile emulation instead
// (CI: OBSIDIAN_VERSIONS=latest/latest OBSIDIAN_EMULATE_MOBILE=1).
const emulateMobile = process.env.OBSIDIAN_EMULATE_MOBILE === "1";

// Failure artifacts (gitignored; CI uploads this directory when a job fails). wdio writes its worker
// logs to outputDir; failing tests also get a screenshot, and nothing else (no DOM or notice text).
const artifactsDir = path.resolve("test/.artifacts");

const saveFailureScreenshot = async (spec: string | undefined, title: string) => {
	try {
		const dir = path.join(artifactsDir, "screenshots");
		fs.mkdirSync(dir, { recursive: true });
		const obsidianOptions = (browser.requestedCapabilities as WebdriverIO.Capabilities)["wdio:obsidianOptions"];
		const slug = [path.basename(spec || "spec").replace(/\.e2e\.ts$/, ""), obsidianOptions?.appVersion, emulateMobile && "mobile", title]
			.filter(Boolean)
			.join("-")
			.replace(/[^A-Za-z0-9._-]+/g, "_")
			.slice(0, 150);
		await browser.saveScreenshot(path.join(dir, `${slug}.png`));
	} catch (error) {
		console.warn("Could not save failure screenshot:", (error as Error).message);
	}
};

export const config: WebdriverIO.Config = {
	runner: "local",
	framework: "mocha",
	specs: ["./test/specs/**/*.e2e.ts"],
	maxInstances,

	capabilities: versions.map(([appVersion, installerVersion]) => ({
		browserName: "obsidian",
		browserVersion: appVersion,
		"wdio:obsidianOptions": {
			installerVersion,
			plugins: ["."],
			vault: "test/vaults/basic",
			emulateMobile,
		},
		...(emulateMobile && {
			"goog:chromeOptions": { mobileEmulation: { deviceMetrics: { width: 390, height: 844 } } },
		}),
	})),

	services: ["obsidian"],
	reporters: ["obsidian"],

	// Shared by every worktree when OBSIDIAN_CACHE is set, so Obsidian is only downloaded once.
	cacheDir: path.resolve(process.env.OBSIDIAN_CACHE || ".obsidian-cache"),

	injectGlobals: false,
	mochaOpts: {
		ui: "bdd",
		timeout: 60000,
		retries: 0,
	},
	logLevel: "warn",
	outputDir: path.join(artifactsDir, "logs"),

	afterTest: async (test, _context, { passed }) => {
		if (!passed) await saveFailureScreenshot(test.file, test.title);
	},
	// A failing before/after hook fails the suite without running afterTest.
	afterHook: async (test, _context, { error }) => {
		if (error) await saveFailureScreenshot(test.file, test.title);
	},
};
