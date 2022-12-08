import DiscordManager from "src/discord/DiscordManager";
import LocalImageModal from "src/LocalImageModal";
import { Notice, Plugin, TFile, Workspace } from "obsidian";
import SettingsTab, {
	DEFAULT_VALUES,
	INITIAL_SETTINGS,
	ISettingsOptions,
	PartialSettings,
} from "src/Settings";
import DiscordHelper from "./discord/DiscordHelper";

export default class DiscordSharePlugin extends Plugin {
	settings: ISettingsOptions;
	discordManager: DiscordManager;
	discordHelper: DiscordHelper;
	workspace: Workspace;

	async onload() {
		this.settings = Object.assign(
			{},
			INITIAL_SETTINGS,
			await this.loadData()
		);
		this.discordHelper = new DiscordHelper(this);
		this.discordManager = new DiscordManager(this);
		this.addSettingTab(new SettingsTab(this));
		this.workspace = this.app.workspace;

		this.addCommand({
			id: "discord:share-attachment",
			name: "Share Attachment to Discord",
			checkCallback: (checking) => {
				const discordWebhookURLSet =
					this.getSettingValue("discordWebhookURL");
				if (checking) {
					return !!discordWebhookURLSet;
				}
				new LocalImageModal(this).open();
			},
		});

		this.addCommand({
			id: "discord:share-embed",
			name: "Share Embed to Discord",
			checkCallback: (checking) => {
				const discordWebhookURLSet =
					this.getSettingValue("discordWebhookURL");
				const file = this.workspace.getActiveFile();
				if (checking) {
					return !!file && !!discordWebhookURLSet;
				}
				if (file instanceof TFile) {
					const params = this.discordHelper.buildDiscordEmbedParamsFromFile(file);
					if (!params) {
						new Notice(`Failed to build Discord embed params from file ${file.name}.`);
						return;
					}
					this.discordManager.shareEmbed(params);
				} else {
					new Notice("No active file found.");
				}
			},
		});
	}

	onunload() {}

	getSettingValue<K extends keyof ISettingsOptions>(
		key: K
	): PartialSettings[K] {
		return this.settings[key] ?? DEFAULT_VALUES[key];
	}
}
