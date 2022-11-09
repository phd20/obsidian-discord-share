import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { FileSystemAdapter, MetadataCache, TFile, Vault } from "obsidian";
import DiscordSharePlugin from "src/main";
import { isValidUrl } from "src/util";
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

	public buildEmbedFromFile(file: TFile) {
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

		const embed = new EmbedBuilder()
			.setColor(
				frontmatter[DiscordEmbedColor] ||
					this.plugin.getSettingValue("embedColor") ||
					null
			)
			.setTitle(frontmatter[DiscordEmbedTitle] || null)
			.setURL(frontmatter[DiscordEmbedURL] || null)
			.setAuthor(frontmatter[DiscordEmbedAuthor] || null)
			.setDescription(frontmatter[DiscordEmbedDescription] || null)
			.setThumbnail(frontmatter[DiscordEmbedThumbnail] || null)
			.setTimestamp()
			.setFooter(frontmatter[DiscordEmbedFooter] || null);
		
		const image = this.getImageFromFrontmatter(
			frontmatter[DiscordEmbedImage],
			file.path
		);
		if (image) {
			embed.setImage(image.image);
		}

		if (frontmatter[DiscordEmbedFields]) {
			embed.addFields(...frontmatter[DiscordEmbedFields]);
		}

		return {
			embed: embed,
			attachment: image?.attachment,
		};
	}

	private getImageFromFrontmatter(image: string, filepath: string) {
		if (!image) return null;
		if (isValidUrl(image)) return { image: image };
		const src = image[0][0];

		const file = this.metadata.getFirstLinkpathDest(src, filepath);
		if (file instanceof TFile) {
			const filePath = this.adapter.getFullPath(file.path);
			const attachment = new AttachmentBuilder(filePath);
			return {
				image: `attachment://${file.name}`,
				attachment: attachment,
			};
		}

		return null;
	}
}
