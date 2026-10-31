// Shared helpers for the Claude dev loop (scripts/dev-loop.mjs, obsidian-guard.mjs, dev-inject.mjs).
// Node built-ins only. Tested on macOS; Linux and Windows paths are best-effort.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const captureDir = path.join(root, "test", ".captures");
export const logDir = path.join(captureDir, "dev-loop");
export const capturesFile = path.join(captureDir, "captures.jsonl");
export const serverUrlFile = path.join(captureDir, "server-url.txt");
export const screenshotDir = path.join(captureDir, "screenshots");
// The env override exists so the refusal paths can be exercised against a fake state file.
export const statePath = process.env.OBSIDIAN_DEVLOOP_STATE
	? path.resolve(process.env.OBSIDIAN_DEVLOOP_STATE)
	: path.join(captureDir, "dev-loop.json");

export const PLUGIN_ID = "obsidian-discord-share";
export const MIN_CLI_INSTALLER = "1.12.7";

/** Exit codes of the guard: 3 = connected to something that is not the sandbox, 4 = nothing usable answered. */
export const EXIT_REFUSED = 3;
export const EXIT_UNREACHABLE = 4;

export const readState = () => {
	try {
		return JSON.parse(fs.readFileSync(statePath, "utf8"));
	} catch {
		return undefined;
	}
};

export const writeState = (state) => {
	fs.mkdirSync(path.dirname(statePath), { recursive: true });
	fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
};

export const removeState = () => fs.rmSync(statePath, { force: true });

/** All processes as {pid, ppid, command}. */
export const processList = () => {
	if (process.platform === "win32") {
		const csv = execFileSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf8" });
		return csv.split(/\r?\n/).filter(Boolean).map((line) => {
			const [name, pid] = line.replace(/^"|"$/g, "").split('","');
			return { pid: Number(pid), ppid: 0, command: name };
		});
	}
	const out = execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	return out.split("\n").flatMap((line) => {
		const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
		return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }] : [];
	});
};

export const commandOf = (pid) => processList().find((p) => p.pid === pid)?.command;

/** Whether `pid` is a live process whose command line contains `marker` (guards against pid reuse). */
export const isProcess = (pid, marker) => {
	if (!pid) return false;
	const command = commandOf(pid);
	return command !== undefined && command.includes(marker);
};

/** Every Obsidian process on the machine (same match as `pgrep -f Obsidian`), except this process and its ancestors. */
export const obsidianProcesses = () => {
	const all = processList();
	// A shell whose command line merely mentions "Obsidian" (e.g. `pgrep -fl Obsidian`) is not an instance.
	const self = new Set();
	for (let pid = process.pid; pid && !self.has(pid); pid = all.find((p) => p.pid === pid)?.ppid) self.add(pid);
	return all.filter((p) => !self.has(p.pid) && p.command.includes("Obsidian"));
};

const semverParts = (version) => version.split(".").map(Number);
export const compareVersions = (a, b) => {
	const [x, y] = [semverParts(a), semverParts(b)];
	for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
	return 0;
};

/**
 * The `obsidian-cli` binary of the newest installer in the launcher cache that is new enough to have one.
 * It is not on PATH in a sandbox. Returns undefined when none is found.
 */
export const resolveCli = () => {
	const cache = process.env.OBSIDIAN_CACHE ? path.resolve(process.env.OBSIDIAN_CACHE) : path.join(os.homedir(), ".obsidian-cache");
	const installers = path.join(cache, "obsidian-installer", `${process.platform}-${process.arch}`);
	let entries;
	try {
		entries = fs.readdirSync(installers);
	} catch {
		return undefined;
	}
	const versions = entries
		.map((name) => ({ name, version: /^Obsidian-(\d+\.\d+\.\d+)$/.exec(name)?.[1] }))
		.filter((entry) => entry.version && compareVersions(entry.version, MIN_CLI_INSTALLER) >= 0)
		.sort((a, b) => compareVersions(b.version, a.version));
	const binaries = ["obsidian-cli", "obsidian-cli.exe", "Obsidian.com"];
	for (const { name } of versions) {
		const dir = path.join(installers, name);
		const candidates = [path.join(dir, "Contents", "MacOS"), dir, path.join(dir, "resources")];
		for (const candidate of candidates) {
			for (const binary of binaries) {
				const file = path.join(candidate, binary);
				if (fs.existsSync(file)) return file;
			}
		}
	}
	return undefined;
};

/** The obsidian-launcher CLI script, found through the wdio service that depends on it (pnpm or npm layout). */
export const resolveLauncher = () => {
	const candidates = [path.join(root, "node_modules", "obsidian-launcher", "dist", "cli.js")];
	try {
		const service = fs.realpathSync(path.join(root, "node_modules", "wdio-obsidian-service"));
		candidates.push(
			path.join(path.dirname(service), "obsidian-launcher", "dist", "cli.js"), // pnpm: sibling in the virtual store
			path.join(service, "node_modules", "obsidian-launcher", "dist", "cli.js"), // npm: nested
		);
	} catch {
		// wdio-obsidian-service is not installed
	}
	return candidates.find((file) => fs.existsSync(file));
};

/** Resolves symlinks (macOS /var -> /private/var) so two spellings of one directory compare equal. */
export const canonicalPath = (p) => {
	try {
		return fs.realpathSync(p);
	} catch {
		return path.resolve(p);
	}
};
