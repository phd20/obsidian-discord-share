// The only way Claude calls the Obsidian CLI. It forwards a CLI call only when the instance the CLI
// is connected to has the dev loop's own sandbox vault copy open.
//
//   node scripts/obsidian-guard.mjs                 check only
//   node scripts/obsidian-guard.mjs <cli args...>   check, then run `obsidian-cli <cli args...>`
//
// The CLI binds to one per-user socket (~/.obsidian-cli.sock) owned by whichever Obsidian started last,
// so any instance can answer: a personal vault, or a wdio sandbox that is also a temp directory. The check
// therefore compares `app.vault.adapter.basePath` with the exact path the launcher printed (recorded by
// `npm run devloop:start`). It never retries, never launches anything, and never tries another route.
//
// Exit codes: 0 ok (or the forwarded CLI's own code), 3 refused (wrong vault), 4 nothing usable answered.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
	EXIT_REFUSED, EXIT_UNREACHABLE, canonicalPath, isProcess, readState, resolveCli, statePath,
} from "./lib/devloop.mjs";

const STOP = "STOP and report this to the user. Do not retry and do not try another route.";

const refuse = (code, message) => {
	console.error(`GUARD REFUSED: ${message}\n${STOP}`);
	process.exit(code);
};

const args = process.argv.slice(2);

// `vault=<name>` would aim the call at a different vault, which is exactly what the guard exists to prevent.
if (args.some((arg) => /^vault=/.test(arg))) {
	refuse(EXIT_REFUSED, "the vault= argument is not allowed; the guard pins the call to the sandbox vault.");
}

const state = readState();
if (!state) {
	refuse(EXIT_UNREACHABLE, `the dev loop is not running (no state file at ${statePath}). Start it with: npm run devloop:start`);
}
if (!isProcess(state.launcher?.pid, "obsidian-launcher")) {
	refuse(EXIT_UNREACHABLE, "the dev loop's launcher process is not running (stale state). Run `npm run devloop:stop`, then `npm run devloop:start`.");
}

const cli = state.cliPath && fs.existsSync(state.cliPath) ? state.cliPath : resolveCli();
if (!cli) {
	refuse(EXIT_UNREACHABLE, "obsidian-cli was not found in the launcher cache (needs installer >= 1.12.7: `-v latest -i latest`).");
}

const probe = spawnSync(cli, ["eval", "code=app.vault.adapter.basePath"], { encoding: "utf8", timeout: 15000 });
const probeOutput = `${probe.stdout ?? ""}${probe.stderr ?? ""}`.trim();
if (process.env.OBSIDIAN_GUARD_DEBUG) console.error(`[guard] probe exit=${probe.status} output=${JSON.stringify(probeOutput)}`);
if (probe.error || probe.status !== 0) {
	refuse(
		EXIT_UNREACHABLE,
		`no Obsidian instance answered the CLI (${probe.error?.message ?? probeOutput.split("\n")[0] ?? `exit ${probe.status}`}).`,
	);
}

// The eval output is the vault path, possibly prefixed (e.g. "=> "). Anything that is not an absolute path
// (e.g. an error line while Obsidian is still starting) means we cannot tell yet: nothing is forwarded.
const reported = probeOutput.split("\n").map((line) => line.replace(/^=>\s*/, "").trim()).filter(Boolean).pop();
if (!reported || !(path.isAbsolute(reported) || /^[A-Za-z]:[\\/]/.test(reported))) {
	refuse(EXIT_UNREACHABLE, `the instance did not report a vault path (got ${JSON.stringify(reported ?? "")}); it may still be starting.`);
}
if (canonicalPath(reported) !== canonicalPath(state.vaultPath)) {
	refuse(
		EXIT_REFUSED,
		`the CLI is connected to a different vault (${reported}), not the sandbox copy (${state.vaultPath}). ` +
			"No command was run. A personal Obsidian (or another sandbox, e.g. a wdio run) is open and holds the CLI socket: it must be closed.",
	);
}

if (args.length === 0) {
	console.log(`OK: the CLI is connected to the sandbox vault ${state.vaultPath}`);
	process.exit(0);
}
const run = spawnSync(cli, args, { stdio: "inherit" });
process.exit(run.status ?? 1);
