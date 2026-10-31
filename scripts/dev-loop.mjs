// Starts, stops, and reports on the Claude dev loop: a sandboxed, hot-reloading Obsidian on a copy of
// test/vaults/basic, an esbuild watch, and a capture server standing in for Discord.
//
//   node scripts/dev-loop.mjs start | stop | status
//
// `start` is the same as running these three by hand (each in the background, logs in test/.captures/dev-loop/):
//   node esbuild.config.mjs                      (npm run dev: esbuild watch -> main.js)
//   node scripts/capture-server.mjs              (npm run capture-server: JSONL in test/.captures/captures.jsonl)
//   obsidian-launcher watch -v latest -i latest --copy -p . test/vaults/basic
// plus it records the vault copy the launcher printed in test/.captures/dev-loop.json (the guard compares
// against that exact path), then injects the capture-server webhook settings.
//
// Run it with the personal Obsidian closed. Nothing else that launches Obsidian (npm run test:e2e) may run
// while the loop is up: a second instance takes over the CLI socket.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
	EXIT_UNREACHABLE, capturesFile, captureDir, commandOf, isProcess, logDir, obsidianProcesses, processList, readState,
	removeState, resolveCli, resolveLauncher, root, serverUrlFile, statePath, writeState, screenshotDir,
} from "./lib/devloop.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (check, timeoutMs, what) => {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const value = await check();
		if (value) return value;
		if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for ${what}`);
		await sleep(250);
	}
};

const spawnBackground = (name, args) => {
	fs.mkdirSync(logDir, { recursive: true });
	const logFile = path.join(logDir, `${name}.log`);
	const fd = fs.openSync(logFile, "w");
	const child = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ["ignore", fd, fd] });
	child.unref();
	return { pid: child.pid, logFile };
};

const killTree = (pid, signal) => {
	try {
		if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"]);
		else process.kill(-pid, signal); // the group: every background piece is its own group leader
	} catch {
		// already gone
	}
};

const stopProcess = async (pid, marker, firstSignal = "SIGTERM") => {
	if (!isProcess(pid, marker)) return;
	try {
		process.kill(pid, firstSignal);
	} catch {
		return;
	}
	const gone = async (ms) => {
		try {
			await waitFor(() => !isProcess(pid, marker), ms, "exit");
			return true;
		} catch {
			return false;
		}
	};
	if (!(await gone(10000))) {
		killTree(pid, "SIGKILL");
		await gone(5000);
	}
};

/** Obsidian processes that belong to this loop: children of the launcher, or using its config dir. */
const loopObsidian = (state) =>
	obsidianProcesses().filter((p) => p.ppid === state.launcher?.pid || (state.configDir && p.command.includes(state.configDir)));

const start = async () => {
	const existing = readState();
	if (existing && isProcess(existing.launcher?.pid, "obsidian-launcher")) {
		console.log("The dev loop is already running.");
		return status();
	}
	if (existing) {
		console.log("Found a stale state file from a loop that is no longer running; cleaning up first.");
		await stop();
	}

	const others = obsidianProcesses();
	if (others.length > 0) {
		console.error("Refusing to start: Obsidian is already running (close it yourself; this script never does).");
		others.slice(0, 5).forEach((p) => console.error(`  ${p.pid} ${p.command.slice(0, 160)}`));
		process.exit(1);
	}
	const launcherScript = resolveLauncher();
	if (!launcherScript) throw new Error("obsidian-launcher was not found; run `pnpm install`.");
	const cliPath = resolveCli();

	fs.mkdirSync(captureDir, { recursive: true });
	fs.mkdirSync(screenshotDir, { recursive: true });
	if (fs.existsSync(capturesFile) && fs.statSync(capturesFile).size > 0) {
		fs.renameSync(capturesFile, path.join(captureDir, `captures-${Date.now()}.jsonl`));
	}
	fs.rmSync(serverUrlFile, { force: true });

	const startedAt = new Date().toISOString();
	const started = Date.now();
	const state = { startedAt, vaultPath: null, cliPath: cliPath ?? null, root, launcher: null, esbuild: null, capture: null };
	const abort = async (error) => {
		console.error(`dev-loop start failed: ${error.message}`);
		writeState({ ...state, aborting: true });
		await stop();
		process.exit(1);
	};

	try {
		// 1. esbuild watch; the launcher needs main.js to exist before it installs the plugin.
		const esbuild = spawnBackground("esbuild", ["esbuild.config.mjs"]);
		state.esbuild = { pid: esbuild.pid, log: esbuild.logFile };
		writeState(state);
		await waitFor(() => fs.existsSync(path.join(root, "main.js")) && fs.statSync(path.join(root, "main.js")).mtimeMs >= started - 1000, 60000, "esbuild to write main.js");

		// 2. Capture server.
		const capture = spawnBackground("capture-server", ["scripts/capture-server.mjs", "--out", capturesFile]);
		state.capture = { pid: capture.pid, log: capture.logFile };
		writeState(state);
		await waitFor(() => fs.existsSync(serverUrlFile), 20000, "the capture server to write server-url.txt");

		// 3. Sandboxed Obsidian on a copy of the fixture vault. SIGINT is the launcher's clean-exit signal.
		const launcher = spawnBackground("launcher", [launcherScript, "watch", "-v", "latest", "-i", "latest", "--copy", "-p", ".", "test/vaults/basic"]);
		state.launcher = { pid: launcher.pid, log: launcher.logFile };
		writeState(state);
		state.vaultPath = await waitFor(() => {
			if (!isProcess(launcher.pid, "obsidian-launcher")) throw new Error(`the launcher exited early; see ${launcher.logFile}`);
			return /Vault copied to (.+)/.exec(fs.readFileSync(launcher.logFile, "utf8"))?.[1]?.trim();
		}, 240000, "the launcher to print 'Vault copied to'");
		const child = await waitFor(() => processList().find((p) => p.ppid === launcher.pid && p.command.includes("--user-data-dir=")), 30000, "the sandbox Obsidian process");
		state.configDir = /--user-data-dir=(\S+)/.exec(child.command)?.[1] ?? null;
		state.obsidianPid = child.pid;
		writeState(state);
	} catch (error) {
		await abort(error);
	}

	// 4. Wait for the CLI to reach the sandbox (through the guard) and for the plugin to load, then inject.
	try {
		await waitFor(() => {
			const guard = spawnSync(process.execPath, ["scripts/obsidian-guard.mjs"], { cwd: root, encoding: "utf8" });
			if (guard.status === 0) return true;
			if (guard.status !== EXIT_UNREACHABLE) throw new Error(`the guard refused:\n${guard.stderr}`);
			return false; // Obsidian is still booting; this wait is for startup only, not a retry against another instance.
		}, 60000, "the guard to reach the sandbox");
	} catch (error) {
		await abort(error);
	}
	const inject = spawnSync(process.execPath, ["scripts/dev-inject.mjs"], { cwd: root, stdio: "inherit" });
	console.log(`\nDev loop is up (started ${startedAt}).`);
	console.log(`  sandbox vault : ${state.vaultPath}`);
	console.log(`  captures      : ${capturesFile}`);
	console.log(`  logs          : ${logDir}`);
	console.log("  CLI           : npm run obsidian -- <args>   (always through the guard)");
	console.log("  stop          : npm run devloop:stop");
	if (inject.status !== 0) {
		console.error("\nSettings injection failed (see above). The loop is still up; re-run `npm run devloop:inject` or stop it.");
		process.exit(1);
	}
};

const stop = async () => {
	const state = readState();
	if (!state) {
		console.log("No dev-loop state file; nothing to stop.");
		return;
	}
	// Launcher first, with SIGINT: its cleanup handler kills Obsidian and removes the config dir.
	await stopProcess(state.launcher?.pid, "obsidian-launcher", "SIGINT");
	await stopProcess(state.capture?.pid, "capture-server.mjs");
	await stopProcess(state.esbuild?.pid, "esbuild.config.mjs");
	// Anything of the sandbox Obsidian that outlived the launcher.
	for (const p of loopObsidian({ ...state, launcher: { pid: -1 } })) {
		if (state.configDir && p.command.includes(state.configDir)) killTree(p.pid, "SIGTERM");
	}
	await sleep(1000);
	for (const p of loopObsidian({ ...state, launcher: { pid: -1 } })) {
		if (state.configDir && p.command.includes(state.configDir)) killTree(p.pid, "SIGKILL");
	}
	await sleep(500);

	const left = [
		...obsidianProcesses().filter((p) => state.configDir && p.command.includes(state.configDir)),
		...[["obsidian-launcher", state.launcher], ["capture-server.mjs", state.capture], ["esbuild.config.mjs", state.esbuild]]
			.filter(([marker, piece]) => isProcess(piece?.pid, marker))
			.map(([, piece]) => ({ pid: piece.pid, command: commandOf(piece.pid) })),
	];
	if (left.length > 0) {
		console.error("Some dev-loop processes are still running:");
		left.forEach((p) => console.error(`  ${p.pid} ${p.command.slice(0, 160)}`));
		process.exit(1);
	}
	removeState();
	fs.rmSync(serverUrlFile, { force: true });
	console.log("Dev loop stopped: launcher, sandbox Obsidian, capture server and esbuild are gone.");
};

const status = () => {
	const state = readState();
	if (!state) {
		console.log(`Dev loop is not running (no state file at ${statePath}).`);
		return;
	}
	const pieces = [["launcher", "obsidian-launcher"], ["capture", "capture-server.mjs"], ["esbuild", "esbuild.config.mjs"]];
	for (const [name, marker] of pieces) {
		console.log(`${name.padEnd(9)} pid ${state[name]?.pid ?? "-"} ${isProcess(state[name]?.pid, marker) ? "running" : "NOT running"}`);
	}
	console.log(`sandbox Obsidian pids: ${loopObsidian(state).map((p) => p.pid).join(", ") || "none"}`);
	console.log(`vault copy : ${state.vaultPath}`);
	console.log(`started    : ${state.startedAt}`);
	console.log(`captures   : ${capturesFile}`);
	console.log(`capture url: ${fs.existsSync(serverUrlFile) ? fs.readFileSync(serverUrlFile, "utf8").trim() : "-"}`);
};

const command = process.argv[2];
const commands = { start, stop, status };
if (!commands[command]) {
	console.error("Usage: node scripts/dev-loop.mjs start | stop | status");
	process.exit(2);
}
await commands[command]();
