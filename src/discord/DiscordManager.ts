import {
	AttachmentBuilder,
	ColorResolvable,
	EmbedBuilder,
	WebhookClient,
} from "discord.js";
import DiscordSharePlugin from "src/main";
import { FileSystemAdapter, MetadataCache, Notice, Vault } from "obsidian";
import { DiscordWebhookAvatarURL, DiscordWebhookUsername } from "./constants";
import DiscordHelper from "./DiscordHelper";
import { DiscordEmbedParams } from "./types";
import { isValidUrl } from "src/util/url";

export default class DiscordManager {
	plugin: DiscordSharePlugin;
	metadata: MetadataCache;
	vault: Vault;
	client: WebhookClient;
	discordHelper: DiscordHelper;
	adapter: FileSystemAdapter;

	constructor(plugin: DiscordSharePlugin) {
		this.plugin = plugin;
		this.metadata = plugin.app.metadataCache;
		this.vault = plugin.app.vault;
		this.discordHelper = plugin.discordHelper;
		this.adapter = plugin.app.vault.adapter as FileSystemAdapter;
	}

	public async shareAttachment(
		filePath: string,
		fileName: string,
		url: string
	) {
		const RequestEntityTooLargeErrorCode = "Request entity too large";
		const webhookClient = new WebhookClient({
			url: url,
		});

		try {
			await webhookClient
				.send({
					files: [
						{
							attachment: filePath,
							name: fileName,
						},
					],
					username: this.getDiscordBotUsername(),
					avatarURL: this.getDiscordBotAvatarURL(),
				});
			new Notice(`Successfully shared ${fileName} to Discord!`);
		}
		catch (error) {
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
		}
	}

	public async shareEmbed(params: Partial<DiscordEmbedParams>, url: string) {
		const webhookClient = new WebhookClient({
			url: url,
		});

		if (!params) {
			console.log("shareEmbed() called with null or undefined params.");
		}

		const embedBuilder = new EmbedBuilder()
			.setColor(
				(params.color as ColorResolvable) ||
					(this.plugin.getSettingValue(
						"embedColor"
					) as ColorResolvable) ||
					null
			)
			.setTitle(params.title || null)
			.setURL(params.url || null)
			.setAuthor(params.author || null)
			.setDescription(params.description || null)
			.setImage(
				params.image && isValidUrl(params.image) ? params.image : null
			)
			.setThumbnail(params.thumbnail || null)
			.setFooter(params.footer || null)
			.setTimestamp();

		if (params.fields) {
			embedBuilder.addFields(...params.fields);
		}

		let attachmentFile;
		if (params.image) {
			attachmentFile = this.metadata.getFirstLinkpathDest(
				(params.image && params.image[0][0]) || "", // This is dumb but works for now.
				params.file?.path || ""
			);
		}

		let attachment = undefined;
		if (attachmentFile) {
			embedBuilder.setImage(`attachment://${attachmentFile.name}`);
			const attachmentFullPath = this.adapter.getFullPath(
				attachmentFile.path
			);
			attachment = new AttachmentBuilder(attachmentFullPath);
		}

		try {
			await webhookClient
					.send({
						username: this.getDiscordBotUsername(),
						avatarURL: this.getDiscordBotAvatarURL(),
						embeds: [embedBuilder],
						files: attachment ? [attachment] : [],
					});
			new Notice(`Successfully shared embed to Discord!`);
		}
		catch (error) {
			console.log(error);
			new Notice(
				`Failed to share embed to Discord. ${error.message}.`
			);
		}
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
