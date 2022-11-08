import {
	EmbedBuilder,
	WebhookClient,
} from "discord.js";
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

	public async shareEmbedTest() {
		const webhookClient = new WebhookClient({
			url: this.plugin.getSettingValue("discordWebhookURL") || "",
		});

		const embed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle("Some title")
			.setURL("https://discord.js.org/")
			.setAuthor({
				name: "Some name",
				iconURL: "https://i.imgur.com/AfFp7pu.png",
				url: "https://discord.js.org",
			})
			.setDescription(
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
			)
			.setThumbnail("https://i.imgur.com/AfFp7pu.png")
			.addFields(
				{
					name: "Regular field title",
					value: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
				},
				{ name: "\u200B", value: "\u200B" },
				{
					name: "Inline field title",
					value: "Some value here",
					inline: true,
				},
				{
					name: "Inline field title",
					value: "Some value here",
					inline: true,
				}
			)
			.addFields({
				name: "Inline field title",
				value: "Some value here",
				inline: true,
			})
			.setImage("https://i.imgur.com/AfFp7pu.png")
			.setTimestamp()
			.setFooter({
				text: "Some footer text here",
				iconURL: "https://i.imgur.com/AfFp7pu.png",
			});

		webhookClient.send({
			username: this.getDiscordBotUsername(),
			avatarURL: this.getDiscordBotAvatarURL(),
			embeds: [embed],
		});
	}

	public async shareEmbed(file: TFile) {
		const webhookClient = new WebhookClient({
			url: this.plugin.getSettingValue("discordWebhookURL") || "",
		});

		const embed = this.discordHelper.buildEmbedFromFile(file);
		if (embed instanceof EmbedBuilder) {
			webhookClient.send({
				username: this.getDiscordBotUsername(),
				avatarURL: this.getDiscordBotAvatarURL(),
				embeds: [embed],
			});
		} else {
			console.log("Failed to create embed.")
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
