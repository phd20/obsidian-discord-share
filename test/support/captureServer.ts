// Webhook capture server for the e2e harness and the Claude dev loop.
//
// A local HTTP server standing in for Discord: it records every request the plugin sends and
// replies with a configurable status/body. Node built-ins only, and only syntax Node can run
// directly by stripping types, so scripts/capture-server.mjs can import this file as-is.
import * as http from "http";
import * as crypto from "crypto";
import type { AddressInfo } from "net";

export interface CapturedPart {
	name: string;
	filename?: string;
	contentType?: string;
	headers: Record<string, string>;
	size: number;
	bytes: Buffer;
	/** Decoded text, only for parts without a filename. */
	text?: string;
	/** Parsed JSON, only when the part is `payload_json`. */
	json?: unknown;
}

export interface CapturedRequest {
	id: number;
	timestamp: string;
	method: string;
	/** Request path without the query string. */
	path: string;
	query: string;
	headers: Record<string, string | string[] | undefined>;
	rawBody: Buffer;
	/** Parsed body when the content type is JSON. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	json?: any;
	/** Parsed parts when the content type is multipart/form-data. */
	parts?: CapturedPart[];
	/** The parsed `payload_json` part of a multipart request. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payloadJson?: any;
	/** Set when the body claimed a format but could not be parsed. */
	parseError?: string;
	responseStatus: number;
}

export interface ResponseConfig {
	status: number;
	/** Strings are sent as-is, other values as JSON. */
	body?: unknown;
	headers?: Record<string, string>;
}

export interface CaptureServerOptions {
	/** Defaults to 127.0.0.1. */
	host?: string;
	/** Defaults to 0 (ephemeral). */
	port?: number;
	/** Default response for every path. Defaults to 204, like a Discord webhook. */
	response?: Partial<ResponseConfig>;
	/** Answer CORS preflight and add CORS headers. Defaults to true. */
	cors?: boolean;
	/** Called after each recorded (non-preflight) request. */
	onCapture?: (request: CapturedRequest) => void;
}

export interface CaptureServer {
	/** Base URL, e.g. http://127.0.0.1:54321 (no trailing slash). */
	url: string;
	port: number;
	/** Recorded POST/PUT/etc. requests in arrival order. Preflights are not included. */
	requests: CapturedRequest[];
	/** Recorded OPTIONS requests. */
	preflights: CapturedRequest[];
	/** Full URL for a path, e.g. urlFor("/api/webhooks/1/a") -> http://127.0.0.1:54321/api/webhooks/1/a. */
	urlFor: (path: string) => string;
	/** Change the response for all paths, or for one path when `path` is given. */
	setResponse: (status: number, body?: unknown, path?: string) => void;
	/** Switch CORS handling at runtime. When off: no CORS headers anywhere and OPTIONS gets 405. */
	setCors: (enabled: boolean) => void;
	/** Clear recorded requests and restore default responses (CORS setting is kept). */
	reset: () => void;
	/** Resolve once `count` requests (default 1) have been recorded. Rejects after `timeoutMs` (default 5000). */
	waitForRequests: (count?: number, timeoutMs?: number) => Promise<CapturedRequest[]>;
	close: () => Promise<void>;
}

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "*",
	"Access-Control-Max-Age": "600",
};

const unquote = (value: string): string =>
	value
		.replace(/%22/g, '"')
		.replace(/%0D/gi, "\r")
		.replace(/%0A/gi, "\n")
		.replace(/\\(.)/g, "$1");

/** Reads `name="value"` pairs from a header value such as Content-Disposition. */
const parseHeaderParams = (value: string): Record<string, string> => {
	const params: Record<string, string> = {};
	const pattern = /;\s*([^=;\s]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]*))/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(value)) !== null) {
		params[match[1].toLowerCase()] = match[2] !== undefined ? unquote(match[2]) : match[3];
	}
	return params;
};

export const getBoundary = (contentType: string | undefined): string | undefined => {
	if (!contentType) return undefined;
	return parseHeaderParams(contentType)["boundary"];
};

/** Parses a multipart/form-data body. Throws when the body does not start with the boundary. */
export const parseMultipart = (body: Buffer, boundary: string): CapturedPart[] => {
	const delimiter = Buffer.from(`--${boundary}`);
	const headerEnd = Buffer.from("\r\n\r\n");
	const parts: CapturedPart[] = [];

	let position = body.indexOf(delimiter);
	if (position === -1) throw new Error("multipart boundary not found in body");

	while (position !== -1) {
		let start = position + delimiter.length;
		// `--` right after a delimiter marks the end of the body.
		if (body.slice(start, start + 2).toString("latin1") === "--") break;
		if (body.slice(start, start + 2).toString("latin1") !== "\r\n") {
			throw new Error("malformed multipart delimiter");
		}
		start += 2;

		// The next delimiter is preceded by a CRLF that belongs to the delimiter, not the part.
		const next = body.indexOf(Buffer.concat([Buffer.from("\r\n"), delimiter]), start);
		if (next === -1) throw new Error("unterminated multipart part");

		const partBytes = body.slice(start, next);
		const split = partBytes.indexOf(headerEnd);
		let headerBlock: string;
		let content: Buffer;
		if (partBytes.slice(0, 2).toString("latin1") === "\r\n") {
			// A part with no headers at all.
			headerBlock = "";
			content = partBytes.slice(2);
		} else if (split === -1) {
			throw new Error("multipart part has no header terminator");
		} else {
			headerBlock = partBytes.slice(0, split).toString("utf8");
			content = partBytes.slice(split + headerEnd.length);
		}

		const headers: Record<string, string> = {};
		headerBlock.split("\r\n").forEach((line) => {
			const colon = line.indexOf(":");
			if (colon > 0) headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
		});
		const disposition = parseHeaderParams(headers["content-disposition"] || "");

		const part: CapturedPart = {
			name: disposition["name"] || "",
			filename: disposition["filename"],
			contentType: headers["content-type"],
			headers,
			size: content.length,
			bytes: content,
		};
		if (part.filename === undefined) part.text = content.toString("utf8");
		if (part.name === "payload_json") part.json = JSON.parse(content.toString("utf8"));
		parts.push(part);

		position = next + 2; // skip the CRLF that precedes the next delimiter
	}
	return parts;
};

/** Fills in the parsed fields of a request from its content type and raw body. */
const parseBody = (request: CapturedRequest) => {
	const contentType = String(request.headers["content-type"] || "");
	if (request.rawBody.length === 0) return;
	try {
		if (/^application\/(?:[\w.+-]+\+)?json/i.test(contentType)) {
			request.json = JSON.parse(request.rawBody.toString("utf8"));
		} else if (/^multipart\/form-data/i.test(contentType)) {
			const boundary = getBoundary(contentType);
			if (!boundary) throw new Error("multipart content type without boundary");
			request.parts = parseMultipart(request.rawBody, boundary);
			const payload = request.parts.find((part) => part.name === "payload_json");
			if (payload) request.payloadJson = payload.json;
		}
	} catch (error) {
		request.parseError = error instanceof Error ? error.message : String(error);
	}
};

/** The JSON-safe form of a capture: part bytes are replaced by size and sha256. */
export const serializeCapture = (request: CapturedRequest) => {
	const { rawBody, parts, ...rest } = request;
	return {
		...rest,
		bodySize: rawBody.length,
		bodySha256: crypto.createHash("sha256").update(rawBody).digest("hex"),
		parts: parts
			? parts.map(({ bytes, ...part }) => ({
				...part,
				sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
			}))
			: undefined,
	};
};

const readBody = (req: http.IncomingMessage): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});

export const startCaptureServer = async (options: CaptureServerOptions = {}): Promise<CaptureServer> => {
	const host = options.host || "127.0.0.1";
	let corsEnabled = options.cors !== false;
	const defaultResponse = (): ResponseConfig => ({ status: 204, ...options.response });
	let fallback = defaultResponse();
	const perPath: Record<string, ResponseConfig> = {};

	const requests: CapturedRequest[] = [];
	const preflights: CapturedRequest[] = [];
	const waiters: Array<{ count: number; resolve: (r: CapturedRequest[]) => void }> = [];
	let nextId = 1;

	const settle = () => {
		for (let i = waiters.length - 1; i >= 0; i--) {
			if (requests.length >= waiters[i].count) {
				const [waiter] = waiters.splice(i, 1);
				waiter.resolve(requests.slice());
			}
		}
	};

	const server = http.createServer(async (req, res) => {
		const target = new URL(req.url || "/", "http://capture.invalid");
		const record: CapturedRequest = {
			id: nextId++,
			timestamp: new Date().toISOString(),
			method: req.method || "GET",
			path: target.pathname,
			query: target.search.replace(/^\?/, ""),
			headers: req.headers,
			rawBody: await readBody(req),
			responseStatus: 0,
		};

		if (record.method === "OPTIONS") {
			record.responseStatus = corsEnabled ? 204 : 405;
			preflights.push(record);
			res.writeHead(record.responseStatus, corsEnabled ? CORS_HEADERS : {});
			res.end();
			return;
		}

		parseBody(record);
		const config = perPath[record.path] || fallback;
		record.responseStatus = config.status;
		requests.push(record);

		const headers: Record<string, string> = corsEnabled ? { ...CORS_HEADERS } : {};
		let payload: string | undefined;
		if (config.body !== undefined) {
			if (typeof config.body === "string") {
				payload = config.body;
			} else {
				payload = JSON.stringify(config.body);
				headers["Content-Type"] = "application/json";
			}
		}
		Object.assign(headers, config.headers);
		res.writeHead(config.status, headers);
		// 204/304 responses must not carry a body.
		res.end(config.status === 204 || config.status === 304 ? undefined : payload);

		if (options.onCapture) options.onCapture(record);
		settle();
	});

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(options.port || 0, host, () => resolve());
	});
	const port = (server.address() as AddressInfo).port;
	const url = `http://${host}:${port}`;

	return {
		url,
		port,
		requests,
		preflights,
		urlFor: (path) => `${url}${path.startsWith("/") ? "" : "/"}${path}`,
		setResponse: (status, body, path) => {
			if (path) perPath[path] = { status, body };
			else fallback = { status, body };
		},
		setCors: (enabled) => {
			corsEnabled = enabled;
		},
		reset: () => {
			requests.length = 0;
			preflights.length = 0;
			fallback = defaultResponse();
			Object.keys(perPath).forEach((key) => delete perPath[key]);
		},
		waitForRequests: (count = 1, timeoutMs = 5000) =>
			new Promise((resolve, reject) => {
				if (requests.length >= count) return resolve(requests.slice());
				const waiter = { count, resolve: (r: CapturedRequest[]) => { clearTimeout(timer); resolve(r); } };
				const timer = setTimeout(() => {
					waiters.splice(waiters.indexOf(waiter), 1);
					reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${count} request(s); got ${requests.length}`));
				}, timeoutMs);
				waiters.push(waiter);
			}),
		close: () =>
			new Promise<void>((resolve) => {
				server.close(() => resolve());
				// Drop keep-alive connections so close() does not hang.
				(server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.();
			}),
	};
};
