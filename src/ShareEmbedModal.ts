import { ButtonComponent, Modal, Setting, TFile } from "obsidian";
import DiscordSharePlugin from "./main";
import { DiscordEmbedParams } from "./discord/types";

export class ShareEmbedModal extends Modal {
    plugin: DiscordSharePlugin;
	params: Partial<DiscordEmbedParams>;
	discordWebhookURL: string;

    constructor(
		plugin: DiscordSharePlugin,
		params: Partial<DiscordEmbedParams>
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.params = params;
	}

    onOpen() {
		const { contentEl } = this;

		const DEFAULT_VALUES: DiscordEmbedParams = {
			color: this.params.color || "",
			title: this.params.title || "",
    		url: this.params.url || "",
    		author: this.params.author ||  { name: "", iconURL: "", url: "" },
			description: this.params.description || "",
			thumbnail: this.params.thumbnail || "",
			fields: this.params.fields || [{ name: "", value: "", inline: true }],
			image: this.params.image || "",
			footer: this.params.footer || { text: "", iconURL: "" },
			file: this.params.file
		}

        contentEl.createEl("h1", { text: "Share Embed to Discord" });

		new Setting(contentEl)
			.setName("Discord Webhook URL")
			.addText((text) =>
				text
					.onChange((value) => {
						this.discordWebhookURL = value
					}));

        new Setting(contentEl)
			.setName("Title")
			.addText((text) =>
				text
					.setValue(DEFAULT_VALUES.title)
					.onChange((value) => {
						this.params.title = value
					}));

		new Setting(contentEl)
			.setName("Description")
			.addTextArea((text) =>
				text
					.setValue(DEFAULT_VALUES.description)
					.onChange((value) => {
						this.params.description = value
					}));

		new ButtonComponent(contentEl)
				.setButtonText("Send to Discord")
				.onClick(() => 
				{
					this.plugin.discordManager.shareEmbed(this.params, this.discordWebhookURL);
					this.close();
				})
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}