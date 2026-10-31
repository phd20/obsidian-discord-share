// Environment for the optional live Discord check. Dependency-free on purpose: wdio.conf.mts imports it.
import * as fs from "fs";
import { installOutputRedaction, registerSecret, redactError } from "./redact";

export const LIVE_ENV_VAR = "DISCORD_TEST_WEBHOOK_URL";

/** Parses KEY=value lines (optional `export`, quotes and `#` comments). Does not expand variables. */
export const parseEnvFile = (text: string): Record<string, string> => {
	const values: Record<string, string> = {};
	text.split(/\r?\n/).forEach((line) => {
		const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
		if (!match) return;
		let value = match[2];
		const quote = value[0];
		if ((quote === '"' || quote === "'") && value.lastIndexOf(quote) > 0) {
			value = value.slice(1, value.lastIndexOf(quote));
		} else {
			value = value.replace(/\s+#.*$/, "");
		}
		values[match[1]] = value;
	});
	return values;
};

/** Loads `file` into process.env when it exists. Variables already set in the environment win. */
export const loadEnvFile = (file: string, env: NodeJS.ProcessEnv = process.env): void => {
	let text: string;
	try {
		text = fs.readFileSync(file, "utf8");
	} catch {
		return; // no .env.test: the live check is simply skipped
	}
	Object.entries(parseEnvFile(text)).forEach(([key, value]) => {
		if (env[key] === undefined) env[key] = value;
	});
};

/** The configured live webhook URL, or undefined when unset or blank. */
export const getLiveWebhookUrl = (env: NodeJS.ProcessEnv = process.env): string | undefined => {
	const value = (env[LIVE_ENV_VAR] ?? "").trim();
	return value || undefined;
};

/**
 * Called from wdio.conf.mts (launcher and workers): loads `.env.test`, registers the live URL with
 * the redactor and masks it in everything written to stdout/stderr.
 */
export const setUpLiveEnv = (envFile: string): void => {
	loadEnvFile(envFile);
	registerSecret(getLiveWebhookUrl());
	installOutputRedaction();
};

/** Runs `fn`; anything it throws is rethrown with webhook URLs redacted from message and stack. */
export const redacted = async <T>(fn: () => Promise<T> | T): Promise<T> => {
	try {
		return await fn();
	} catch (error) {
		throw redactError(error);
	}
};
