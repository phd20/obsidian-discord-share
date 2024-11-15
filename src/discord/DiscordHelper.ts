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

		// Create embed from default values 

		// Override with frontmatter values if they exist
		// If a frontmatter override is found, use it to check the frontmatter for value. 
		// If a frontmatter override is not found, use the default frontmatter key.
		// If a default frontmatter key is not found, use the default value.
		// Return embed

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

		const { embedDefaultValues, embedPropertyOverrides } = settings;
		const { embedDefaultAuthor, embedDefaultFooter } = embedDefaultValues;

		// TODO - Refactor this to be more DRY
		const getValueForParam = (param: string) => {
			switch (param) {
				case "color":
					if (frontmatter[DiscordEmbedColor]) {
						return frontmatter[DiscordEmbedColor];
					} else {
						return embedDefaultValues.embedDefaultColor;
					}
				case "title":
					if (settings.useNoteTitleForEmbed) {
						return file.basename;
					} else if (embedPropertyOverrides.embedTitlePropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedTitlePropertyOverride];
					} else if (frontmatter[DiscordEmbedTitle]) {
						return frontmatter[DiscordEmbedTitle];
					} else {
						return embedDefaultValues.embedDefaultTitle;
					}
				case "url":
					if (embedPropertyOverrides.embedURLPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedURLPropertyOverride];
					} else if (frontmatter[DiscordEmbedURL]) {
						return frontmatter[DiscordEmbedURL];
					} else {
						return embedDefaultValues.embedDefaultURL;
					}
				case "author":
					if (embedPropertyOverrides.embedAuthorPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedAuthorPropertyOverride];
					} else if (frontmatter[DiscordEmbedAuthor]) {
						return frontmatter[DiscordEmbedAuthor];
					} else {
						return embedDefaultAuthor; // TODO - Test that this works with object
					}
				case "description":
					if (embedPropertyOverrides.embedDescriptionPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedDescriptionPropertyOverride];
					} else if (frontmatter[DiscordEmbedDescription]) {
						return frontmatter[DiscordEmbedDescription];
					} else {
						return embedDefaultValues.embedDefaultDescription;
					}
				case "thumbnail":
					if (embedPropertyOverrides.embedThumbnailPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedThumbnailPropertyOverride];
					} else if (frontmatter[DiscordEmbedThumbnail]) {
						return frontmatter[DiscordEmbedThumbnail];
					} else {
						return embedDefaultValues.embedDefaultThumbnail;
					}
				case "fields":
					if (embedPropertyOverrides.embedFieldsPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedFieldsPropertyOverride];
					} else if (frontmatter[DiscordEmbedFields]) {
						return frontmatter[DiscordEmbedFields];
					} else {
						return embedDefaultValues.embedDefaultFields;
					}
				case "image":
					if (embedPropertyOverrides.embedImagePropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedImagePropertyOverride];
					} else if (frontmatter[DiscordEmbedImage]) {
						return frontmatter[DiscordEmbedImage];
					} else {
						return embedDefaultValues.embedDefaultImage;
					}
				case "footer":
					if (embedPropertyOverrides.embedFooterPropertyOverride) {
						return frontmatter[embedPropertyOverrides.embedFooterPropertyOverride];
					} else if (frontmatter[DiscordEmbedFooter]) {
						return frontmatter[DiscordEmbedFooter];
					} else {
						return embedDefaultFooter; // TODO - Test that this works with object
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

		console.log(embedParams);

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
