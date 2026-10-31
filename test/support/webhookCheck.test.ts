import * as fs from "fs";
import * as path from "path";
import { ALLOW_MARKER, findWebhookUrls, scanRepository } from "./webhookCheck";
import { createOversizedPng, DISCORD_ATTACHMENT_LIMIT_BYTES } from "./oversized";

const root = path.join(__dirname, "..", "..");

// Assembled at runtime so this file never contains a URL the check would flag.
const host = (name: string) => `${name}.com/api`;
const fakeUrl = (domain = "discord", version = "") =>
	`https://${host(domain)}${version}/webhooks/${"1234567890".repeat(2)}/${"aB3_-".repeat(4)}`;

describe("findWebhookUrls", () => {
	it("flags discord.com and discordapp.com webhook URLs, with or without an API version", () => {
		expect(findWebhookUrls(fakeUrl("discord"))).toHaveLength(1);
		expect(findWebhookUrls(fakeUrl("discordapp"))).toHaveLength(1);
		expect(findWebhookUrls(fakeUrl("discord", "/v10"))).toHaveLength(1);
	});

	it("reports file and line, and masks the token", () => {
		const [finding] = findWebhookUrls(`ok\nurl: ${fakeUrl()}\n`, "notes.md");
		expect(finding).toMatchObject({ file: "notes.md", line: 2 });
		expect(finding.match).not.toContain("aB3_-aB3_-aB3_-aB3_-");
	});

	it("allows bare mentions and obvious placeholders", () => {
		expect(findWebhookUrls(`search for ${host("discord")}/webhooks`)).toEqual([]);
		expect(findWebhookUrls(`https://${host("discord")}/webhooks/<id>/<token>`)).toEqual([]);
		expect(findWebhookUrls(`https://${host("discord")}/webhooks/123456789/xxxxxxxx`)).toEqual([]);
		expect(findWebhookUrls(`https://${host("discord")}/webhooks/123456789/YOUR_TOKEN`)).toEqual([]);
	});

	it("allows a line carrying the allow marker", () => {
		expect(findWebhookUrls(`${fakeUrl()} <!-- ${ALLOW_MARKER} -->`)).toEqual([]);
	});
});

describe("repository", () => {
	it("contains no Discord webhook URLs", () => {
		expect(scanRepository(root)).toEqual([]);
	});

	it("keeps fixture vaults free of plugin settings", () => {
		const vault = path.join(root, "test", "vaults");
		const found: string[] = [];
		const walk = (dir: string) =>
			fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.name === "data.json") found.push(full);
			});
		walk(vault);
		expect(found).toEqual([]);
	});
});

describe("fixture vault", () => {
	const vault = path.join(root, "test", "vaults", "basic");

	it("has two b.png files with different bytes", () => {
		const root_ = fs.readFileSync(path.join(vault, "attachments", "b.png"));
		const nested = fs.readFileSync(path.join(vault, "img", "nested", "b.png"));
		expect(root_.equals(nested)).toBe(false);
		[root_, nested].forEach((png) => expect(png.slice(1, 4).toString()).toBe("PNG"));
	});

	it("generates an oversized file on demand instead of committing one", () => {
		expect(fs.existsSync(path.join(vault, "big.png"))).toBe(false);
		expect(createOversizedPng().length).toBe(DISCORD_ATTACHMENT_LIMIT_BYTES + 1);
	});
});
