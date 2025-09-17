import DiscordSharePlugin from "src/main";
import { FileSystemAdapter, MetadataCache, Notice, TFile, Vault } from "obsidian";
import { DiscordWebhookAvatarURL, DiscordWebhookUsername } from "./constants";
import DiscordHelper from "./DiscordHelper";
import { DiscordEmbedParams } from "./types";
import { isValidUrl } from "src/util/url";
import { ISettingsOptions } from "src/Settings";
import { WebhookURLModal } from "src/WebhookURLModal";

// Discord embed field interface
interface DiscordEmbedField {
	name: string;
	value: string;
	inline?: boolean;
}

// Discord embed author interface
interface DiscordEmbedAuthor {
	name: string;
	url?: string;
	icon_url?: string;
}

// Discord embed footer interface
interface DiscordEmbedFooter {
	text: string;
	icon_url?: string;
}

// Discord embed interface matching Discord API format
interface DiscordEmbed {
	title?: string;
	description?: string;
	url?: string;
	timestamp?: string;
	color?: number;
	footer?: DiscordEmbedFooter;
	image?: { url: string };
	thumbnail?: { url: string };
	author?: DiscordEmbedAuthor;
	fields?: DiscordEmbedField[];
}

// Discord webhook payload interface
interface DiscordWebhookPayload {
	content?: string;
	username?: string;
	avatar_url?: string;
	embeds?: DiscordEmbed[];
}

export default class DiscordManager {
	plugin: DiscordSharePlugin;
	metadata: MetadataCache;
	vault: Vault;
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
		const settings = this.plugin.settings;

		const url = await this.getWebhookURL(settings);

		try {
			let fileBuffer: ArrayBuffer;
			
			// First try to find the file in the vault using the path as-is
			let file = this.vault.getAbstractFileByPath(filePath);
			
			// If not found, try treating it as a relative path from attachments
			if (!file && !filePath.startsWith('attachments/') && filePath.includes('attachments/')) {
				const relativePath = filePath.substring(filePath.indexOf('attachments/'));
				file = this.vault.getAbstractFileByPath(relativePath);
			}
			
			// If still not found, try just the filename in attachments folder
			if (!file) {
				const attachmentPath = `attachments/${fileName}`;
				file = this.vault.getAbstractFileByPath(attachmentPath);
			}
			
			if (file) {
				fileBuffer = await this.vault.readBinary(file as TFile);
			} else {
				throw new Error(`File not found: ${filePath}`);
			}
			
			// Create FormData for multipart/form-data request
			const formData = new FormData();
			
			// Add the file as a blob
			const blob = new Blob([fileBuffer]);
			formData.append('files[0]', blob, fileName);
			
			// Add webhook payload
			const payload = {
				username: this.plugin.getSettingValue("customBotUsername") || DiscordWebhookUsername,
				avatar_url: this.plugin.getSettingValue("customBotAvatarURL") || DiscordWebhookAvatarURL,
			};
			formData.append('payload_json', JSON.stringify(payload));

			const response = await fetch(url, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			new Notice(`Successfully shared ${fileName} to Discord!`);
		}
		catch (error) {
			if (error && (error.message.includes("Request entity too large") || error.message.includes("413"))) {
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

		// Build the embed object
		const embed: DiscordEmbed = {};

		// Set color (convert to number if it's a hex string)
		const color = params.color || embedDefaultValues.embedDefaultColor;
		if (color) {
			embed.color = this.convertColorToNumber(color);
		}

		// Set basic properties
		if (params.title || embedDefaultValues.embedDefaultTitle) {
			embed.title = params.title || embedDefaultValues.embedDefaultTitle;
		}

		if (params.url || embedDefaultValues.embedDefaultURL) {
			embed.url = params.url || embedDefaultValues.embedDefaultURL;
		}

		if (params.description || embedDefaultValues.embedDefaultDescription) {
			embed.description = params.description || embedDefaultValues.embedDefaultDescription;
		}

		// Set author
		if (params.author) {
			embed.author = params.author;
		} else if (Object.values(embedDefaultAuthor).every((value) => value)) {
			embed.author = embedDefaultAuthor;
		}

		// Set footer
		if (params.footer) {
			embed.footer = params.footer;
		} else if (Object.values(embedDefaultFooter).every((value) => value)) {
			embed.footer = embedDefaultFooter;
		}

		// Set thumbnail
		if (params.thumbnail || embedDefaultValues.embedDefaultThumbnail) {
			embed.thumbnail = { url: params.thumbnail || embedDefaultValues.embedDefaultThumbnail };
		}

		// Set timestamp
		embed.timestamp = new Date().toISOString();

		// Set fields
		if (params.fields) {
			embed.fields = params.fields;
		} else if (embedDefaultValues.embedDefaultFields) {
			embed.fields = embedDefaultValues.embedDefaultFields;
		}

		// Handle image attachments
		let attachmentFile;
		let imageParam = params.image;
		if (!imageParam && embedDefaultValues.embedDefaultImage) {
			imageParam = embedDefaultValues.embedDefaultImage;
		}

		// Check if image is a URL or a file reference
		if (imageParam && isValidUrl(imageParam)) {
			embed.image = { url: imageParam };
		} else if (imageParam) {
			// Handle file attachment
			attachmentFile = this.metadata.getFirstLinkpathDest(
				(imageParam && imageParam[0] && imageParam[0][0]) || "",
				params.file?.path || ""
			);
		}

		const url = await this.getWebhookURL(settings);

		try {
			let payload: DiscordWebhookPayload;
			
			if (attachmentFile) {
				// If we have an attachment, we need to use FormData
				embed.image = { url: `attachment://${attachmentFile.name}` };
				
				const fileBuffer = await this.adapter.readBinary(attachmentFile.path);
				const formData = new FormData();
				
				// Add the file as a blob
				const blob = new Blob([fileBuffer]);
				formData.append('files[0]', blob, attachmentFile.name);
				
				// Add webhook payload
				payload = {
					username: settings.customBotUsername || DiscordWebhookUsername,
					avatar_url: settings.customBotAvatarURL || DiscordWebhookAvatarURL,
					embeds: [embed],
				};
				formData.append('payload_json', JSON.stringify(payload));

				const response = await fetch(url, {
					method: 'POST',
					body: formData,
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}
			} else {
				// No attachment, send as JSON
				payload = {
					username: settings.customBotUsername || DiscordWebhookUsername,
					avatar_url: settings.customBotAvatarURL || DiscordWebhookAvatarURL,
					embeds: [embed],
				};

				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}
			}

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

	/**
	 * Convert color to Discord-compatible number format
	 * Accepts hex strings (with or without #) or numbers
	 */
	private convertColorToNumber(color: number | string | undefined): number | undefined {
		if (typeof color === 'number') {
			return color;
		}
		
		if (typeof color === 'string') {
			// Remove # if present
			const cleanColor = color.replace('#', '');
			
			// Parse hex string to number
			const parsed = parseInt(cleanColor, 16);
			
			if (!isNaN(parsed)) {
				return parsed;
			}
		}
		
		return undefined;
	}
}