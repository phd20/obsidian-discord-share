import { SuggestModal } from "obsidian";
import DiscordSharePlugin from "./main";

export interface DiscordWebhook {
	description: string;
	url: string;
}

export class WebhookURLModal extends SuggestModal<DiscordWebhook> {
	plugin: DiscordSharePlugin;

	resolve: (url: string) => void;

	constructor(plugin: DiscordSharePlugin, resolve: (url: string) => void) {
		super(plugin.app);
		this.plugin = plugin;
		this.resolve = resolve;
	}

	getSuggestions(
		query: string
	): DiscordWebhook[] | Promise<DiscordWebhook[]> {
		return (
			this.plugin
				.getSettingValue("discordWebhookURL")
				?.filter((webhook) =>
					webhook.description
						.toLowerCase()
						.includes(query.toLowerCase())
				) || []
		);
	}

	renderSuggestion(value: DiscordWebhook, el: HTMLElement) {
		el.createEl("div", { text: value.description });
	}

	onChooseSuggestion(item: DiscordWebhook, evt: MouseEvent | KeyboardEvent) {
		this.resolve(item.url);
	}
}
