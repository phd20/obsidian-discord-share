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
import { ISettingsOptions } from "src/Settings";

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

	public buildDiscordEmbedParamsFromFile(file: TFile, settings: ISettingsOptions) {
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

		const getValueForParam = (param: string) => {
			switch (param) {
				case "color":
					if (frontmatter[DiscordEmbedColor]) {
						return frontmatter[DiscordEmbedColor];
					} else {
						return settings.embedColor;
					}
				case "title":
					if (settings.useNoteTitleForEmbed) {
						return file.basename;
					} else if (settings.embedTitle) {
						return frontmatter[settings.embedTitle];
					} else {
						return frontmatter[DiscordEmbedTitle];
					}
				case "url":
					if (settings.embedURL) {
						return frontmatter[settings.embedURL];
					} else {
						return frontmatter[DiscordEmbedURL];
					}
				case "author":
					if (settings.embedAuthor) {
						return frontmatter[settings.embedAuthor];
					} else {
						return frontmatter[DiscordEmbedAuthor];
					}
				case "description":
					if (settings.embedDescription) {
						return frontmatter[settings.embedDescription];
					} else {
						return frontmatter[DiscordEmbedDescription];
					}
				case "thumbnail":
					if (settings.embedThumbnail) {
						return frontmatter[settings.embedThumbnail];
					} else {
						return frontmatter[DiscordEmbedThumbnail];
					}
				case "fields":
					if (settings.embedFields) {
						return frontmatter[settings.embedFields];
					} else {
						return frontmatter[DiscordEmbedFields];
					}
				case "image":
					if (settings.embedImage) {
						return frontmatter[settings.embedImage];
					} else {
						return frontmatter[DiscordEmbedImage];
					}
				case "footer":
					if (settings.embedFooter) {
						return frontmatter[settings.embedFooter];
					} else {
						return frontmatter[DiscordEmbedFooter];
					}
				default:
					break;
			}
		}

		const embedParams: DiscordEmbedParams = {
			color: getValueForParam("color"),
			title: getValueForParam("title"),
			url: getValueForParam("url"),
			author: getValueForParam("author"),
			description: getValueForParam("description"),
			thumbnail: getValueForParam("thumbnail"),
			fields: getValueForParam("fields"),
			image: getValueForParam("image"),
			footer: getValueForParam("footer"),
			file: file,
		}

		return embedParams;
	}
}
