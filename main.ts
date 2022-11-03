import { EmbedBuilder, WebhookClient } from "discord.js";
import DiscordManager from "DiscordManager";
import LocalImageModal from "LocalImageModal";
import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Workspace,
} from "obsidian";
import SettingsTab, { DEFAULT_VALUES, INITIAL_SETTINGS, ISettingsOptions, PartialSettings } from "Settings";

// Remember to rename these classes and interfaces!

export default class DiscordSharePlugin extends Plugin {
	settings: ISettingsOptions;
	discordManager: DiscordManager;
	workspace: Workspace;

	async onload() {
		this.settings = Object.assign({}, INITIAL_SETTINGS, await this.loadData());
		this.discordManager = new DiscordManager(this);
		this.addSettingTab(new SettingsTab(this));
		this.workspace = this.app.workspace;

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"dice",
			"Sample Plugin",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice("Hello you!");
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
				const file = this.workspace.getActiveFile()!;
				if (checking) {
					return !!file;
				}
				new LocalImageModal(this, file).open();
			  }
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	onunload() {}

	// Helper to get setting value (or the default setting value if not set)
	getSettingValue<K extends keyof ISettingsOptions>(key: K): PartialSettings[K] {
		return this.settings[key] ?? DEFAULT_VALUES[key];
	  }
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
