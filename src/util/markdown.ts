export const removeFrontmatter = (content: string) => {
	const frontmatterRegex = /^---[\s\S]*?---\s*/;
	const contentWithoutFrontmatter = content.replace(frontmatterRegex, '');

	return contentWithoutFrontmatter;
}

export const replaceLinkAliases = (content: string) => {
	const linkAliasRegex = /\[\[.*?\|(.*?)\]\]/g;
	const contentWithLinkAliasesReplaced = content.replace(linkAliasRegex, (_, alias) => `${alias}`);

	return contentWithLinkAliasesReplaced;
}

export const removeWikiLinks = (content: string) => {
	const wikiLinkRegex = /!?(\[\[(.*?)\]\])/g;
	const contentWithoutWikiLinks = content.replace(wikiLinkRegex, (_, __, linkText) => linkText);

	return contentWithoutWikiLinks;
}

export const removeObsidianComments = (content: string) => {
	const obsidianCommentRegex = /%%[\s\S]*?%%/g;
	const contentWithoutObsidianComments = content.replace(obsidianCommentRegex, '');

	return contentWithoutObsidianComments;
}
