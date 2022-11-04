import DiscordManager from "DiscordManager";
import LocalImageModal from "LocalImageModal";
import { Plugin, Workspace } from "obsidian";
import SettingsTab, {
	DEFAULT_VALUES,
	INITIAL_SETTINGS,
	ISettingsOptions,
	PartialSettings,
} from "Settings";

export default class DiscordSharePlugin extends Plugin {
	settings: ISettingsOptions;
	discordManager: DiscordManager;
	workspace: Workspace;

	async onload() {
		this.settings = Object.assign(
			{},
			INITIAL_SETTINGS,
			await this.loadData()
		);
		this.discordManager = new DiscordManager(this);
		this.addSettingTab(new SettingsTab(this));
		this.workspace = this.app.workspace;

		const ribbonIconEl = this.addRibbonIcon(
			"radio",
			"Send Attachment to Discord",
			(evt: MouseEvent) => {
				new LocalImageModal(this).open();
			}
		);

		this.addCommand({
			id: "discord:send-attachment",
			name: "Send Attachment to Discord",
			callback: () => {
				new LocalImageModal(this).open();
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
