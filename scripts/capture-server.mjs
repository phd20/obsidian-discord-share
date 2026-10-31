// Standalone webhook capture server for the Claude dev loop.
// Appends each capture as one JSON line (part bytes replaced by size + sha256) and prints the URL.
//
//   node scripts/capture-server.mjs [--port 0] [--out test/.captures/captures.jsonl]
//                                   [--status 204] [--body TEXT] [--no-cors]
//
// Imports the .ts file directly, which needs a Node with built-in type stripping (22.18+).
import fs from "node:fs";
import path from "node:path";
import { startCaptureServer, serializeCapture } from "../test/support/captureServer.ts";

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? fallback : args[index + 1];
};

const out = path.resolve(option("out", "test/.captures/captures.jsonl"));
fs.mkdirSync(path.dirname(out), { recursive: true });

const server = await startCaptureServer({
	port: Number(option("port", 0)),
	cors: !args.includes("--no-cors"),
	response: {
		status: Number(option("status", 204)),
		body: option("body", undefined),
	},
	onCapture: (request) => {
		fs.appendFileSync(out, `${JSON.stringify(serializeCapture(request))}\n`);
	},
});

// Lets other scripts (the dev-loop settings helper) find the server without parsing stdout.
fs.writeFileSync(path.join(path.dirname(out), "server-url.txt"), `${server.url}\n`);

console.log(`Capture server listening on ${server.url}`);
console.log(`Appending captures to ${out}`);

const shutdown = async () => {
	await server.close();
	process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
