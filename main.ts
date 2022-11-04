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

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"radio",
			"Send Attachment to Discord",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new LocalImageModal(this).open();
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		this.addCommand({
			id: "discord:send-attachment",
			name: "Send Attachment to Discord",
			checkCallback: (checking) => {
				const file = this.workspace.getActiveFile();
				if (checking) {
					return !!file;
				}
				new LocalImageModal(this).open();
			},
		});
	}

	onunload() {}

	// Helper to get setting value (or the default setting value if not set)
	getSettingValue<K extends keyof ISettingsOptions>(
		key: K
	): PartialSettings[K] {
		return this.settings[key] ?? DEFAULT_VALUES[key];
	}
}
