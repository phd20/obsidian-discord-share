import * as fs from "fs";
import * as path from "path";

/** Discord rejects webhook attachments above this size; the plugin shows an 8MB notice on 413. */
export const DISCORD_ATTACHMENT_LIMIT_BYTES = 8 * 1024 * 1024;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * A buffer that starts with a PNG signature and is `bytes` long (default: one byte over the limit).
 * It is not a decodable image; it only needs to be a file of the right size and extension.
 * Generated on demand so no large binary is committed.
 */
export const createOversizedPng = (bytes: number = DISCORD_ATTACHMENT_LIMIT_BYTES + 1): Buffer => {
	const buffer = Buffer.alloc(bytes);
	Buffer.from(PNG_SIGNATURE).copy(buffer);
	return buffer;
};

/** Writes the oversized file into a directory (e.g. a copy of the fixture vault) and returns its path. */
export const writeOversizedPng = (directory: string, name = "big.png", bytes?: number): string => {
	const target = path.join(directory, name);
	fs.writeFileSync(target, createOversizedPng(bytes));
	return target;
};
