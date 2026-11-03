import { EMBED_LIMITS, measure, ValidatableEmbed, validateEmbed, Violation } from "./validateEmbed";

const rep = (n: number, ch = "a") => ch.repeat(n);
const EMPTY: Violation = { field: "Embed", kind: "empty", actual: 0, limit: 0 };
const labels = (violations: Violation[]) => violations.map((v) => v.field);

describe("measure", () => {
	it("counts code points, not UTF-16 units", () => {
		expect(measure("abc")).toBe(3);
		expect(measure("😀")).toBe(1);
		expect(measure("a😀b")).toBe(3);
		expect(measure("")).toBe(0);
	});

	it("ignores leading and trailing whitespace", () => {
		expect(measure("  abc \n\n")).toBe(3);
		expect(measure("a b")).toBe(3);
		expect(measure(" \n\t ")).toBe(0);
	});
});

describe("validateEmbed", () => {
	it("returns no violations for an embed with content", () => {
		expect(validateEmbed({ title: "t" })).toEqual([]);
	});

	describe.each([
		["Title", "title", (n: number) => ({ title: rep(n) })],
		["Description", "description", (n: number) => ({ description: rep(n) })],
		["Footer text", "footerText", (n: number) => ({ footer: { text: rep(n) } })],
		["Author name", "authorName", (n: number) => ({ author: { name: rep(n) } })],
	] as const)("%s", (label, key, build) => {
		const limit = EMBED_LIMITS[key];

		it("accepts a value exactly at the limit", () => {
			expect(validateEmbed(build(limit))).toEqual([]);
		});

		it("reports a value one over the limit", () => {
			expect(validateEmbed(build(limit + 1))).toEqual([{ field: label, kind: "length", actual: limit + 1, limit }]);
		});
	});

	describe("fields", () => {
		const fields = (n: number) => Array.from({ length: n }, () => ({ name: "n", value: "v" }));

		it("accepts 25 fields", () => {
			expect(validateEmbed({ fields: fields(25) })).toEqual([]);
		});

		it("reports 26 fields", () => {
			expect(validateEmbed({ fields: fields(26) })).toEqual([{ field: "Fields", kind: "count", actual: 26, limit: 25 }]);
		});

		it("accepts field name and value at their limits", () => {
			expect(validateEmbed({ fields: [{ name: rep(256), value: rep(1024) }] })).toEqual([]);
		});

		it("reports an over-long field name with its 1-based position", () => {
			const result = validateEmbed({ fields: [{ name: "a", value: "b" }, { name: rep(257), value: "b" }] });
			expect(result).toEqual([{ field: "Field 2 name", kind: "length", actual: 257, limit: 256 }]);
		});

		it("reports an over-long field value", () => {
			const result = validateEmbed({ fields: [{ name: "a", value: "b" }, { name: "a", value: "b" }, { name: "a", value: rep(1025) }] });
			expect(result).toEqual([{ field: "Field 3 value", kind: "length", actual: 1025, limit: 1024 }]);
		});
	});

	describe("total", () => {
		it("accepts exactly 6000 characters across parts", () => {
			expect(validateEmbed({
				title: rep(256),
				description: rep(4096),
				footer: { text: rep(1648) },
			})).toEqual([]);
		});

		it("reports a total over 6000 when every part is within its limit", () => {
			const result = validateEmbed({
				title: rep(256),
				description: rep(4096),
				footer: { text: rep(1649) },
			});
			expect(result).toEqual([{ field: "Total embed text", kind: "total", actual: 6001, limit: 6000 }]);
		});

		it("counts author name, field names and values in the total", () => {
			const result = validateEmbed({
				description: rep(4096),
				author: { name: rep(256) },
				fields: [{ name: rep(256), value: rep(1024) }, { name: rep(256), value: rep(300) }],
			});
			expect(result).toEqual([{ field: "Total embed text", kind: "total", actual: 4096 + 256 + 256 + 1024 + 256 + 300, limit: 6000 }]);
		});

		it("reports an over-limit part and the total independently", () => {
			const result = validateEmbed({ description: rep(5000), footer: { text: rep(1001) } });
			expect(labels(result)).toEqual(["Description", "Total embed text"]);
			expect(result[0]).toEqual({ field: "Description", kind: "length", actual: 5000, limit: 4096 });
			expect(result[1].actual).toBe(6001);
		});

		it("does not report a total for one over-limit part that stays under 6000", () => {
			const result = validateEmbed({ description: rep(5000) });
			expect(labels(result)).toEqual(["Description"]);
		});
	});

	describe("astral characters", () => {
		it("accepts 4096 emoji as a description and counts them as 4096", () => {
			const description = rep(4096, "😀");
			expect(description.length).toBe(8192);
			expect(validateEmbed({ description })).toEqual([]);
		});

		it("reports 4097 emoji as 4097", () => {
			expect(validateEmbed({ description: rep(4097, "😀") })).toEqual([
				{ field: "Description", kind: "length", actual: 4097, limit: 4096 },
			]);
		});
	});

	describe("malformed input", () => {
		it.each([
			["a string", "oops"],
			["an object", { name: "a", value: "b" }],
			["null", null],
			["a number", 5],
			["undefined", undefined],
		])("ignores fields that is %s", (_, fields) => {
			expect(validateEmbed({ title: "t", fields })).toEqual([]);
		});

		it("skips entries that are null, numbers, strings or arrays", () => {
			expect(validateEmbed({ fields: [null, 1, "x", [], { name: "a", value: "b" }] })).toEqual([]);
		});

		it("skips non-string names and values but still checks the other part", () => {
			const result = validateEmbed({ fields: [{ name: 5, value: rep(1025) }, { name: rep(257), value: null }] });
			expect(result).toEqual([
				{ field: "Field 1 value", kind: "length", actual: 1025, limit: 1024 },
				{ field: "Field 2 name", kind: "length", actual: 257, limit: 256 },
			]);
		});

		it("tolerates non-string title and missing footer text", () => {
			const embed = { title: 5, description: null, footer: {}, author: {} } as unknown as Parameters<typeof validateEmbed>[0];
			expect(validateEmbed(embed)).toEqual([EMPTY]);
		});

		it("does not throw on null footer, author, thumbnail or image", () => {
			const embed = { footer: null, author: null, thumbnail: null, image: null } as unknown as Parameters<typeof validateEmbed>[0];
			expect(validateEmbed(embed)).toEqual([EMPTY]);
		});

		it("does not throw on a null or non-object embed", () => {
			expect(validateEmbed(null as unknown as Parameters<typeof validateEmbed>[0])).toEqual([EMPTY]);
			expect(validateEmbed("x" as unknown as Parameters<typeof validateEmbed>[0])).toEqual([EMPTY]);
		});

		it.each([
			["a string", "oops"],
			["null", null],
			["an empty array", []],
			["an array of non-objects", [null, 1, "x"]],
		])("treats an otherwise empty embed with fields that is %s as empty", (_, fields) => {
			expect(validateEmbed({ fields })).toEqual([EMPTY]);
		});

		it("does not treat non-string urls as content", () => {
			const embed = { thumbnail: { url: 5 }, image: { url: null } } as unknown as Parameters<typeof validateEmbed>[0];
			expect(validateEmbed(embed)).toEqual([EMPTY]);
		});
	});

	describe("trimmed measuring", () => {
		it("does not count leading or trailing spaces and newlines", () => {
			expect(validateEmbed({ description: `  ${rep(4096)} \n` })).toEqual([]);
			expect(validateEmbed({ description: rep(4096) + "   " })).toEqual([]);
		});

		it("reports 4097 characters even when padded with spaces", () => {
			expect(validateEmbed({ description: ` ${rep(4097)}  ` })).toEqual([
				{ field: "Description", kind: "length", actual: 4097, limit: 4096 },
			]);
		});

		it("counts a whitespace-only value as 0 in the total", () => {
			const result = validateEmbed({ description: rep(4096), title: rep(256), footer: { text: rep(1648) + "      " }, author: { name: "   " } });
			expect(result).toEqual([]);
		});

		it("trims field names and values", () => {
			expect(validateEmbed({ fields: [{ name: ` ${rep(256)} `, value: `\n${rep(1024)}\n` }] })).toEqual([]);
		});
	});

	describe("emoji and text mixed", () => {
		it("counts 2000 emoji plus 2096 characters as exactly 4096", () => {
			const description = rep(2000, "😀") + rep(2096, "x");
			expect(validateEmbed({ description })).toEqual([]);
		});

		it("reports 2000 emoji plus 2097 characters as 4097", () => {
			const description = rep(2000, "😀") + rep(2097, "x");
			expect(validateEmbed({ description })).toEqual([
				{ field: "Description", kind: "length", actual: 4097, limit: 4096 },
			]);
		});
	});

	describe("empty embeds", () => {
		it.each([
			["an empty object", {}],
			["a color only", { color: 5814783 }],
			["a url only", { url: "https://example.com" }],
			["a timestamp only", { timestamp: "2026-01-01T00:00:00.000Z" }],
			["a whitespace-only description", { description: " \n\t " }],
			["a whitespace-only title", { title: "   " }],
			["footer text of spaces", { footer: { text: "   " } }],
			["author name of spaces", { author: { name: "  " } }],
			["an empty fields array", { fields: [] }],
			["an empty thumbnail url", { thumbnail: { url: "" } }],
			["an empty image url", { image: { url: "" } }],
		])("treats %s as empty", (_, embed) => {
			expect(validateEmbed(embed as ValidatableEmbed)).toEqual([EMPTY]);
		});

		it.each([
			["a title only", { title: "t" }],
			["a description only", { description: "d" }],
			["a footer only", { footer: { text: "f" } }],
			["an author only", { author: { name: "a" } }],
			["fields only", { fields: [{ name: "n", value: "v" }] }],
			["a thumbnail only", { thumbnail: { url: "https://example.com/t.png" } }],
			["an image only", { image: { url: "https://example.com/i.png" } }],
		])("accepts %s", (_, embed) => {
			expect(validateEmbed(embed)).toEqual([]);
		});

		it("does not call an embed with only a long description empty", () => {
			expect(validateEmbed({ description: rep(4097) })).toEqual([
				{ field: "Description", kind: "length", actual: 4097, limit: 4096 },
			]);
		});
	});
});
