import DiscordManager from "src/discord/DiscordManager";
import LocalImageModal from "src/LocalImageModal";
import {
	Editor,
	FileSystemAdapter,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	Workspace,
} from "obsidian";
import SettingsTab, {
	DEFAULT_VALUES,
	INITIAL_SETTINGS,
	ISettingsOptions,
	PartialSettings,
} from "src/Settings";
import DiscordHelper from "./discord/DiscordHelper";
import { DiscordEmbedParams } from "./discord/types";
import { WebhookURLModal } from "./WebhookURLModal";

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

		let file: TFile | null = null;
		let fileContents: string | null = null;

		this.app.workspace.on('active-leaf-change', async () => {
			console.log('Active leaf changed...')
			file = this.workspace.getActiveFile();
			fileContents = file instanceof TFile ? await this.app.vault.read(file) : null;
		})

		this.addCommand({
			id: "discord:share-attachment",
			name: "Share Attachment to Discord",
			checkCallback: (checking) => {
				const discordWebhookURLSet =
					this.getSettingValue("discordWebhookURL");
				if (checking) {
					return (discordWebhookURLSet !== undefined && discordWebhookURLSet.length > 0);
				}
				new WebhookURLModal(this, (url: string) => {
					new LocalImageModal(this, url).open();
				}).open();
			},
		});

		this.addCommand({
			id: "discord:share-current-note-properties",
			name: "Share Current Note to Discord (Properties)",
			checkCallback: (checking) => {
				const discordWebhookURLSet =
					this.getSettingValue("discordWebhookURL");
				const file = this.workspace.getActiveFile();
				if (checking) {
					return !!file && (discordWebhookURLSet !== undefined && discordWebhookURLSet.length > 0);
				}
				if (file instanceof TFile) {
					const params =
						this.discordHelper.buildDiscordEmbedParamsFromFile(
							file,
							this.settings,
						);
					if (!params) {
						new Notice(
							`Failed to build Discord embed params from file ${file.name}.`
						);
						return;
					}
					new WebhookURLModal(this, (url: string) => {
						this.discordManager.shareEmbed(params, url);
					}).open();
				} else {
					new Notice("No active file found.");
				}
			},
		});

		this.addCommand({
			id: "discord:share-current-note-content",
			name: "Share Current Note to Discord (Content)",
			checkCallback: (checking) => {
				const discordWebhookURLSet =
					this.getSettingValue("discordWebhookURL");
				if (checking) {
					return !!file && (discordWebhookURLSet !== undefined && discordWebhookURLSet.length > 0);
				}
				if (file instanceof TFile) {
					const params: Partial<DiscordEmbedParams> = {
						title: file.basename,
						description: fileContents || "",
					};
					if (!params) {
						new Notice(
							`Failed to build Discord embed params from file ${file.name}.`
						);
						return;
					}
					new WebhookURLModal(this, (url: string) => {
						this.discordManager.shareEmbed(params, url);
					}).open();
				} else {
					new Notice("No active file found.");
				}
			}
		})

		this.addCommand({
			id: "discord:share-selection",
			name: "Share Selection to Discord",
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				const discordWebhookURLSet =
					this.getSettingValue("discordWebhookURL");
				if (checking) {
					return (editor.somethingSelected() && (discordWebhookURLSet !== undefined && discordWebhookURLSet.length > 0))
				}
				const selection = editor.getSelection().trim();
				const params: Partial<DiscordEmbedParams> = {
					description: selection,
				};
				new WebhookURLModal(this, (url: string) => {
					this.discordManager.shareEmbed(params, url);
				}).open();
			},
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				const discordWebhookURLSet =
					this.getSettingValue("discordWebhookURL");
				if (!(this.app.vault.adapter instanceof FileSystemAdapter))
					return;
				if (!(discordWebhookURLSet !== undefined && discordWebhookURLSet.length > 0) || !editor.somethingSelected())
					return;
				const selection = editor.getSelection().trim();

				menu.addItem((item) => {
					item.setTitle("Share selection to Discord").onClick(
						async () => {
							const params: Partial<DiscordEmbedParams> = {
								description: selection,
							};
							new WebhookURLModal(this, (url: string) => {
								this.discordManager.shareEmbed(params, url);
							}).open();
						}
					);
				});
			})
		);
	}

	onunload() {}

	getSettingValue<K extends keyof ISettingsOptions>(
		key: K
	): PartialSettings[K] {
		return this.settings[key] ?? DEFAULT_VALUES[key];
	}
}
