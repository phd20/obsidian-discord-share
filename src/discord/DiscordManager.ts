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
import { ISettingsOptions } from "src/Settings";
import { WebhookURLModal } from "src/WebhookURLModal";

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
		fileName: string
	) {
		const RequestEntityTooLargeErrorCode = "Request entity too large";
		const settings = this.plugin.settings;

		const url = await this.getWebhookURL(settings);
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
					username: this.plugin.getSettingValue("customBotUsername") || DiscordWebhookUsername,
					avatarURL: this.plugin.getSettingValue("customBotAvatarURL") || DiscordWebhookAvatarURL,
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

	public async shareEmbed(params: Partial<DiscordEmbedParams>, settings: ISettingsOptions) {
		const { embedDefaultValues } = settings;
		const { embedDefaultAuthor, embedDefaultFooter } = embedDefaultValues;

		if (!params) {
			console.log("shareEmbed() called with null or undefined params.");
		}

		const embedBuilder = new EmbedBuilder()
			.setColor(
				(params.color as ColorResolvable) ||
				(embedDefaultValues.embedDefaultColor as ColorResolvable) ||
				null
			)
			.setTitle(params.title || embedDefaultValues.embedDefaultTitle || null)
			.setURL(params.url || embedDefaultValues.embedDefaultURL || null)
			.setAuthor(
				params.author ? params.author :
					Object.values(embedDefaultAuthor).every((value) => value) ? embedDefaultAuthor :
					null
			)
			.setDescription(params.description || embedDefaultValues.embedDefaultDescription || null)
			.setImage(
				(params.image && isValidUrl(params.image)) ? params.image 
					: (embedDefaultValues.embedDefaultImage && isValidUrl(embedDefaultValues.embedDefaultImage)) ? embedDefaultValues.embedDefaultImage
					: null
			)
			.setThumbnail(params.thumbnail || embedDefaultValues.embedDefaultThumbnail || null)
			.setFooter(
				params.footer ? params.footer :
					Object.values(embedDefaultFooter).every((value) => value) ? embedDefaultFooter : 
					null
			)
			.setTimestamp();

		if (params.fields) {
			embedBuilder.addFields(...params.fields);
		} else if (embedDefaultValues.embedDefaultFields) {
			embedBuilder.addFields(...embedDefaultValues.embedDefaultFields);
		}

		let attachmentFile;
		if (params.image) {
			attachmentFile = this.metadata.getFirstLinkpathDest(
				(params.image && params.image[0][0]) || "", // This is dumb but works for now.
				params.file?.path || ""
			);
		} else if (embedDefaultValues.embedDefaultImage) {
			attachmentFile = this.metadata.getFirstLinkpathDest(
				(embedDefaultValues.embedDefaultImage && embedDefaultValues.embedDefaultImage[0][0]) || "", // This is dumb but works for now.
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
		const url = await this.getWebhookURL(settings);

		const webhookClient = new WebhookClient({
			url: url,
		});

		try {
			await webhookClient
					.send({
						username: settings.customBotUsername || DiscordWebhookUsername,
						avatarURL: settings.customBotAvatarURL || DiscordWebhookAvatarURL,
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

	private async getWebhookURL(settings: ISettingsOptions): Promise<string> {
		return new Promise((resolve) => {
			if (settings.discordWebhookURL.length > 1) {
				new WebhookURLModal(this.plugin, (webhookURL) => {
					resolve(webhookURL);
				}).open();
			} else {
				resolve(settings.discordWebhookURL[0].url);
			}
		});
	}
}
