import * as fs from "fs";
import * as path from "path";
import { CaptureServer, parseMultipart, serializeCapture, startCaptureServer } from "./captureServer";

const vault = path.join(__dirname, "..", "vaults", "basic");
const nestedPng = fs.readFileSync(path.join(vault, "img", "nested", "b.png"));
const rootPng = fs.readFileSync(path.join(vault, "attachments", "b.png"));

// Same as the plugin: a Blob without a type is sent as application/octet-stream.
const blobOf = (data: Buffer) => new Blob([new Uint8Array(data)]);

// Every webhook path in these tests is built at runtime from the server's URL.
const hookPath = (name: string) => `/hooks/${name}`;

const multipartBody = (boundary: string, parts: Array<{ name: string; filename?: string; type?: string; data: Buffer | string }>) => {
	const chunks: Buffer[] = [];
	parts.forEach((part) => {
		let head = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
		if (part.filename) head += `; filename="${part.filename.replace(/"/g, '\\"')}"`;
		head += "\r\n";
		if (part.type) head += `Content-Type: ${part.type}\r\n`;
		chunks.push(Buffer.from(`${head}\r\n`), Buffer.from(part.data), Buffer.from("\r\n"));
	});
	chunks.push(Buffer.from(`--${boundary}--\r\n`));
	return Buffer.concat(chunks);
};

describe("captureServer", () => {
	let server: CaptureServer;

	beforeEach(async () => {
		server = await startCaptureServer();
	});

	afterEach(async () => {
		await server.close();
	});

	it("binds to 127.0.0.1 on an ephemeral port", () => {
		expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
		expect(server.port).toBeGreaterThan(0);
	});

	it("captures a JSON embed", async () => {
		const payload = {
			username: "Obsidian Share",
			avatar_url: "https://example.com/avatar.png",
			embeds: [{ title: "Hello", color: 9263575, fields: [{ name: "a", value: "b", inline: true }] }],
		};
		const response = await fetch(server.urlFor(hookPath("one")), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});

		expect(response.status).toBe(204);
		expect(server.requests).toHaveLength(1);
		const [request] = server.requests;
		expect(request.method).toBe("POST");
		expect(request.path).toBe(hookPath("one"));
		expect(request.headers["content-type"]).toBe("application/json");
		expect(request.rawBody.toString("utf8")).toBe(JSON.stringify(payload));
		expect(request.json.embeds[0]).toEqual(payload.embeds[0]);
		expect(request.json.username).toBe("Obsidian Share");
		expect(request.json.avatar_url).toBe(payload.avatar_url);
		expect(request.parseError).toBeUndefined();
	});

	it("captures a multipart attachment with binary bytes and payload_json", async () => {
		const form = new FormData();
		form.append("files[0]", blobOf(nestedPng), "b.png");
		form.append("payload_json", JSON.stringify({ username: "Obsidian Share", avatar_url: "https://example.com/a.png" }));
		await fetch(server.urlFor(hookPath("one")), { method: "POST", body: form });

		const [request] = server.requests;
		expect(request.parts).toHaveLength(2);
		const file = request.parts!.find((part) => part.name === "files[0]")!;
		expect(file.filename).toBe("b.png");
		expect(file.contentType).toBe("application/octet-stream");
		expect(file.size).toBe(nestedPng.length);
		expect(file.bytes.equals(nestedPng)).toBe(true);
		expect(file.bytes.equals(rootPng)).toBe(false);
		expect(request.payloadJson).toEqual({ username: "Obsidian Share", avatar_url: "https://example.com/a.png" });
	});

	it("keeps bytes that look like multipart framing intact", async () => {
		const tricky = Buffer.concat([Buffer.from([0, 255, 13, 10, 13, 10]), Buffer.from("\r\n--almost-a-boundary\r\n"), Buffer.from([13, 10])]);
		const body = multipartBody("XBOUNDARYX", [
			{ name: "files[0]", filename: "tricky.bin", type: "application/octet-stream", data: tricky },
			{ name: "payload_json", data: JSON.stringify({ ok: true }) },
		]);
		await fetch(server.urlFor(hookPath("one")), {
			method: "POST",
			headers: { "Content-Type": "multipart/form-data; boundary=XBOUNDARYX" },
			body,
		});

		const file = server.requests[0].parts![0];
		expect(file.bytes.equals(tricky)).toBe(true);
		expect(file.size).toBe(tricky.length);
	});

	it("records parse errors instead of throwing for malformed bodies", async () => {
		await fetch(server.urlFor(hookPath("one")), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{not json",
		});
		await fetch(server.urlFor(hookPath("one")), {
			method: "POST",
			headers: { "Content-Type": "multipart/form-data; boundary=ABC" },
			body: "no boundary in here",
		});

		expect(server.requests).toHaveLength(2);
		expect(server.requests[0].parseError).toBeDefined();
		expect(server.requests[0].json).toBeUndefined();
		expect(server.requests[1].parseError).toMatch(/boundary/);
	});

	it("responds with a configured 413 and body", async () => {
		server.setResponse(413, "Request entity too large");
		const form = new FormData();
		form.append("files[0]", blobOf(rootPng), "b.png");
		form.append("payload_json", "{}");
		const response = await fetch(server.urlFor(hookPath("one")), { method: "POST", body: form });

		expect(response.status).toBe(413);
		expect(await response.text()).toBe("Request entity too large");
		expect(server.requests[0].responseStatus).toBe(413);
	});

	it("serializes object bodies as JSON and configures responses per path", async () => {
		server.setResponse(500, { message: "boom", code: 0 }, hookPath("bad"));
		const bad = await fetch(server.urlFor(hookPath("bad")), { method: "POST", body: "{}" });
		const good = await fetch(server.urlFor(hookPath("good")), { method: "POST", body: "{}" });

		expect(bad.status).toBe(500);
		expect(bad.headers.get("content-type")).toBe("application/json");
		expect(await bad.json()).toEqual({ message: "boom", code: 0 });
		expect(good.status).toBe(204);
		expect(server.requests.map((r) => r.path)).toEqual([hookPath("bad"), hookPath("good")]);
	});

	it("reset clears captures and configured responses", async () => {
		server.setResponse(500, "x");
		await fetch(server.urlFor(hookPath("one")), { method: "POST", body: "{}" });
		server.reset();

		expect(server.requests).toHaveLength(0);
		const response = await fetch(server.urlFor(hookPath("one")), { method: "POST", body: "{}" });
		expect(response.status).toBe(204);
	});

	it("answers CORS preflight and keeps preflights out of requests", async () => {
		const response = await fetch(server.urlFor(hookPath("one")), {
			method: "OPTIONS",
			headers: {
				Origin: "app://obsidian.md",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "content-type",
			},
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
		expect(response.headers.get("access-control-allow-headers")).toBe("*");
		expect(response.headers.get("access-control-allow-methods")).toContain("POST");
		expect(server.requests).toHaveLength(0);
		expect(server.preflights).toHaveLength(1);

		const post = await fetch(server.urlFor(hookPath("one")), { method: "POST", body: "{}" });
		expect(post.headers.get("access-control-allow-origin")).toBe("*");
	});

	it("no-CORS mode sends no CORS headers and rejects OPTIONS", async () => {
		const strict = await startCaptureServer({ cors: false });
		try {
			const preflight = await fetch(strict.urlFor(hookPath("one")), { method: "OPTIONS" });
			expect(preflight.status).toBe(405);
			expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

			const post = await fetch(strict.urlFor(hookPath("one")), { method: "POST", body: "{}" });
			expect(post.status).toBe(204);
			expect(post.headers.get("access-control-allow-origin")).toBeNull();

			strict.setCors(true);
			const enabled = await fetch(strict.urlFor(hookPath("one")), { method: "OPTIONS" });
			expect(enabled.status).toBe(204);
		} finally {
			await strict.close();
		}
	});

	it("waitForRequests resolves on arrival and rejects on timeout", async () => {
		const waiting = server.waitForRequests(2, 2000);
		await fetch(server.urlFor(hookPath("one")), { method: "POST", body: "{}" });
		await fetch(server.urlFor(hookPath("two")), { method: "POST", body: "{}" });
		await expect(waiting).resolves.toHaveLength(2);

		await expect(server.waitForRequests(3, 50)).rejects.toThrow(/Timed out/);
	});

	it("serializeCapture replaces bytes with sizes and hashes", async () => {
		const form = new FormData();
		form.append("files[0]", blobOf(nestedPng), "b.png");
		form.append("payload_json", "{}");
		await fetch(server.urlFor(hookPath("one")), { method: "POST", body: form });

		const serialized = serializeCapture(server.requests[0]);
		const text = JSON.stringify(serialized);
		expect(serialized.parts![0]).toMatchObject({ name: "files[0]", filename: "b.png", size: nestedPng.length });
		expect(serialized.parts![0]).not.toHaveProperty("bytes");
		expect(serialized.parts![0].sha256).toMatch(/^[0-9a-f]{64}$/);
		expect(serialized).not.toHaveProperty("rawBody");
		expect(JSON.parse(text).bodySize).toBe(server.requests[0].rawBody.length);
	});
});

describe("parseMultipart", () => {
	it("parses names, filenames, content types and escaped quotes", () => {
		const body = multipartBody("B", [
			{ name: "files[0]", filename: 'we"ird.png', type: "image/png", data: rootPng },
			{ name: "payload_json", type: "application/json", data: '{"a":1}' },
		]);
		const parts = parseMultipart(body, "B");
		expect(parts.map((p) => p.name)).toEqual(["files[0]", "payload_json"]);
		expect(parts[0].filename).toBe('we"ird.png');
		expect(parts[0].contentType).toBe("image/png");
		expect(parts[1].json).toEqual({ a: 1 });
	});

	it("decodes percent-encoded quotes browsers use in filenames", () => {
		const body = Buffer.from(
			'--B\r\nContent-Disposition: form-data; name="f"; filename="a%22b.png"\r\n\r\nx\r\n--B--\r\n',
		);
		expect(parseMultipart(body, "B")[0].filename).toBe('a"b.png');
	});

	it("throws when the boundary is missing or the body is truncated", () => {
		expect(() => parseMultipart(Buffer.from("nothing"), "B")).toThrow(/boundary/);
		expect(() => parseMultipart(Buffer.from('--B\r\nContent-Disposition: form-data; name="f"\r\n\r\nx'), "B")).toThrow(/unterminated/);
	});
});
