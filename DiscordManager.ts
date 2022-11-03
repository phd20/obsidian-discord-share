import { EmbedBuilder, WebhookClient } from "discord.js";
import DiscordSharePlugin from "main";
import { MetadataCache, Vault } from "obsidian";

export default class DiscordManager {
	plugin: DiscordSharePlugin;
	metadata: MetadataCache;
	vault: Vault;

	constructor(plugin: DiscordSharePlugin) {
		this.plugin = plugin;
		this.metadata = plugin.app.metadataCache;
		this.vault = plugin.app.vault;
	}

	async sendAttachment(filePath: string) {
		const webhookClient = new WebhookClient({
			url: this.plugin.getSettingValue('discordWebhookURL')!
		});

		// const embed = new EmbedBuilder()
		// 	.setTitle("Some Title")
		// 	.setColor(0x00ffff);

		webhookClient.send({
			content: "Test Message",
			files: [
				{
					attachment: filePath,
					name: "sotanax.jpg",
				},
			],
			username: "Obsidian",
			avatarURL: "https://avatars.githubusercontent.com/u/65011256",
		});
	}
}
