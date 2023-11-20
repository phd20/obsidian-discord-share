import DiscordSharePlugin from "src/main";
import { PluginSettingTab, Setting } from "obsidian";
import { DiscordWebhookUsername } from "./discord/constants";
import { DiscordWebhook } from "./WebhookURLModal";

export interface ISettingsOptions {
	discordWebhookURL: DiscordWebhook[];
	attachmentsFolder: string;
	localSuggestionsLimit: number;
	showPreviewInLocalModal: boolean;
	customBotUsername: string;
	customBotAvatarURL: string;
	embedColor: string;
}

export type PartialSettings = Partial<ISettingsOptions>;

export const INITIAL_SETTINGS: ISettingsOptions = {
	discordWebhookURL: [],
	attachmentsFolder: "",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
	customBotUsername: "",
	customBotAvatarURL: "",
	embedColor: "",
};

export const DEFAULT_VALUES: PartialSettings = {
	discordWebhookURL: [],
	attachmentsFolder: "/",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
	customBotUsername: "",
	customBotAvatarURL: "",
	embedColor: "",
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
			embedColor,
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
					await this.saveSettings({
						discordWebhookURL: [
							...discordWebhookURL,
							{ description: webhookName, url: webhookURL },
						],
					});
					this.display();
				});
			});

		const webhooks = containerEl.createDiv("additional");
		discordWebhookURL.forEach((webhook) => {
			new Setting(webhooks)
				.setName(webhook.description)
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

		this.createHeader(
			"Discord Embeds",
			"Embed default settings for Discord."
		);

		new Setting(containerEl)
			.setName("Embed Color")
			.setDesc(`The default color for embeds.`)
			.addColorPicker((colComp) => {
				colComp
					.setValue(embedColor)
					.onChange(async (val) =>
						this.saveSettings({ embedColor: val })
					);
			});

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
}
