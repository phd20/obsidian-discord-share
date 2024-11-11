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
import { removeFrontmatter, replaceLinkAliases, removeWikiLinks, removeObsidianComments } from "../../src/util/markdown"; // TODO - Fix module imports as this is gross.

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

		const { embedPropertyOverrides } = settings;

		const getValueForParam = (param: string) => {
			switch (param) {
				case "color":
					if (frontmatter[DiscordEmbedColor]) {
						return frontmatter[DiscordEmbedColor];
					} else {
						return embedPropertyOverrides.embedColorPropertyOverride;
					}
				case "title":
					if (settings.useNoteTitleForEmbed) {
						return file.basename;
					} else if (embedPropertyOverrides.embedTitlePropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedTitlePropertyOverride];
					} else {
						return frontmatter[DiscordEmbedTitle];
					}
				case "url":
					if (embedPropertyOverrides.embedURLPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedURLPropertyOverride];
					} else {
						return frontmatter[DiscordEmbedURL];
					}
				case "author":
					if (embedPropertyOverrides.embedAuthorPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedAuthorPropertyOverride];
					} else {
						return frontmatter[DiscordEmbedAuthor];
					}
				case "description":
					if (embedPropertyOverrides.embedDescriptionPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedDescriptionPropertyOverride];
					} else {
						return frontmatter[DiscordEmbedDescription];
					}
				case "thumbnail":
					if (embedPropertyOverrides.embedThumbnailPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedThumbnailPropertyOverride];
					} else {
						return frontmatter[DiscordEmbedThumbnail];
					}
				case "fields":
					if (embedPropertyOverrides.embedFieldsPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedFieldsPropertyOverride];
					} else {
						return frontmatter[DiscordEmbedFields];
					}
				case "image":
					if (embedPropertyOverrides.embedImagePropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedImagePropertyOverride];
					} else {
						return frontmatter[DiscordEmbedImage];
					}
				case "footer":
					if (embedPropertyOverrides.embedFooterPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedFooterPropertyOverride];
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

	public formatObsidianContentForDiscord = (obsidianContent: string) => {
		let formattedContent = "";
		
		formattedContent = removeFrontmatter(obsidianContent);
		formattedContent = removeObsidianComments(formattedContent);
		formattedContent = replaceLinkAliases(formattedContent);
		formattedContent = removeWikiLinks(formattedContent);

		return formattedContent;
	}
}
