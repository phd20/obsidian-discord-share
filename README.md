# Discord Share Plugin

This plugin allows you to share your Obsidian Vault content to Discord using [discord.js](https://discord.js.org/).

## Setup
1. Add this plugin to your Obsidian vault.
2. Enable it.
3. Get a Webhook URL from Discord. See [this guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) for more on how to do this.
4. Paste your Discord Webhook URL into the `Discord Webhook URL` setting for this plugin. **You must do this or the plugin will not work.**

### Optional Settings
- By default, the plugin will search all files for attachments. You can choose which folder to look for attachments in by setting the `Attachments folder` setting. If you set this, the plugin will only search that folder and all folders within it.
- You can turn on/off image previews in the local image search by adjusting the `Show preview images` setting.
- You can change the number of suggestions to show in the local image search by changing the `Suggestions limit` setting.

## Send Attachment to Discord

You can send an attachment to Discord using this plugin. There are two ways to activate the feature:

1. Find the **Send Attachment to Discord** icon in the left side ribbon. Click on it.
2. Open the command palette and search for **Send Attachment to Discord**. Click on it or press `return` on your keyboard.

This opens a modal to search your local image files. Search for the file you want and click on it or press `return` on your keyboard.

Hat tip to the [obsidian-banners](https://github.com/noatpad/obsidian-banners) plugin for inspiration on some of the features.
