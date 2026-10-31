// Finds Discord webhook URLs in files, so none ever gets committed. A webhook URL carries its
// secret token in the path, so a committed one is a leaked credential.
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** discord.com or discordapp.com, optional API version, then `/<numeric id>/<token>`. */
const WEBHOOK_URL = /discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([\w-]+)/gi;

/** Obvious placeholder tokens that are fine in documentation. */
const PLACEHOLDER_TOKEN = /^(?:x+|\.+|0+|your|token|placeholder|example|redacted)/i;

/** Put this on a line to allow a deliberate, non-secret example. */
export const ALLOW_MARKER = "webhook-check: allow";

export interface WebhookFinding {
	file: string;
	line: number;
	/** The URL with its token masked, so the check never prints a secret itself. */
	match: string;
}

const mask = (match: string) => match.replace(/\/([\w-]{4})[\w-]*$/, "/$1…");

export const findWebhookUrls = (text: string, file = "<text>"): WebhookFinding[] => {
	const findings: WebhookFinding[] = [];
	text.split(/\r?\n/).forEach((lineText, index) => {
		if (lineText.includes(ALLOW_MARKER)) return;
		WEBHOOK_URL.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = WEBHOOK_URL.exec(lineText)) !== null) {
			if (PLACEHOLDER_TOKEN.test(match[2])) continue;
			findings.push({ file, line: index + 1, match: mask(match[0]) });
		}
	});
	return findings;
};

/** Files git tracks, plus untracked files that are not ignored (so a new file is checked before `git add`). */
export const listRepositoryFiles = (root: string): string[] =>
	execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
		cwd: root,
		maxBuffer: 64 * 1024 * 1024,
	})
		.toString("utf8")
		.split("\0")
		.filter(Boolean);

export const scanRepository = (root: string): WebhookFinding[] => {
	const findings: WebhookFinding[] = [];
	listRepositoryFiles(root).forEach((relative) => {
		const absolute = path.join(root, relative);
		let content: Buffer;
		try {
			content = fs.readFileSync(absolute);
		} catch {
			return; // listed but deleted in the working tree
		}
		if (content.slice(0, 8000).includes(0)) return; // binary
		findings.push(...findWebhookUrls(content.toString("utf8"), relative));
	});
	return findings;
};
