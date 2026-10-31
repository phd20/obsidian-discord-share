import { buildMultipart } from "./multipart";
import { parseMultipart } from "../../test/support/captureServer";

const textDecoder = new TextDecoder();
const asText = (buffer: ArrayBuffer) => Buffer.from(buffer).toString("latin1");
const parse = (result: { body: ArrayBuffer; boundary: string }) =>
	parseMultipart(Buffer.from(result.body), result.boundary);

// Every byte value, with CR LF pairs, NULs and a stray boundary-like prefix.
const allBytes = (): Uint8Array => {
	const bytes: number[] = [];
	for (let i = 0; i < 256; i++) bytes.push(i);
	return new Uint8Array([...bytes, 0x00, 0x0d, 0x0a, 0x0d, 0x0a, 0x2d, 0x2d, ...bytes.reverse()]);
};

describe("buildMultipart", () => {
	describe("structure", () => {
		const payload = { username: "Obsidian Share" };
		const result = buildMultipart(payload, [{ filename: "a.txt", data: new TextEncoder().encode("hello"), contentType: "text/plain" }]);
		const text = asText(result.body);
		const delimiter = `--${result.boundary}`;

		it("returns an ArrayBuffer and a matching content type", () => {
			expect(result.body).toBeInstanceOf(ArrayBuffer);
			expect(result.contentType).toBe(`multipart/form-data; boundary=${result.boundary}`);
			expect(result.boundary).toMatch(/^[A-Za-z0-9-]{1,70}$/);
		});

		it("lays out parts with CRLFs exactly per RFC 7578", () => {
			expect(text).toBe(
				`${delimiter}\r\n` +
					`Content-Disposition: form-data; name="files[0]"; filename="a.txt"\r\n` +
					`Content-Type: text/plain\r\n` +
					`\r\n` +
					`hello\r\n` +
					`${delimiter}\r\n` +
					`Content-Disposition: form-data; name="payload_json"\r\n` +
					`Content-Type: application/json\r\n` +
					`\r\n` +
					`${JSON.stringify(payload)}\r\n` +
					`${delimiter}--\r\n`,
			);
		});

		it("ends with the closing boundary and a final CRLF", () => {
			expect(text.endsWith(`\r\n${delimiter}--\r\n`)).toBe(true);
		});

		it("has no bare LF anywhere in the framing", () => {
			const framing = text.replace(/hello/, "").replace(JSON.stringify(payload), "");
			expect(framing.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
		});

		it("sends a string payload as is", () => {
			const raw = '{"username":"x"}';
			const parts = parse(buildMultipart(raw));
			expect(parts).toHaveLength(1);
			expect(parts[0].text).toBe(raw);
		});

		it("defaults the content type to application/octet-stream", () => {
			const parts = parse(buildMultipart({}, [{ filename: "b.bin", data: new Uint8Array([1]) }]));
			expect(parts[0].contentType).toBe("application/octet-stream");
		});

		it("builds a body with only the JSON part when there are no files", () => {
			const parts = parse(buildMultipart({ a: 1 }));
			expect(parts.map((part) => part.name)).toEqual(["payload_json"]);
			expect(parts[0].json).toEqual({ a: 1 });
		});

		it("uses a different boundary on every call", () => {
			const boundaries = new Set<string>();
			for (let i = 0; i < 50; i++) boundaries.add(buildMultipart({}).boundary);
			expect(boundaries.size).toBe(50);
		});
	});

	describe("round trip through the capture server's parser", () => {
		it("preserves JSON and text parts", () => {
			const payload = { username: "Obsidian Share", embeds: [{ title: "héllo ✓ \"quoted\"", description: "line1\r\nline2" }] };
			const parts = parse(buildMultipart(payload, [{ filename: "n.md", data: new TextEncoder().encode("# Title\r\n\r\nbody ✓"), contentType: "text/markdown" }]));
			expect(parts.map((part) => part.name)).toEqual(["files[0]", "payload_json"]);
			expect(parts[0].filename).toBe("n.md");
			expect(parts[0].contentType).toBe("text/markdown");
			expect(Buffer.from(parts[0].bytes).toString("utf8")).toBe("# Title\r\n\r\nbody ✓");
			expect(parts[1].contentType).toBe("application/json");
			expect(parts[1].json).toEqual(payload);
		});

		it("passes binary bytes through untouched", () => {
			const data = allBytes();
			const parts = parse(buildMultipart({}, [{ filename: "all.bin", data }]));
			expect(parts[0].size).toBe(data.length);
			expect(Buffer.compare(parts[0].bytes, Buffer.from(data))).toBe(0);
		});

		it("accepts ArrayBuffer input and honours a Uint8Array view's offset and length", () => {
			const backing = new Uint8Array([9, 9, 1, 2, 3, 9, 9]);
			const view = backing.subarray(2, 5);
			const fromView = parse(buildMultipart({}, [{ filename: "v.bin", data: view }]));
			expect(Array.from(fromView[0].bytes)).toEqual([1, 2, 3]);
			const fromBuffer = parse(buildMultipart({}, [{ filename: "b.bin", data: backing.buffer }]));
			expect(Array.from(fromBuffer[0].bytes)).toEqual([9, 9, 1, 2, 3, 9, 9]);
		});

		it("round-trips an empty file", () => {
			const parts = parse(buildMultipart({ a: 1 }, [{ filename: "empty.txt", data: new ArrayBuffer(0) }]));
			expect(parts[0].filename).toBe("empty.txt");
			expect(parts[0].size).toBe(0);
			expect(parts[1].json).toEqual({ a: 1 });
		});

		it("round-trips several files in order, named files[0], files[1], ...", () => {
			const files = [
				{ filename: "one.png", data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), contentType: "image/png" },
				{ filename: "two.txt", data: new TextEncoder().encode("two"), contentType: "text/plain" },
				{ filename: "three", data: new Uint8Array([0, 13, 10, 0]) },
			];
			const parts = parse(buildMultipart({ x: true }, files));
			expect(parts.map((part) => part.name)).toEqual(["files[0]", "files[1]", "files[2]", "payload_json"]);
			files.forEach((file, index) => {
				expect(parts[index].filename).toBe(file.filename);
				expect(Array.from(parts[index].bytes)).toEqual(Array.from(file.data));
			});
			expect(parts[2].contentType).toBe("application/octet-stream");
		});

		it("round-trips a 1 MB file quickly", () => {
			const data = new Uint8Array(1024 * 1024);
			for (let i = 0; i < data.length; i++) data[i] = (i * 31 + (i >> 8)) & 0xff;
			const start = Date.now();
			const result = buildMultipart({}, [{ filename: "big.bin", data }]);
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(1000);
			expect(result.body.byteLength).toBeGreaterThan(data.length);
			const parts = parse(result);
			expect(Buffer.compare(parts[0].bytes, Buffer.from(data))).toBe(0);
		});
	});

	describe("Content-Disposition quoting", () => {
		const filenameOf = (filename: string) => {
			const result = buildMultipart({}, [{ filename, data: new Uint8Array([1]) }]);
			return { parts: parse(result), text: asText(result.body) };
		};

		it("escapes double quotes and backslashes", () => {
			const { parts, text } = filenameOf('we"ird\\name.png');
			expect(text).toContain('filename="we\\"ird\\\\name.png"');
			expect(parts[0].filename).toBe('we"ird\\name.png');
		});

		it("keeps CR and LF out of the header", () => {
			const { parts, text } = filenameOf("a\r\nContent-Type: evil\r\nb.png");
			expect(parts[0].filename).toBe("a\r\nContent-Type: evil\r\nb.png");
			expect(parts[0].headers["content-type"]).toBe("application/octet-stream");
			expect(text).toContain('filename="a%0D%0AContent-Type: evil%0D%0Ab.png"');
		});

		it("sends a non-ASCII filename as UTF-8 inside the quotes", () => {
			const name = "日本語 café ✓.png";
			const result = buildMultipart({}, [{ filename: name, data: new Uint8Array([1]) }]);
			expect(Buffer.from(result.body).includes(Buffer.from(`filename="${name}"`, "utf8"))).toBe(true);
			expect(parse(result)[0].filename).toBe(name);
		});

		it("strips line breaks from a content type", () => {
			const result = buildMultipart({}, [{ filename: "a", data: new Uint8Array([1]), contentType: "text/plain\r\nX-Evil: 1" }]);
			expect(parse(result)[0].headers["x-evil"]).toBeUndefined();
		});
	});

	describe("boundary", () => {
		// Boundary suffix characters come from the random bytes, so 0 maps to "A", 1 to "B", ...
		const fixed = (value: number) => () => new Uint8Array(24).fill(value);

		it("uses the injected random source", () => {
			const a = buildMultipart({}, [], { random: fixed(0) });
			expect(a.boundary).toBe("----ObsidianDiscordShare" + "A".repeat(24));
		});

		it("regenerates the boundary when it occurs in a file", () => {
			const colliding = "----ObsidianDiscordShare" + "A".repeat(24);
			const data = new TextEncoder().encode(`prefix\r\n--${colliding}\r\nsuffix`);
			const calls: number[] = [];
			const random = (length: number) => {
				calls.push(calls.length);
				return new Uint8Array(length).fill(calls.length === 1 ? 0 : 1);
			};
			const result = buildMultipart({}, [{ filename: "c.bin", data }], { random });
			expect(calls).toHaveLength(2);
			expect(result.boundary).toBe("----ObsidianDiscordShare" + "B".repeat(24));
			const parts = parse(result);
			expect(Buffer.compare(parts[0].bytes, Buffer.from(data))).toBe(0);
		});

		it("regenerates the boundary when it occurs in the JSON part or a filename", () => {
			const colliding = "----ObsidianDiscordShare" + "A".repeat(24);
			let calls = 0;
			const random = (length: number) => new Uint8Array(length).fill(calls++ < 2 ? 0 : 2);
			const result = buildMultipart({ text: `--${colliding}` }, [{ filename: `--${colliding}.bin`, data: new Uint8Array(0) }], { random });
			expect(result.boundary).toBe("----ObsidianDiscordShare" + "C".repeat(24));
			expect(parse(result)[1].json).toEqual({ text: `--${colliding}` });
		});

		it("finds a boundary at the very end of a file", () => {
			const colliding = "----ObsidianDiscordShare" + "A".repeat(24);
			const data = new TextEncoder().encode(`--${colliding}`);
			let calls = 0;
			const random = (length: number) => new Uint8Array(length).fill(calls++ === 0 ? 0 : 3);
			const result = buildMultipart({}, [{ filename: "e", data }], { random });
			expect(result.boundary).toBe("----ObsidianDiscordShare" + "D".repeat(24));
		});

		it("gives up when every candidate collides", () => {
			const colliding = "----ObsidianDiscordShare" + "A".repeat(24);
			const data = new TextEncoder().encode(`--${colliding}`);
			expect(() => buildMultipart({}, [{ filename: "x", data }], { random: fixed(0) })).toThrow(/boundary/);
		});

		it("does not occur in the body outside the delimiters", () => {
			const result = buildMultipart({ a: 1 }, [{ filename: "all.bin", data: allBytes() }]);
			const body = Buffer.from(result.body);
			const delimiter = Buffer.from(`--${result.boundary}`);
			let count = 0;
			for (let at = body.indexOf(delimiter); at !== -1; at = body.indexOf(delimiter, at + 1)) count++;
			expect(count).toBe(3); // two part openers and the closing delimiter
		});
	});

	it("decodes the JSON payload as UTF-8", () => {
		const result = buildMultipart({ username: "Zoë ✓" });
		const part = parse(result)[0];
		expect(textDecoder.decode(part.bytes)).toBe('{"username":"Zoë ✓"}');
	});
});
