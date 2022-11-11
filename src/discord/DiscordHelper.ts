import { FileSystemAdapter, MetadataCache, TFile, Vault } from "obsidian";
import DiscordSharePlugin from "src/main";
import {
	DiscordEmbedAuthor,
	DiscordEmbedColor,
	DiscordEmbedDescription,
	DiscordEmbedFields,
	DiscordEmbedFooter,
	DiscordEmbedImage,
	DiscordEmbedThumbnail,
	DiscordEmbedTitle,
	DiscordEmbedURL,
} from "./constants";
import { DiscordEmbedParams } from "./types";

export default class DiscordHelper {
	plugin: DiscordSharePlugin;
	metadata: MetadataCache;
	vault: Vault;
	adapter: FileSystemAdapter;

	constructor(plugin: DiscordSharePlugin) {
		this.plugin = plugin;
		this.metadata = plugin.app.metadataCache;
		this.vault = plugin.app.vault;
		this.adapter = plugin.app.vault.adapter as FileSystemAdapter;
	}

	public buildDiscordEmbedParamsFromFile(file: TFile) {
		const metadata = this.metadata.getFileCache(file);
		if (!metadata) {
			console.log("No metadata found for file.");
			return;
		}
		const frontmatter = metadata.frontmatter;
		if (!frontmatter) {
			console.log("No frontmatter found for file.");
			return;
		}

		const embedParams: DiscordEmbedParams = {
			color: frontmatter[DiscordEmbedColor],
			title: frontmatter[DiscordEmbedTitle],
			url: frontmatter[DiscordEmbedURL],
			author: frontmatter[DiscordEmbedAuthor],
			description: frontmatter[DiscordEmbedDescription],
			thumbnail: frontmatter[DiscordEmbedThumbnail],
			fields: frontmatter[DiscordEmbedFields],
			image: frontmatter[DiscordEmbedImage],
			footer: frontmatter[DiscordEmbedFooter],
			file: file,
		}

		return embedParams;
	}
}
