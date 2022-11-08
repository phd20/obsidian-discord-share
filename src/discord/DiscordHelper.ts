import { EmbedBuilder } from "discord.js";
import { MetadataCache, TFile, Vault } from "obsidian";
import DiscordSharePlugin from "src/main";
import { DiscordEmbedAuthor, DiscordEmbedColor, DiscordEmbedDescription, DiscordEmbedFields, DiscordEmbedFooter, DiscordEmbedImage, DiscordEmbedThumbnail, DiscordEmbedTitle, DiscordEmbedURL } from "./constants";

export default class DiscordHelper {
	plugin: DiscordSharePlugin;
	metadata: MetadataCache;
	vault: Vault;

	constructor(plugin: DiscordSharePlugin) {
		this.plugin = plugin;
		this.metadata = plugin.app.metadataCache;
		this.vault = plugin.app.vault;
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

        console.log(frontmatter[DiscordEmbedAuthor]);

        return new EmbedBuilder()
            .setColor(frontmatter[DiscordEmbedColor] || this.plugin.getSettingValue("embedColor") || null)
            .setTitle(frontmatter[DiscordEmbedTitle] || null)
            .setURL(frontmatter[DiscordEmbedURL] || null)
			.setAuthor(frontmatter[DiscordEmbedAuthor] || null)
			.setDescription(frontmatter[DiscordEmbedDescription] || null)
			.setThumbnail('https://www.google.com' || null)
			.addFields(...frontmatter[DiscordEmbedFields] || null)
			.setImage(frontmatter[DiscordEmbedImage] || null)
			.setTimestamp()
			.setFooter(frontmatter[DiscordEmbedFooter] || null);
    }
}