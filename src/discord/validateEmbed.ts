// Discord webhook embed limits. The single place the numbers live.
export const EMBED_LIMITS = {
	title: 256,
	description: 4096,
	footerText: 2048,
	authorName: 256,
	fields: 25,
	fieldName: 256,
	fieldValue: 1024,
	total: 6000,
} as const;

export type ViolationKind = "length" | "count" | "total" | "empty";

export interface Violation {
	/** Human label, e.g. "Description", "Field 3 value", "Fields", "Total embed text". */
	field: string;
	kind: ViolationKind;
	actual: number;
	limit: number;
}

/** Structural input: accepts the Discord-shaped embed, tolerates anything else. */
export interface ValidatableEmbed {
	title?: string;
	description?: string;
	footer?: { text?: string };
	author?: { name?: string };
	fields?: unknown;
	thumbnail?: { url?: string };
	image?: { url?: string };
}

/**
 * The only place a length is computed: counts Unicode code points of the trimmed text,
 * because Discord trims leading and trailing whitespace before measuring.
 */
export const measure = (text: string): number => [...text.trim()].length;

const asText = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const isFilled = (value: unknown): boolean => typeof value === "string" && value.trim() !== "";

const hasUrl = (value: unknown): boolean =>
	typeof value === "object" && value !== null && typeof (value as { url?: unknown }).url === "string" && (value as { url: string }).url !== "";

const hasContent = (embed: ValidatableEmbed): boolean =>
	isFilled(embed.title) ||
	isFilled(embed.description) ||
	isFilled(embed.footer?.text) ||
	isFilled(embed.author?.name) ||
	(Array.isArray(embed.fields) && embed.fields.some((entry: unknown) => typeof entry === "object" && entry !== null)) ||
	hasUrl(embed.thumbnail) ||
	hasUrl(embed.image);

export const validateEmbed = (embed: ValidatableEmbed): Violation[] => {
	const violations: Violation[] = [];
	let total = 0;

	const check = (field: string, value: unknown, limit: number) => {
		const text = asText(value);
		if (text === undefined) return;
		const actual = measure(text);
		total += actual;
		if (actual > limit) violations.push({ field, kind: "length", actual, limit });
	};

	const source = (embed ?? {}) as ValidatableEmbed;

	if (!hasContent(source)) violations.push({ field: "Embed", kind: "empty", actual: 0, limit: 0 });

	check("Title", source.title, EMBED_LIMITS.title);
	check("Description", source.description, EMBED_LIMITS.description);
	check("Footer text", source.footer?.text, EMBED_LIMITS.footerText);
	check("Author name", source.author?.name, EMBED_LIMITS.authorName);

	if (Array.isArray(source.fields)) {
		if (source.fields.length > EMBED_LIMITS.fields) {
			violations.push({ field: "Fields", kind: "count", actual: source.fields.length, limit: EMBED_LIMITS.fields });
		}
		source.fields.forEach((entry: unknown, index: number) => {
			if (typeof entry !== "object" || entry === null) return;
			const { name, value } = entry as { name?: unknown; value?: unknown };
			check(`Field ${index + 1} name`, name, EMBED_LIMITS.fieldName);
			check(`Field ${index + 1} value`, value, EMBED_LIMITS.fieldValue);
		});
	}

	if (total > EMBED_LIMITS.total) {
		violations.push({ field: "Total embed text", kind: "total", actual: total, limit: EMBED_LIMITS.total });
	}

	return violations;
};
