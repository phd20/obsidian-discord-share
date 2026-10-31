// Hand-built multipart/form-data bodies for Obsidian's requestUrl, which takes an ArrayBuffer
// and does not accept FormData. No Obsidian imports, so Jest can test it.

export interface MultipartFile {
	filename: string;
	data: ArrayBuffer | ArrayBufferView;
	/** Defaults to application/octet-stream, like a Blob without a type. */
	contentType?: string;
}

export interface MultipartOptions {
	/** Source of random bytes for the boundary. Defaults to crypto.getRandomValues, else Math.random. */
	random?: (length: number) => Uint8Array;
}

export interface MultipartBody {
	body: ArrayBuffer;
	boundary: string;
	/** `multipart/form-data; boundary=...`, for requestUrl's `contentType`. */
	contentType: string;
}

const BOUNDARY_PREFIX = "----ObsidianDiscordShare";
const BOUNDARY_RANDOM_LENGTH = 24;
const BOUNDARY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX_BOUNDARY_ATTEMPTS = 100;

const defaultRandom = (length: number): Uint8Array => {
	const bytes = new Uint8Array(length);
	const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
	if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
		cryptoApi.getRandomValues(bytes);
	} else {
		for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	return bytes;
};

const generateBoundary = (random: (length: number) => Uint8Array): string => {
	const bytes = random(BOUNDARY_RANDOM_LENGTH);
	let suffix = "";
	for (let i = 0; i < BOUNDARY_RANDOM_LENGTH; i++) {
		suffix += BOUNDARY_CHARS.charAt(bytes[i] % BOUNDARY_CHARS.length);
	}
	return BOUNDARY_PREFIX + suffix;
};

const textEncoder = new TextEncoder();

/**
 * A quoted-string for a Content-Disposition parameter. Quotes and backslashes are backslash-escaped;
 * CR and LF are percent-encoded (the way browsers do), since a raw line break would end the header.
 * Non-ASCII text is left as-is and sent as UTF-8.
 */
const quote = (value: string): string =>
	`"${value.replace(/[\\"]/g, "\\$&").replace(/\r/g, "%0D").replace(/\n/g, "%0A")}"`;

const toBytes = (data: ArrayBuffer | ArrayBufferView): Uint8Array =>
	ArrayBuffer.isView(data)
		? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
		: new Uint8Array(data);

/** True when `needle` occurs anywhere in `haystack`. */
const contains = (haystack: Uint8Array, needle: Uint8Array): boolean => {
	const first = needle[0];
	const last = haystack.length - needle.length;
	let from = haystack.indexOf(first);
	while (from !== -1 && from <= last) {
		let matched = true;
		for (let i = 1; i < needle.length; i++) {
			if (haystack[from + i] !== needle[i]) {
				matched = false;
				break;
			}
		}
		if (matched) return true;
		from = haystack.indexOf(first, from + 1);
	}
	return false;
};

/**
 * Builds a multipart/form-data body with the file parts (`files[0]`, `files[1]`, ...) first and
 * `payload_json` last, the order the plugin's FormData used. `payloadJson` is sent as is when it is
 * a string, else JSON.stringify'd.
 */
export const buildMultipart = (
	payloadJson: unknown,
	files: MultipartFile[] = [],
	options: MultipartOptions = {},
): MultipartBody => {
	const random = options.random || defaultRandom;

	// Header and content of every part. Headers do not depend on the boundary.
	const parts: Array<{ head: Uint8Array; content: Uint8Array }> = files.map((file, index) => {
		const type = (file.contentType || "application/octet-stream").replace(/[\r\n]/g, "");
		return {
			head: textEncoder.encode(
				`Content-Disposition: form-data; name=${quote(`files[${index}]`)}; filename=${quote(file.filename)}\r\n` +
					`Content-Type: ${type}\r\n\r\n`,
			),
			content: toBytes(file.data),
		};
	});
	parts.push({
		head: textEncoder.encode(
			`Content-Disposition: form-data; name=${quote("payload_json")}\r\nContent-Type: application/json\r\n\r\n`,
		),
		content: textEncoder.encode(typeof payloadJson === "string" ? payloadJson : JSON.stringify(payloadJson)),
	});

	// The boundary must not occur in anything the parser would scan. The delimiter holds no CR or LF,
	// so it cannot straddle the CRLFs this function adds between chunks.
	let boundary = "";
	let delimiter: Uint8Array = new Uint8Array(0);
	for (let attempt = 0; ; attempt++) {
		if (attempt >= MAX_BOUNDARY_ATTEMPTS) {
			throw new Error("Could not find a multipart boundary that is absent from the content");
		}
		boundary = generateBoundary(random);
		delimiter = textEncoder.encode(`--${boundary}`);
		const taken = parts.some((part) => contains(part.head, delimiter) || contains(part.content, delimiter));
		if (!taken) break;
	}

	const crlf = textEncoder.encode("\r\n");
	const chunks: Uint8Array[] = [];
	parts.forEach((part) => {
		chunks.push(delimiter, crlf, part.head, part.content, crlf);
	});
	chunks.push(delimiter, textEncoder.encode("--\r\n"));

	let total = 0;
	chunks.forEach((chunk) => (total += chunk.length));
	const out = new Uint8Array(total);
	let offset = 0;
	chunks.forEach((chunk) => {
		out.set(chunk, offset);
		offset += chunk.length;
	});

	return { body: out.buffer, boundary, contentType: `multipart/form-data; boundary=${boundary}` };
};
