import { WebhookClient } from "discord.js";
import DiscordSharePlugin from "main";
import { MetadataCache, Notice, Vault } from "obsidian";

export default class DiscordManager {
	plugin: DiscordSharePlugin;
	metadata: MetadataCache;
	vault: Vault;

	constructor(plugin: DiscordSharePlugin) {
		this.plugin = plugin;
		this.metadata = plugin.app.metadataCache;
		this.vault = plugin.app.vault;
	}

	async sendAttachment(filePath: string, fileName: string) {
		const RequestEntityTooLargeErrorCode = "Request entity too large";
		const webhookClient = new WebhookClient({
			url: this.plugin.getSettingValue("discordWebhookURL")!,
		});

		webhookClient
			.send({
				files: [
					{
						attachment: filePath,
						name: fileName,
					},
				],
				username: "Obsidian Share",
				avatarURL: "https://avatars.githubusercontent.com/u/65011256",
			})
			.then((data) => {
				new Notice("Successfully sent to Discord!");
			})
			.catch((error) => {
				if (error && error.message === RequestEntityTooLargeErrorCode) {
					new Notice(
						`Failed to Send to Discord. Attachments must be smaller than 8MB.`
					);
				} else {
					new Notice(`Failed to Send to Discord. ${error.message}.`);
				}
				console.log(error);
			});
	}
}
