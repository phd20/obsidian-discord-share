// Fails when a Discord webhook URL appears in a committed (or committable) file.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/check-no-webhooks.mjs
// Needs a Node with built-in type stripping (22.18+); `npm test` runs the same check through Jest.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepository } from "../test/support/webhookCheck.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const findings = scanRepository(root);

if (findings.length > 0) {
	console.error("Discord webhook URLs found (tokens masked):");
	findings.forEach((f) => console.error(`  ${f.file}:${f.line}  ${f.match}`));
	console.error("Remove them, use an obvious placeholder, or add 'webhook-check: allow' on the line.");
	process.exit(1);
}
console.log("No Discord webhook URLs found.");
