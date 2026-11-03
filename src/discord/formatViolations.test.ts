import { formatViolations } from "./formatViolations";
import { Violation } from "./validateEmbed";

const HEADER = "Failed to share embed to Discord.";

const length = (field: string, actual: number, limit: number): Violation => ({ field, kind: "length", actual, limit });

describe("formatViolations", () => {
	it("formats a single length violation", () => {
		expect(formatViolations([length("Description", 7412, 4096)])).toBe(
			`${HEADER}\nDescription is 7,412 characters; Discord allows 4,096.`
		);
	});

	it("formats a count violation", () => {
		expect(formatViolations([{ field: "Fields", kind: "count", actual: 26, limit: 25 }])).toBe(
			`${HEADER}\nFields: 26 entries; Discord allows 25.`
		);
	});

	it("formats a total violation", () => {
		expect(formatViolations([{ field: "Total embed text", kind: "total", actual: 6500, limit: 6000 }])).toBe(
			`${HEADER}\nTotal embed text is 6,500 characters; Discord allows 6,000 in total.`
		);
	});

	it("formats an empty violation", () => {
		expect(formatViolations([{ field: "Embed", kind: "empty", actual: 0, limit: 0 }])).toBe(
			`${HEADER}\nNothing to share: the embed has no title, description, fields, footer, author or image.`
		);
	});

	it("uses thousands separators for large numbers", () => {
		expect(formatViolations([length("Description", 1234567, 4096)])).toBe(
			`${HEADER}\nDescription is 1,234,567 characters; Discord allows 4,096.`
		);
	});

	it("lists exactly four violations without an 'and more' line", () => {
		const violations = [1, 2, 3, 4].map((i) => length(`Field ${i} value`, 2000, 1024));
		const lines = formatViolations(violations).split("\n");
		expect(lines).toHaveLength(5);
		expect(lines.some((line) => line.startsWith("and "))).toBe(false);
	});

	it("lists four violations then summarises the rest", () => {
		const violations = [1, 2, 3, 4, 5, 6].map((i) => length(`Field ${i} value`, 2000, 1024));
		const lines = formatViolations(violations).split("\n");
		expect(lines).toHaveLength(6);
		expect(lines[4]).toBe("Field 4 value is 2,000 characters; Discord allows 1,024.");
		expect(lines[5]).toBe("and 2 more.");
		expect(lines.join("\n")).not.toContain("Field 5 value");
	});

	it("returns just the first line for an empty array", () => {
		expect(formatViolations([])).toBe(HEADER);
	});

	it("preserves input order", () => {
		const text = formatViolations([
			length("Title", 300, 256),
			{ field: "Fields", kind: "count", actual: 30, limit: 25 },
			{ field: "Total embed text", kind: "total", actual: 9000, limit: 6000 },
		]);
		expect(text.split("\n")).toEqual([
			HEADER,
			"Title is 300 characters; Discord allows 256.",
			"Fields: 30 entries; Discord allows 25.",
			"Total embed text is 9,000 characters; Discord allows 6,000 in total.",
		]);
	});
});
