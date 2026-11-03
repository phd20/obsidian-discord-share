import { Violation } from "./validateEmbed";

const MAX_LISTED = 4;

// Fixed locale so the notice reads the same on every machine.
const n = (value: number): string => value.toLocaleString("en-US");

const describe = (violation: Violation): string => {
	const { field, kind, actual, limit } = violation;
	switch (kind) {
		case "empty":
			return "Nothing to share: the embed has no title, description, fields, footer, author or image.";
		case "count":
			return `${field}: ${n(actual)} entries; Discord allows ${n(limit)}.`;
		case "total":
			return `${field} is ${n(actual)} characters; Discord allows ${n(limit)} in total.`;
		case "bytes":
			return `${field} is ${n(actual)} bytes; Discord allows about ${n(limit)}. Emoji and many non-Latin scripts take 3 to 4 bytes per character.`;
		default:
			return `${field} is ${n(actual)} characters; Discord allows ${n(limit)}.`;
	}
};

/** Builds the full notice text for an embed that exceeds Discord's limits. */
export const formatViolations = (violations: Violation[]): string => {
	const lines = ["Failed to share embed to Discord."];
	lines.push(...violations.slice(0, MAX_LISTED).map(describe));
	if (violations.length > MAX_LISTED) lines.push(`and ${violations.length - MAX_LISTED} more.`);
	return lines.join("\n");
};
