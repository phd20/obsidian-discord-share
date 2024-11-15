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
	IObsoleteSettingsOptions,
	ISettingsOptions,
	PartialSettings,
	SETTINGS_VERSION,
} from "src/Settings";
import DiscordHelper from "./discord/DiscordHelper";
import { DiscordEmbedParams } from "./discord/types";
import { WebhookURLModal } from "./WebhookURLModal";

export default class DiscordSharePlugin extends Plugin {
	settings: ISettingsOptions;
	discordManager: DiscordManager;
	discordHelper: DiscordHelper;
	workspace: Workspace;
	currentFile: TFile | null;
	currentFileContents: string;

	async onload() {
		await this.initializeSettings();
	
		this.discordHelper = new DiscordHelper(this);
		this.discordManager = new DiscordManager(this);
		this.addSettingTab(new SettingsTab(this));
		this.workspace = this.app.workspace;
		this.currentFile = this.workspace.getActiveFile();
		this.currentFileContents = "";

		this.app.workspace.on('active-leaf-change', async () => {
			this.currentFile = this.workspace.getActiveFile();
			if (this.currentFile) {
				const contents = this.currentFile instanceof TFile ? await this.app.vault.read(this.currentFile) : "";
				this.currentFileContents = contents;
			} else {
				this.currentFileContents = "";
			}
		})

		this.app.workspace.on('editor-change', (editor) => {
			const content = editor.getDoc().getValue();
			this.currentFileContents = content;
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
				const discordContent = this.discordHelper.formatObsidianContentForDiscord(this.currentFileContents);
				if (checking) {
					return !!this.currentFile && (discordWebhookURLSet !== undefined && discordWebhookURLSet.length > 0);
				}
				if (this.currentFile instanceof TFile) {
					const params: Partial<DiscordEmbedParams> = {
						title: this.currentFile.basename,
						description: discordContent || "",
					};
					if (!params) {
						new Notice(
							`Failed to build Discord embed params from file ${this.currentFile.name}.`
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

				const discordContent = this.discordHelper.formatObsidianContentForDiscord(editor.getSelection().trim());
				const params: Partial<DiscordEmbedParams> = {
					description: discordContent,
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
				const discordContent = this.discordHelper.formatObsidianContentForDiscord(editor.getSelection().trim());

				menu.addItem((item) => {
					item.setTitle("Share selection to Discord").onClick(
						async () => {
							const params: Partial<DiscordEmbedParams> = {
								description: discordContent,
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

	async initializeSettings() {
		const existingSettings = await this.loadData();

		if (existingSettings.version === SETTINGS_VERSION) {
			this.loadSettings(existingSettings);
		} else {
			this.loadSettings(this.migrateSettings(existingSettings));
		}
	}

	loadSettings(data: any) {
		this.settings = Object.assign({}, INITIAL_SETTINGS, data);
	}

	migrateSettings(data: Partial<IObsoleteSettingsOptions>): ISettingsOptions {
		const newSettings: ISettingsOptions = {
			version: SETTINGS_VERSION,
			discordWebhookURL: data.discordWebhookURL || [],
			attachmentsFolder: data.attachmentsFolder || "",
			localSuggestionsLimit: data.localSuggestionsLimit || 10,
			showPreviewInLocalModal: data.showPreviewInLocalModal || true,
			customBotUsername: data.customBotUsername || "",
			customBotAvatarURL: data.customBotAvatarURL || "",
			useNoteTitleForEmbed: data.useNoteTitleForEmbed || false,
			embedDefaultValues: {
				embedDefaultTitle: "",
				embedDefaultColor: data.embedColor || "",
				embedDefaultURL: "",
				embedDefaultAuthor: {
					name: "",
					url: "",
					iconURL: "",
				},
				embedDefaultDescription: "",
				embedDefaultThumbnail: "",
				embedDefaultFields: [],
				embedDefaultImage: "",
				embedDefaultFooter: "",
			},
			embedPropertyOverrides: {
				embedTitlePropertyOverride: data.embedTitle || "",
				embedURLPropertyOverride: data.embedURL || "",
				embedAuthorPropertyOverride: data.embedAuthor || "",
				embedDescriptionPropertyOverride: data.embedDescription || "",
				embedThumbnailPropertyOverride: data.embedThumbnail || "",
				embedFieldsPropertyOverride: data.embedFields || "",
				embedImagePropertyOverride: data.embedImage || "",
				embedFooterPropertyOverride: data.embedFooter || "",
			},
		};
		return newSettings;
	}
		
}
