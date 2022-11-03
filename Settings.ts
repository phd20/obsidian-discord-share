import DiscordSharePlugin from "main";
import { PluginSettingTab, Setting } from "obsidian";

export interface ISettingsOptions {
	discordWebhookURL: string;
	attachmentsFolder: string;
	localSuggestionsLimit: number;
	showPreviewInLocalModal: boolean;
}

export type PartialSettings = Partial<ISettingsOptions>;

export const INITIAL_SETTINGS: ISettingsOptions = {
	discordWebhookURL: "",
	attachmentsFolder: "",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
};

export const DEFAULT_VALUES: PartialSettings = {
	discordWebhookURL: "",
	attachmentsFolder: "/",
	localSuggestionsLimit: 10,
	showPreviewInLocalModal: true,
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
		console.log("Saved the settings!");
	}

	display() {
		const { containerEl } = this;
		let {
			discordWebhookURL,
			attachmentsFolder,
			localSuggestionsLimit,
			showPreviewInLocalModal,
		} = this.plugin.settings;
		containerEl.empty();

		this.createHeader("Discord Share", "Share vault contents to Discord.");

		// Banner height
		new Setting(containerEl)
			.setName("Discord Webhook URL")
			.setDesc("Get this value from Discord")
			.addText((text) =>
				text
					.setPlaceholder("Enter your webhook URL")
					.setValue(discordWebhookURL)
					.onChange(async (val) =>
						this.saveSettings({ discordWebhookURL: val })
					)
			);

		// Show preview images in local image modal
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

		// Limit of suggestions in local image modal
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

		// Search in a specific folder for banners
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
					.setPlaceholder(DEFAULT_VALUES.attachmentsFolder!)
					.onChange(async (val) =>
						this.saveSettings({ attachmentsFolder: val })
					)
			);
	}

	private createHeader(text: string, desc: string = "") {
		const header = this.containerEl.createDiv({
			cls: "setting-item setting-item-heading banner-setting-header",
		});
		header.createEl("p", { text, cls: "banner-setting-header-title" });
		if (desc) {
			header.createEl("p", {
				text: desc,
				cls: "banner-setting-header-description",
			});
		}
	}
}
