import { EmbedBuilder, WebhookClient } from "discord.js";
import DiscordSharePlugin from "src/main";
import { MetadataCache, Notice, TFile, Vault } from "obsidian";
import { DiscordWebhookAvatarURL, DiscordWebhookUsername } from "./constants";
import DiscordHelper from "./DiscordHelper";

export default class DiscordManager {
	plugin: DiscordSharePlugin;
	metadata: MetadataCache;
	vault: Vault;
	client: WebhookClient;
	discordHelper: DiscordHelper;

	constructor(plugin: DiscordSharePlugin) {
		this.plugin = plugin;
		this.metadata = plugin.app.metadataCache;
		this.vault = plugin.app.vault;
		this.discordHelper = plugin.discordHelper;
	}

	public async shareAttachment(filePath: string, fileName: string) {
		const RequestEntityTooLargeErrorCode = "Request entity too large";
		const webhookClient = new WebhookClient({
			url: this.plugin.getSettingValue("discordWebhookURL") || "",
		});

		webhookClient
			.send({
				files: [
					{
						attachment: filePath,
						name: fileName,
					},
				],
				username: this.getDiscordBotUsername(),
				avatarURL: this.getDiscordBotAvatarURL(),
			})
			.then((data) => {
				new Notice(`Successfully shared ${fileName} to Discord!`);
			})
			.catch((error) => {
				if (error && error.message === RequestEntityTooLargeErrorCode) {
					new Notice(
						`Failed to share ${fileName} to Discord. Attachments must be smaller than 8MB.`
					);
				} else {
					new Notice(
						`Failed to share ${fileName} to Discord. ${error.message}.`
					);
				}
				console.log(error);
			});
	}

	public async shareEmbed(file: TFile) {
		const webhookClient = new WebhookClient({
			url: this.plugin.getSettingValue("discordWebhookURL") || "",
		});

		const embedBuild = this.discordHelper.buildEmbedFromFile(file);
		if (embedBuild && embedBuild.embed instanceof EmbedBuilder) {
			webhookClient
				.send({
					username: this.getDiscordBotUsername(),
					avatarURL: this.getDiscordBotAvatarURL(),
					embeds: [embedBuild.embed],
					files: embedBuild.attachment ? [embedBuild.attachment] : [],
				})
				.then((data) => {
					new Notice(`Successfully shared embed to Discord!`);
				})
				.catch((error) => {
					console.log(error);
					new Notice(
						`Failed to share embed to Discord. ${error.message}.`
					);
				});
		} else {
			console.log("Failed to create embed.");
		}
	}

	public async shareFileTitle(title: string) {
		const webhookClient = new WebhookClient({
			url: this.plugin.getSettingValue("discordWebhookURL") || "",
		});

		webhookClient
			.send({
				content: `**${title}**`,
				username: this.getDiscordBotUsername(),
				avatarURL: this.getDiscordBotAvatarURL(),
			})
			.then((data) => {
				new Notice(`Successfully shared ${title} to Discord!`);
			})
			.catch((error) => {
				new Notice(
					`Failed to share ${title} to Discord. ${error.message}.`
				);
			});
	}

	private getDiscordBotUsername() {
		const customBotUsername =
			this.plugin.getSettingValue("customBotUsername");
		if (customBotUsername) {
			return customBotUsername;
		}
		return DiscordWebhookUsername;
	}

	private getDiscordBotAvatarURL() {
		const customBotAvatarURL =
			this.plugin.getSettingValue("customBotAvatarURL");
		if (customBotAvatarURL) {
			return customBotAvatarURL;
		}
		return DiscordWebhookAvatarURL;
	}
}
