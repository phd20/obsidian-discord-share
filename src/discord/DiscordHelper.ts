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
import { IEmbedDefaultAuthorSettings, IEmbedDefaultFieldsSettings, IEmbedDefaultFooterSettings, IEmbedPropertyOverrideSettings, ISettingsOptions } from "src/Settings";
import { removeFrontmatter, replaceLinkAliases, removeWikiLinks, removeObsidianComments } from "../../src/util/markdown"; // TODO - Fix module imports as this is gross.
import { DiscordEmbedParamsBuilder } from "./DiscordEmbedParamsBuilder";

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
	
		const { embedDefaultValues, embedPropertyOverrides } = settings;
		const { embedDefaultAuthor, embedDefaultFooter } = embedDefaultValues;
	
		const getFrontmatterOrDefaultValue = (
			key: string,
			overrideKey: keyof IEmbedPropertyOverrideSettings,
			defaultValue: string | IEmbedDefaultAuthorSettings | IEmbedDefaultFieldsSettings[] | IEmbedDefaultFooterSettings) => {
			if (embedPropertyOverrides[overrideKey]) {
				return frontmatter[embedPropertyOverrides[overrideKey]] || defaultValue;
			}
			return frontmatter[key] || defaultValue;
		};
	
		const getValueForParam = (param: string) => {
			switch (param) {
				case "color":
					return getFrontmatterOrDefaultValue(DiscordEmbedColor, "embedColorPropertyOverride", embedDefaultValues.embedDefaultColor);
				case "title":
					return settings.useNoteTitleForEmbed ? file.basename :
						getFrontmatterOrDefaultValue(DiscordEmbedTitle, "embedTitlePropertyOverride", embedDefaultValues.embedDefaultTitle);
				case "url":
					return getFrontmatterOrDefaultValue(DiscordEmbedURL, "embedURLPropertyOverride", embedDefaultValues.embedDefaultURL);
				case "author":
					return getFrontmatterOrDefaultValue(DiscordEmbedAuthor, "embedAuthorPropertyOverride", embedDefaultAuthor);
				case "description":
					return getFrontmatterOrDefaultValue(DiscordEmbedDescription, "embedDescriptionPropertyOverride", embedDefaultValues.embedDefaultDescription);
				case "thumbnail":
					return getFrontmatterOrDefaultValue(DiscordEmbedThumbnail, "embedThumbnailPropertyOverride", embedDefaultValues.embedDefaultThumbnail);
				case "fields":
					return getFrontmatterOrDefaultValue(DiscordEmbedFields, "embedFieldsPropertyOverride", embedDefaultValues.embedDefaultFields);
				case "image":
					return getFrontmatterOrDefaultValue(DiscordEmbedImage, "embedImagePropertyOverride", embedDefaultValues.embedDefaultImage);
				case "footer":
					return getFrontmatterOrDefaultValue(DiscordEmbedFooter, "embedFooterPropertyOverride", embedDefaultFooter);
				default:
					return null;
			}
		};
	
		const embedParams = new DiscordEmbedParamsBuilder()
			.setColor(getValueForParam("color"))
			.setTitle(getValueForParam("title"))
			.setURL(getValueForParam("url"))
			.setAuthor(getValueForParam("author"))
			.setDescription(getValueForParam("description"))
			.setThumbnail(getValueForParam("thumbnail"))
			.setFields(getValueForParam("fields"))
			.setImage(getValueForParam("image"))
			.setFooter(getValueForParam("footer"))
			.setFile(file)
			.build();
	
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
