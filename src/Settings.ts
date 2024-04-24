import DiscordSharePlugin from "src/main";
import { PluginSettingTab, Setting } from "obsidian";
import { DiscordEmbedAuthor, DiscordEmbedDescription, DiscordEmbedFields, DiscordEmbedFooter, DiscordEmbedImage, DiscordEmbedThumbnail, DiscordEmbedTitle, DiscordEmbedURL, DiscordWebhookUsername } from "./discord/constants";
import { DiscordWebhook } from "./WebhookURLModal";

export interface ISettingsOptions {
	discordWebhookURL: DiscordWebhook[];
	attachmentsFolder: string;
	localSuggestionsLimit: number;
	showPreviewInLocalModal: boolean;
	customBotUsername: string;
	customBotAvatarURL: string;
	useNoteTitleForEmbed: boolean;
	embedTitle: string;
	embedColor: string;
	embedURL: string;
	embedAuthor: string;
	embedDescription: string;
	embedThumbnail: string;
	embedFields: string;
	embedImage: string;
	embedFooter: string;
	enableEmbedBuilder: boolean;
}

export type PartialSettings = Partial<ISettingsOptions>;

export const INITIAL_SETTINGS: ISettingsOptions = {
	discordWebhookURL: [],
	attachmentsFolder: "",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
	customBotUsername: "",
	customBotAvatarURL: "",
	useNoteTitleForEmbed: false,
	embedTitle: "",
	embedColor: "",
	embedURL: "",
	embedAuthor: "",
	embedDescription: "",
	embedThumbnail: "",
	embedFields: "",
	embedImage: "",
	embedFooter: "",
	enableEmbedBuilder: false,
};

export const DEFAULT_VALUES: PartialSettings = {
	discordWebhookURL: [],
	attachmentsFolder: "/",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
	customBotUsername: "",
	customBotAvatarURL: "",
	useNoteTitleForEmbed: false,
	embedTitle: "",
	embedColor: "",
	embedURL: "",
	embedAuthor: "",
	embedDescription: "",
	embedThumbnail: "",
	embedFields: "",
	embedImage: "",
	embedFooter: "",
	enableEmbedBuilder: false,
};

export default class SettingsTab extends PluginSettingTab {
	plugin: DiscordSharePlugin;

	constructor(plugin: DiscordSharePlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
		this.containerEl.addClass("discord-share-settings");
	}

	async saveSettings(changed: PartialSettings) {
		this.plugin.settings = { ...this.plugin.settings, ...changed };
		await this.plugin.saveData(this.plugin.settings);
	}

	display() {
		const { containerEl } = this;
		const {
			discordWebhookURL,
			attachmentsFolder,
			localSuggestionsLimit,
			showPreviewInLocalModal,
			customBotUsername,
			customBotAvatarURL,
			useNoteTitleForEmbed,
			embedTitle,
			embedColor,
			embedURL,
			embedAuthor,
			embedDescription,
			embedThumbnail,
			embedFields,
			embedImage,
			embedFooter,
			enableEmbedBuilder,
		} = this.plugin.settings;
		containerEl.empty();

		this.createHeader("Discord Share", "Share vault contents to Discord.");

		this.createHeader("Discord", "Connection settings for Discord.");

		let webhookName: string;
		let webhookURL: string;

		new Setting(containerEl)
			.setName("Discord Webhook URL")
			.setDesc("Get this value from Discord")
			.addText((text) =>
				text
					.setPlaceholder("Enter channel name")
					.onChange(async (val) => (webhookName = val))
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your webhook URL")
					.onChange(async (val) => (webhookURL = val))
			)
			.addExtraButton((b) => {
				b.setIcon("plus-with-circle").onClick(async () => {
					const modernDiscordWebhookUrl = this.getModernDiscordWebhookUrl(webhookURL);
					await this.saveSettings({
						discordWebhookURL: [
							...discordWebhookURL,
							{ description: webhookName, url: modernDiscordWebhookUrl },
						],
					});
					this.display();
				});
			});

		const webhooks = containerEl.createDiv("additional");
		discordWebhookURL.forEach((webhook) => {
			new Setting(webhooks)
				.setName(webhook.description)
				.setClass("discord-webhook-setting")
				.addExtraButton((b) =>
					b.setIcon("trash").onClick(async () => {
						await this.saveSettings({
							discordWebhookURL: [
								...discordWebhookURL.filter(
									(f) => discordWebhookURL.indexOf(f) != discordWebhookURL.indexOf(webhook)
								),
							],
						});
						this.display();
					})
				);
		});

		new Setting(containerEl)
			.setName("Custom Discord Bot Username")
			.setDesc(
				`The username of the bot that will share to Discord. The default is "${DiscordWebhookUsername}".`
			)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter a custom username for this Discord bot."
					)
					.setValue(customBotUsername)
					.onChange(async (val) =>
						this.saveSettings({ customBotUsername: val })
					)
			);

		new Setting(containerEl)
			.setName("Custom Discord Bot Avatar")
			.setDesc(
				`The url of a custom avatar to use with this Discord bot. If empty, the Obsidian logo will be used.`
			)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the url of a custom avatar to use with this Discord bot."
					)
					.setValue(customBotAvatarURL)
					.onChange(async (val) =>
						this.saveSettings({ customBotAvatarURL: val })
					)
			);
		
		new Setting(containerEl)
			.setName("Enable Embed Builder")
			.setDesc("When enabled, the plugin will open a modal to configure embed values before sending to Discord.")
			.addToggle((toggle) =>
				toggle
					.setTooltip("Enable manual embed builder")
					.setValue(enableEmbedBuilder)
					.onChange(async (val) =>
						this.saveSettings({ enableEmbedBuilder: val })
					));

		// Embed Settings

		this.createHeader(
			"Share Current Note to Discord (Properties)",
			"Property settings for building Discord embeds."
		);

		new Setting(containerEl)
			.setName("Use Note Title for Embed Title")
			.setDesc("When enabled, the plugin will use the note's title as the embed's title. This will override the Embed Title setting.")
			.addToggle((toggle) =>
				toggle
					.setTooltip("Default to Note title")
					.setValue(useNoteTitleForEmbed)
					.onChange(async (val) =>
						this.saveSettings({ useNoteTitleForEmbed: val })
					));

		new Setting(containerEl)
			.setName("Embed Title Property")
			.setDesc(`Which frontmatter property to use for the embed's title. If left blank, will default to: ${DiscordEmbedTitle}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for title."
					)
					.setValue(embedTitle)
					.onChange(async (val) =>
						this.saveSettings({ embedTitle: val })
					));

		new Setting(containerEl)
			.setName("Embed Color Property")
			.setDesc(`The default color for embeds.`)
			.addColorPicker((colComp) => {
				colComp
					.setValue(embedColor)
					.onChange(async (val) =>
						this.saveSettings({ embedColor: val })
					);
			});

		new Setting(containerEl)
			.setName("Embed URL Property")
			.setDesc(`Which frontmatter property to use for the embed's URL. If left blank, will default to: ${DiscordEmbedURL}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for URL."
					)
					.setValue(embedURL)
					.onChange(async (val) =>
						this.saveSettings({ embedURL: val })
					));

		new Setting(containerEl)
			.setName("Embed Author Property")
			.setDesc(`Which frontmatter property to use for the embed's author. If left blank, will default to: ${DiscordEmbedAuthor}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for author."
					)
					.setValue(embedAuthor)
					.onChange(async (val) =>
						this.saveSettings({ embedAuthor: val })
					));

		new Setting(containerEl)
			.setName("Embed Description Property")
			.setDesc(`Which frontmatter property to use for the embed's description. If left blank, will default to: ${DiscordEmbedDescription}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for description."
					)
					.setValue(embedDescription)
					.onChange(async (val) =>
						this.saveSettings({ embedDescription: val })
					));

		new Setting(containerEl)
			.setName("Embed Thumbnail Property")
			.setDesc(`Which frontmatter property to use for the embed's thumbnail. If left blank, will default to: ${DiscordEmbedThumbnail}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for thumbnail."
					)
					.setValue(embedThumbnail)
					.onChange(async (val) =>
						this.saveSettings({ embedThumbnail: val })
					));

		new Setting(containerEl)
			.setName("Embed Fields Property")
			.setDesc(`Which frontmatter property to use for the embed's fields. If left blank, will default to: ${DiscordEmbedFields}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for fields."
					)
					.setValue(embedFields)
					.onChange(async (val) =>
						this.saveSettings({ embedFields: val })
					));

		new Setting(containerEl)
			.setName("Embed Image Property")
			.setDesc(`Which frontmatter property to use for the embed's image. If left blank, will default to: ${DiscordEmbedImage}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for image."
					)
					.setValue(embedImage)
					.onChange(async (val) =>
						this.saveSettings({ embedImage: val })
					));

		new Setting(containerEl)
			.setName("Embed Footer Property")
			.setDesc(`Which frontmatter property to use for the embed's footer. If left blank, will default to: ${DiscordEmbedFooter}.`)
			.addText((text) =>
				text
					.setPlaceholder(
						"Enter the name of the frontmatter to use for footer."
					)
					.setValue(embedFooter)
					.onChange(async (val) =>
						this.saveSettings({ embedFooter: val })
					));

		// Vault Settings

		this.createHeader("Vault Settings", "Settings related to your vault.");

		new Setting(containerEl)
			.setName("Attachments folder")
			.setDesc(
				createFragment((frag) => {
					frag.appendText(
						"Select a folder to exclusively search for attachment files in."
					);
					frag.createEl("br");
					frag.appendText(
						"If empty, it will search the entire vault for image files"
					);
				})
			)
			.addText((text) =>
				text
					.setValue(attachmentsFolder)
					.setPlaceholder(DEFAULT_VALUES.attachmentsFolder || "")
					.onChange(async (val) =>
						this.saveSettings({ attachmentsFolder: val })
					)
			);

		this.createHeader(
			"Local Image Search",
			"Settings for the local image search modal."
		);

		new Setting(containerEl)
			.setName("Show preview images")
			.setDesc(
				"Enabling this will display a preview of the images suggested"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(showPreviewInLocalModal)
					.onChange(async (val) =>
						this.saveSettings({ showPreviewInLocalModal: val })
					)
			);

		new Setting(containerEl)
			.setName("Suggestions limit")
			.setDesc(
				createFragment((frag) => {
					frag.appendText(
						"Show up to this many suggestions when searching through local images."
					);
					frag.createEl("br");
					frag.createEl("b", { text: "NOTE: " });
					frag.appendText("Using a high number while ");
					frag.createEl("span", {
						text: "Show preview images ",
						attr: { style: "color: var(--text-normal)" },
					});
					frag.appendText("is on can lead to some slowdowns");
				})
			)
			.addText((text) => {
				text.inputEl.type = "number";
				text.setValue(`${localSuggestionsLimit}`);
				text.setPlaceholder(`${DEFAULT_VALUES.localSuggestionsLimit}`);
				text.onChange(async (val) =>
					this.saveSettings({
						localSuggestionsLimit: val ? parseInt(val) : 10,
					})
				);
			});
	}

	private createHeader(text: string, desc = "") {
		const header = this.containerEl.createDiv({
			cls: "setting-item setting-item-heading discord-share-setting-header",
		});
		header.createEl("p", {
			text,
			cls: "discord-share-setting-header-title",
		});
		if (desc) {
			header.createEl("p", {
				text: desc,
				cls: "discord-share-setting-header-description",
			});
		}
	}

	private getModernDiscordWebhookUrl(url: string) {
		const oldDomain = "discordapp.com";
		const domain = "discord.com";
		return url.replace(oldDomain, domain);
	}
}
