// Points the sandboxed plugin at the capture server, through the guard. Run it again after any plugin reload
// (hot reload on a rebuild, disable/enable): settings live only in the plugin instance and reset on reload.
// Nothing is persisted, so the sandbox vault never gets a data.json.
//
//   node scripts/dev-inject.mjs [--path /api/webhooks/1/dev] [--formats png,jpg]
//
// The capture server URL is read from test/.captures/server-url.txt, never hard-coded.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { PLUGIN_ID, root, serverUrlFile } from "./lib/devloop.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};

if (!fs.existsSync(serverUrlFile)) {
	console.error(`No capture server URL at ${serverUrlFile}. Start the loop first: npm run devloop:start`);
	process.exit(1);
}
const base = fs.readFileSync(serverUrlFile, "utf8").trim().replace(/\/$/, "");
const webhookUrl = `${base}${option("path", "/api/webhooks/1/dev")}`;
const formats = option("formats", "png").split(",").map((format) => format.trim()).filter(Boolean);

// Mirrors test/support/plugin.ts injectSettings: reset to defaults, then override. loadSettings only assigns
// plugin.settings; it does not write data.json.
const code = `(() => {
	const plugin = app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];
	if (!plugin) throw new Error("Plugin ${PLUGIN_ID} is not loaded");
	plugin.loadSettings({});
	Object.assign(plugin.settings, ${JSON.stringify({
		discordWebhookURL: [{ description: "dev-loop capture", url: webhookUrl }],
		attachmentFormats: formats,
	})});
	return "injected: " + plugin.settings.discordWebhookURL.length + " webhook(s), formats " + plugin.settings.attachmentFormats.join(",");
})()`;

const run = spawnSync(process.execPath, ["scripts/obsidian-guard.mjs", "eval", `code=${code}`], { cwd: root, encoding: "utf8" });
process.stderr.write(run.stderr ?? "");
if (run.status !== 0) process.exit(run.status ?? 1);
console.log(`${(run.stdout ?? "").trim()} -> ${new URL(webhookUrl).origin}${new URL(webhookUrl).pathname}`);
