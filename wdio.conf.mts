import * as path from "path";

// Obsidian versions to test, as space-separated "appVersion/installerVersion" pairs.
// Override with e.g. OBSIDIAN_VERSIONS="latest/latest" for a quick local run.
const versions: [string, string][] = (process.env.OBSIDIAN_VERSIONS || "earliest/earliest latest/latest")
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
};
